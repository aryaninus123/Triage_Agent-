import Anthropic from "@anthropic-ai/sdk";
import type Database from "better-sqlite3";
import { DEFAULT_CONFIG } from "./config";
import { appendAuditEvent } from "./db/audit-store";
import { upsertCustomerTicketCount } from "./db/customer-store";
import { insertTriageResult } from "./db/triage-store";
import { updateTicketStatus } from "./db/ticket-store";
import { eventBus } from "./events/event-bus";
import { TriageLogger } from "./logger";
import { classifyTicket } from "./tools/classify";
import { checkCustomerHistory } from "./tools/customer-history";
import { draftResponse } from "./tools/draft";
import { searchKnowledgeBase } from "./tools/knowledge-base";
import { routeTicket } from "./tools/route";
import type {
  AgentConfig,
  AppliedRule,
  CustomerHistory,
  KBArticle,
  SupportTicket,
  TriageResult,
} from "./types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Anthropic.RateLimitError ||
        err instanceof Anthropic.InternalServerError ||
        err instanceof Anthropic.APIConnectionError;

      if (!isRetryable || attempt === maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

// ─── Tool definitions ──────────────────────────────────────────────────────

function buildTools(config: AgentConfig): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];

  if (config.enableCustomerHistory) {
    tools.push({
      name: "check_customer_history",
      description:
        "Look up the customer's account history: tier (free/pro/enterprise), total and open tickets, " +
        "previous sentiment trends, and account age. Call this FIRST before classifying.",
      input_schema: {
        type: "object" as const,
        properties: {
          customerEmail: {
            type: "string",
            description: "The customer's email address.",
          },
        },
        required: ["customerEmail"],
      },
    });
  }

  tools.push({
    name: "classify_ticket",
    description:
      "Classify a support ticket by category, priority, sentiment, and other signals. " +
      "Use customer history context (if available) to inform your confidence and duplicate detection.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["billing", "technical", "refund", "shipping", "account", "general"],
          description: "The category that best describes the ticket.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Priority based on urgency, customer impact, and tier.",
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "frustrated", "angry"],
          description: "The customer's emotional tone.",
        },
        summary: {
          type: "string",
          description: "A one-sentence summary of the customer's issue.",
        },
        confidence: {
          type: "number",
          description: "Your confidence in this classification, 0.0 (low) to 1.0 (high).",
        },
        subCategory: {
          type: "string",
          description:
            "A short, specific sub-category label, e.g. 'duplicate-charge', 'login-issue', 'export-feature', 'blank-dashboard'.",
        },
        language: {
          type: "string",
          description: "ISO 639-1 language code of the ticket body, e.g. 'en', 'es', 'fr'.",
        },
        isDuplicate: {
          type: "boolean",
          description:
            "True if this ticket appears to be a repeat submission of a recently-opened issue.",
        },
      },
      required: [
        "category",
        "priority",
        "sentiment",
        "summary",
        "confidence",
        "subCategory",
        "language",
        "isDuplicate",
      ],
    },
  });

  if (config.enableKBSearch) {
    tools.push({
      name: "search_knowledge_base",
      description:
        "Search the internal knowledge base for articles relevant to this ticket. " +
        "Use the ticket category and 3–6 key terms extracted from the ticket body.",
      input_schema: {
        type: "object" as const,
        properties: {
          category: {
            type: "string",
            enum: ["billing", "technical", "refund", "shipping", "account", "general"],
            description: "The ticket category to scope the search.",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Key terms from the ticket that help find relevant articles.",
          },
        },
        required: ["category", "keywords"],
      },
    });
  }

  tools.push({
    name: "route_ticket",
    description:
      "Decide which internal team should handle this ticket and whether it needs escalation. " +
      "Use classification results and customer history to inform your decision.",
    input_schema: {
      type: "object" as const,
      properties: {
        team: {
          type: "string",
          enum: ["billing-team", "tech-support", "customer-success", "general-support"],
          description: "The team best equipped to resolve this issue.",
        },
        escalate: {
          type: "boolean",
          description: "True if this ticket requires manager or senior attention.",
        },
        reason: {
          type: "string",
          description: "Brief reason for this routing decision.",
        },
      },
      required: ["team", "escalate", "reason"],
    },
  });

  tools.push({
    name: "draft_response",
    description:
      "Write a professional, empathetic reply to send to the customer. " +
      "Embed KB article references if any were found. Match tone to the customer's tier and sentiment. " +
      "Call this last.",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: {
          type: "string",
          description: "The email subject line for the reply.",
        },
        body: {
          type: "string",
          description:
            "The full email body. Be warm, concise, and helpful. " +
            "Use the customer's name. Do NOT include KB links — those are appended automatically.",
        },
        tone: {
          type: "string",
          enum: ["formal", "friendly", "technical"],
          description:
            "The tone of the response. Use 'formal' for enterprise customers, " +
            "'friendly' for free/pro with positive or neutral sentiment, " +
            "'technical' for technical issues regardless of tier.",
        },
      },
      required: ["subject", "body", "tone"],
    },
  });

  return tools;
}

