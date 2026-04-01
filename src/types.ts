// ─── Ticket ────────────────────────────────────────────────────────────────

export interface SupportTicket {
  id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  body: string;
  createdAt: string;
}

// ─── Classification ────────────────────────────────────────────────────────

export type TicketCategory =
  | "billing"
  | "technical"
  | "refund"
  | "shipping"
  | "account"
  | "general";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketSentiment = "positive" | "neutral" | "frustrated" | "angry";

export interface ClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  summary: string;
  confidence: number;         // 0.0–1.0 — Claude's certainty about the classification
  subCategory: string;        // e.g. "duplicate-charge", "login-issue", "export-feature"
  language: string;           // ISO 639-1 code, e.g. "en", "es"
  isDuplicate: boolean;       // true if this appears to be a repeat submission
}

// ─── Customer History ──────────────────────────────────────────────────────

export type CustomerTier = "free" | "pro" | "enterprise";

export interface CustomerHistory {
  customerId: string;
  customerEmail: string;
  tier: CustomerTier;
  totalTickets: number;
  openTickets: number;
  accountAgeMonths: number;
  previousSentiments: TicketSentiment[];
  lastTicketDate: string | null;
}

// ─── Knowledge Base ────────────────────────────────────────────────────────

export interface KBArticle {
  id: string;
  title: string;
  url: string;
  relevanceScore: number;
  snippet: string;
}

export interface KBSearchResult {
  articles: KBArticle[];
  searchedFor: string;
}

// ─── SLA Targets ───────────────────────────────────────────────────────────

export interface SLATarget {
  responseTimeHours: number;
  resolutionTimeHours: number;
  label: string;              // e.g. "4h response / 24h resolution"
}

// ─── Routing ───────────────────────────────────────────────────────────────

export type Team = "billing-team" | "tech-support" | "customer-success" | "general-support";

export interface RoutingResult {
  team: Team;
  escalate: boolean;
  reason: string;
  urgencyScore: number;       // 0–100 composite score
  sla: SLATarget;
}

// ─── Response Draft ────────────────────────────────────────────────────────

export type DraftTone = "formal" | "friendly" | "technical";

export interface DraftResult {
  subject: string;
  body: string;
  tone: DraftTone;
}

// ─── Agent Config ──────────────────────────────────────────────────────────

export interface AgentConfig {
  model: string;
  maxTokens: number;
  enableKBSearch: boolean;
  enableCustomerHistory: boolean;
  logTiming: boolean;
}

// ─── Applied Rules ─────────────────────────────────────────────────────────

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  actions: {
    forceTeam?: string;
    forceEscalate?: boolean;
    addTag?: string;
    notifyChannel?: string;
  };
}

// ─── Final Triage Output ───────────────────────────────────────────────────

export interface TriageResult {
  ticket: SupportTicket;
  classification: ClassificationResult;
  routing: RoutingResult;
  draft: DraftResult;
  customerHistory?: CustomerHistory;
  kbArticles?: KBArticle[];
  appliedRules?: AppliedRule[];
  tags?: string[];
}
