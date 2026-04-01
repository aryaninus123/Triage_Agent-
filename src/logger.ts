import type { AppliedRule, TriageResult } from "./types";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: RED,
  high: YELLOW,
  medium: CYAN,
  low: GREEN,
};

const TIER_COLOR: Record<string, string> = {
  enterprise: MAGENTA,
  pro: CYAN,
  free: DIM,
};

export class TriageLogger {
  private timers = new Map<string, number>();
  private logTiming: boolean;

  constructor(logTiming = true) {
    this.logTiming = logTiming;
  }

  startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  endTimer(label: string): number {
    const start = this.timers.get(label);
    if (start == null) return 0;
    const elapsed = Date.now() - start;
    this.timers.delete(label);
    return elapsed;
  }

  info(message: string): void {
    console.log(`${DIM}[INFO]${RESET} ${message}`);
  }

  warn(message: string): void {
    console.warn(`${YELLOW}[WARN]${RESET} ${message}`);
  }

  tool(toolName: string, elapsedMs: number, summary: string): void {
    const timing = this.logTiming ? ` ${DIM}(${elapsedMs}ms)${RESET}` : "";
    console.log(`  ${CYAN}→ [TOOL]${RESET} ${BOLD}${toolName}${RESET}${timing} ${DIM}${summary}${RESET}`);
  }

  summary(result: TriageResult, totalMs: number): void {
    const { ticket, classification, routing, draft, customerHistory, kbArticles, appliedRules, tags } = result;

    const priorityColor = PRIORITY_COLOR[classification.priority] ?? RESET;
    const tierColor = customerHistory ? (TIER_COLOR[customerHistory.tier] ?? RESET) : RESET;
    const timing = this.logTiming ? ` ${DIM}(${totalMs}ms)${RESET}` : "";

    console.log(`\n${"─".repeat(64)}`);
    console.log(`${BOLD}Ticket ${ticket.id}: ${ticket.subject}${RESET}${timing}`);
    console.log(`  From: ${ticket.customerName} <${ticket.customerEmail}>`);

    // Customer history
    if (customerHistory) {
      const tier = `${tierColor}${customerHistory.tier.toUpperCase()}${RESET}`;
      const trend = customerHistory.previousSentiments.slice(-3).join(" → ") || "none";
      console.log(`\n${BOLD}Customer${RESET}`);
      console.log(`  Tier         : ${tier}`);
      console.log(`  Total tickets: ${customerHistory.totalTickets} (${customerHistory.openTickets} open)`);
      console.log(`  Sentiment trend: ${trend}`);
      console.log(`  Account age  : ${customerHistory.accountAgeMonths} months`);
    }

    // Classification
    const confidence = `${Math.round(classification.confidence * 100)}%`;
    const dupeFlag = classification.isDuplicate ? ` ${YELLOW}[DUPLICATE?]${RESET}` : "";
    console.log(`\n${BOLD}Classification${RESET}`);
    console.log(`  Category : ${classification.category} › ${classification.subCategory}${dupeFlag}`);
    console.log(`  Priority : ${priorityColor}${classification.priority.toUpperCase()}${RESET}`);
    console.log(`  Sentiment: ${classification.sentiment}`);
    console.log(`  Language : ${classification.language}`);
    console.log(`  Confidence: ${confidence}`);
    console.log(`  Summary  : ${classification.summary}`);

    // Routing
    const escalateLabel = routing.escalate
      ? `${RED}YES — escalate${RESET}`
      : `${GREEN}No${RESET}`;
    console.log(`\n${BOLD}Routing${RESET}`);
    console.log(`  Team         : ${routing.team}`);
    console.log(`  Escalate     : ${escalateLabel}`);
    console.log(`  Urgency score: ${urgencyBar(routing.urgencyScore)}`);
    console.log(`  SLA          : ${routing.sla.label}`);
    console.log(`  Reason       : ${routing.reason}`);

    // Applied rules & tags
    if (appliedRules && appliedRules.length > 0) {
      console.log(`\n${BOLD}Rules Applied${RESET}`);
      for (const rule of appliedRules) {
        const actions = formatRuleActions(rule);
        console.log(`  ${MAGENTA}●${RESET} ${rule.ruleName} ${DIM}(${rule.ruleId})${RESET}`);
        if (actions) console.log(`    ${DIM}${actions}${RESET}`);
      }
    }
    if (tags && tags.length > 0) {
      console.log(`\n${BOLD}Tags${RESET}  ${tags.map((t) => `${YELLOW}[${t}]${RESET}`).join(" ")}`);
    }

    // KB articles
    if (kbArticles && kbArticles.length > 0) {
      console.log(`\n${BOLD}KB Articles Suggested${RESET}`);
      for (const article of kbArticles.slice(0, 3)) {
        const relevance = `${Math.round(article.relevanceScore * 100)}%`;
        console.log(`  [${relevance}] ${article.title}`);
        console.log(`       ${DIM}${article.url}${RESET}`);
      }
    }

    // Draft
    const toneLabel = `${DIM}[${draft.tone}]${RESET}`;
    console.log(`\n${BOLD}Draft Response${RESET} ${toneLabel}`);
    console.log(`  Subject: ${draft.subject}`);
    console.log(`\n${draft.body.split("\n").map((l) => `  ${l}`).join("\n")}`);
    console.log(`\n${"─".repeat(64)}`);
  }
}

function formatRuleActions(rule: AppliedRule): string {
  const parts: string[] = [];
  if (rule.actions.forceTeam) parts.push(`team→${rule.actions.forceTeam}`);
  if (rule.actions.forceEscalate !== undefined) parts.push(`escalate=${rule.actions.forceEscalate}`);
  if (rule.actions.addTag) parts.push(`tag="${rule.actions.addTag}"`);
  if (rule.actions.notifyChannel) parts.push(`notify=${rule.actions.notifyChannel}`);
  return parts.join(", ");
}

function urgencyBar(score: number): string {
  const filled = Math.round(score / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  let color = GREEN;
  if (score >= 80) color = RED;
  else if (score >= 60) color = YELLOW;
  else if (score >= 40) color = CYAN;
  return `${color}${bar}${RESET} ${score}/100`;
}