// ─── Extended state type ──────────────────────────────────────────────────

interface AgentState extends Partial<TriageResult> {
  customerHistory?: CustomerHistory;
  kbArticles?: KBArticle[];
  appliedRules?: AppliedRule[];
  tags?: string[];
}

// ─── Tool dispatcher ───────────────────────────────────────────────────────

function dispatchTool(
  name: string,
  input: Record<string, unknown>,
  ticket: SupportTicket,
  state: AgentState,
  logger: TriageLogger,
  db?: Database.Database
): { result: unknown; state: AgentState } {
  const start = Date.now();

  switch (name) {
    case "check_customer_history": {
      const result = checkCustomerHistory(
        input as unknown as Parameters<typeof checkCustomerHistory>[0],
        db
      );
      logger.tool(name, Date.now() - start, `tier=${result.tier} tickets=${result.totalTickets}`);
      return { result, state: { ...state, customerHistory: result } };
    }

    case "classify_ticket": {
      const result = classifyTicket(
        input as unknown as Parameters<typeof classifyTicket>[0]
      );
      logger.tool(
        name,
        Date.now() - start,
        `category=${result.category} priority=${result.priority} confidence=${Math.round(result.confidence * 100)}%`
      );
      return { result, state: { ...state, classification: result } };
    }

    case "search_knowledge_base": {
      const result = searchKnowledgeBase(
        input as unknown as Parameters<typeof searchKnowledgeBase>[0]
      );
      logger.tool(name, Date.now() - start, `found=${result.articles.length} for "${result.searchedFor}"`);
      return { result, state: { ...state, kbArticles: result.articles } };
    }

    case "route_ticket": {
      const result = routeTicket(
        input as unknown as Parameters<typeof routeTicket>[0],
        state.classification!,
        state.customerHistory
      );
      const notifyInfo = result.notifyChannels.length > 0
        ? ` notify=[${result.notifyChannels.join(",")}]`
        : "";
      logger.tool(
        name,
        Date.now() - start,
        `team=${result.team} escalate=${result.escalate} urgency=${result.urgencyScore} rules=${result.appliedRules.length}${notifyInfo}`
      );
      return {
        result,
        state: {
          ...state,
          routing: result,
          appliedRules: result.appliedRules,
          tags: result.tags,
        },
      };
    }

    case "draft_response": {
      const result = draftResponse(
        input as unknown as Parameters<typeof draftResponse>[0],
        ticket,
        state.kbArticles
      );
      logger.tool(name, Date.now() - start, `tone=${result.tone}`);
      return { result, state: { ...state, draft: result } };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── System prompt builder ─────────────────────────────────────────────────

function buildSystemPrompt(config: AgentConfig): string {
  const steps: string[] = [];
  let step = 1;

  if (config.enableCustomerHistory) {
    steps.push(
      `${step++}. check_customer_history — always call this first to understand the customer's tier, history, and sentiment trend`
    );
  }
  steps.push(
    `${step++}. classify_ticket — use customer history (if available) to set confidence and detect duplicates`
  );
  if (config.enableKBSearch) {
    steps.push(
      `${step++}. search_knowledge_base — use the category and 3-6 key terms from the ticket`
    );
  }
  steps.push(
    `${step++}. route_ticket — factor in classification and customer tier when deciding escalation`
  );
  steps.push(
    `${step++}. draft_response — choose tone based on tier and sentiment; KB links are appended automatically, do not include them in the body`
  );

  return `You are an expert customer support triage agent.

Your job is to process incoming support tickets systematically using the available tools.

Call the tools in this exact order:
${steps.join("\n")}

Guidelines:
- Be empathetic and professional. Always use the customer's first name.
- For enterprise customers, use a formal tone and treat all issues as high-priority.
- If the customer has a history of frustrated/angry sentiment, acknowledge the pattern and express extra care.
- Set isDuplicate=true only if the ticket body clearly describes the same issue as a recent open ticket.
- Extract specific, actionable keywords for KB search (e.g. "blank dashboard", "duplicate charge", "export csv").
- Your routing reason should be one concise sentence explaining the decision.`;
}

// ─── Main agent loop ───────────────────────────────────────────────────────

export async function triageTicket(
  ticket: SupportTicket,
  config: AgentConfig = DEFAULT_CONFIG,
  db?: Database.Database
): Promise<TriageResult> {
  const logger = new TriageLogger(config.logTiming);
  logger.startTimer("total");

  const actor = `agent:${config.model}`;

  // Emit triage.started audit event
  if (db) {
    appendAuditEvent(db, {
      timestamp: new Date().toISOString(),
      ticketId: ticket.id,
      actor,
      action: "triage.started",
      metadata: { modelId: config.model },
    });
  }

  const userMessage = `Please triage the following support ticket:

Customer: ${ticket.customerName} <${ticket.customerEmail}>
Subject: ${ticket.subject}
Date: ${ticket.createdAt}

Message:
${ticket.body}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let state: AgentState = { ticket };
  const MAX_ITERATIONS = 15;

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      logger.startTimer("llm");
      const response = await withRetry(() =>
        client.messages.create({
          model: config.model,
          max_tokens: config.maxTokens,
          system: buildSystemPrompt(config),
          tools: buildTools(config),
          messages,
        })
      );
      const llmMs = logger.endTimer("llm");

      if (config.logTiming) {
        logger.info(`LLM response (${llmMs}ms) — stop_reason=${response.stop_reason} iteration=${iteration + 1}/${MAX_ITERATIONS}`);
      }

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") break;

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          const { result, state: newState } = dispatchTool(
            block.name,
            block.input as Record<string, unknown>,
            ticket,
            state,
            logger,
            db
          );
          state = newState;

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        messages.push({ role: "user", content: toolResults });
      } else {
        break;
      }

      if (iteration === MAX_ITERATIONS - 1) {
        logger.warn(`Agent hit max iterations (${MAX_ITERATIONS}) for ticket ${ticket.id}`);
      }
    }

    if (!state.classification || !state.routing || !state.draft) {
      throw new Error("Agent did not complete all triage steps.");
    }

    const totalMs = logger.endTimer("total");

    const result: TriageResult = {
      ticket,
      classification: state.classification,
      routing: state.routing,
      draft: state.draft,
      customerHistory: state.customerHistory,
      kbArticles: state.kbArticles,
      appliedRules: state.appliedRules,
      tags: state.tags,
    };

    // Persist to DB
    if (db) {
      insertTriageResult(db, result, totalMs, config.model);
      updateTicketStatus(db, ticket.id, result.routing.escalate ? "escalated" : "triaged");
      upsertCustomerTicketCount(db, ticket.customerEmail, result.classification.sentiment);

      appendAuditEvent(db, {
        timestamp: new Date().toISOString(),
        ticketId: ticket.id,
        actor,
        action: "triage.completed",
        after: {
          category: result.classification.category,
          priority: result.classification.priority,
          team: result.routing.team,
          escalate: result.routing.escalate,
          urgencyScore: result.routing.urgencyScore,
        },
        metadata: {
          modelId: config.model,
          latencyMs: totalMs,
          confidence: result.classification.confidence,
          urgencyScore: result.routing.urgencyScore,
        },
      });

      if (result.routing.escalate) {
        appendAuditEvent(db, {
          timestamp: new Date().toISOString(),
          ticketId: ticket.id,
          actor,
          action: "routing.escalated",
          metadata: {
            urgencyScore: result.routing.urgencyScore,
            modelId: config.model,
          },
        });
      }

      // Log each matched rule
      for (const rule of result.appliedRules ?? []) {
        appendAuditEvent(db, {
          timestamp: new Date().toISOString(),
          ticketId: ticket.id,
          actor: "rule-engine",
          action: "rule.matched",
          metadata: { ruleId: rule.ruleId, ruleName: rule.ruleName },
        });
      }
    }

    // Emit events
    eventBus.emit("ticket.triaged", ticket.id, result);
    eventBus.emit("ticket.routed", ticket.id, { team: result.routing.team, reason: result.routing.reason });
    if (result.routing.escalate) {
      eventBus.emit("ticket.escalated", ticket.id, {
        team: result.routing.team,
        urgencyScore: result.routing.urgencyScore,
        reason: result.routing.reason,
      });
    }
    if (result.routing.urgencyScore > 85 && !result.routing.escalate) {
      eventBus.emit("ticket.sla_warning", ticket.id, {
        urgencyScore: result.routing.urgencyScore,
        sla: result.routing.sla,
      });
    }

    logger.summary(result, totalMs);
    return result;
  } catch (err) {
    const totalMs = logger.endTimer("total");

    if (db) {
      appendAuditEvent(db, {
        timestamp: new Date().toISOString(),
        ticketId: ticket.id,
        actor,
        action: "triage.failed",
        metadata: {
          latencyMs: totalMs,
          errorMessage: (err as Error).message,
          modelId: config.model,
        },
      });
      updateTicketStatus(db, ticket.id, "failed");
    }

    throw err;
  }
}
