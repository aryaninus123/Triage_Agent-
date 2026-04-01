export type AuditAction =
  | "triage.started"
  | "triage.completed"
  | "triage.failed"
  | "routing.escalated"
  | "routing.overridden"
  | "classification.corrected"
  | "ticket.status.changed"
  | "sla.breached"
  | "rule.matched";

export interface AuditEvent {
  timestamp: string;
  ticketId: string;
  actor: string;             // "agent:claude-opus-4-6" | "human:user@company.com"
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  metadata?: {
    urgencyScore?: number;
    modelId?: string;
    latencyMs?: number;
    confidence?: number;
    ruleId?: string;
    ruleName?: string;
    errorMessage?: string;
  };
}
