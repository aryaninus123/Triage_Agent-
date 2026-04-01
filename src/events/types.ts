export type TriageEventName =
  | "ticket.triaged"
  | "ticket.escalated"
  | "ticket.routed"
  | "ticket.sla_warning"
  | "ticket.feedback_received"
  | "rule.matched";

export interface TriageEvent<T = unknown> {
  id: string;
  name: TriageEventName;
  ticketId: string;
  timestamp: string;
  payload: T;
}
