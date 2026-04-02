// Mirrors backend src/types.ts and src/metrics/types.ts — keep in sync

export type TicketStatus = "pending" | "triaged" | "escalated" | "resolved" | "failed";
export type TicketCategory = "billing" | "technical" | "refund" | "shipping" | "account" | "general";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketSentiment = "positive" | "neutral" | "frustrated" | "angry";
export type Team = "billing-team" | "tech-support" | "customer-success" | "general-support";
export type DraftTone = "formal" | "friendly" | "technical";
export type CustomerTier = "free" | "pro" | "enterprise";

export interface SupportTicket {
  id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  body: string;
  createdAt: string;
}

export interface ClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  summary: string;
  confidence: number;
  subCategory: string;
  language: string;
  isDuplicate: boolean;
}

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

export interface KBArticle {
  id: string;
  title: string;
  url: string;
  relevanceScore: number;
  snippet: string;
}

export interface SLATarget {
  responseTimeHours: number;
  resolutionTimeHours: number;
  label: string;
}

export interface RoutingResult {
  team: Team;
  escalate: boolean;
  reason: string;
  urgencyScore: number;
  sla: SLATarget;
}

export interface DraftResult {
  subject: string;
  body: string;
  tone: DraftTone;
}

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

export interface TicketListItem {
  id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  triagedAt: string | null;
}

export interface ListTicketsResponse {
  tickets: TicketListItem[];
  limit: number;
  offset: number;
}

export interface AuditEvent {
  id: number;
  timestamp: string;
  ticketId: string;
  actor: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TicketDetailResponse {
  ticket: SupportTicket & { status: TicketStatus };
  triagedResult: TriageResult | null;
  auditLog: AuditEvent[];
}

export interface MetricsSummary {
  window: "last_24h" | "last_7d" | "all_time";
  generatedAt: string;
  volume: {
    total: number;
    triaged: number;
    escalated: number;
    pending: number;
  };
  latency: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    minMs: number;
    maxMs: number;
  };
  classification: {
    byCategory: Record<string, number>;
    avgConfidence: number;
    lowConfidenceCount: number;
    duplicateCount: number;
  };
  routing: {
    byTeam: Record<string, number>;
    escalationRate: number;
    escalationByTier: Record<string, number>;
  };
  sla: {
    breachCount: number;
    breachRate: number;
  };
  sentiment: {
    distribution: Record<string, number>;
  };
}
