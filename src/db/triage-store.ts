import type Database from "better-sqlite3";
import type { TriageResult } from "../types";

export function insertTriageResult(
  db: Database.Database,
  result: TriageResult,
  latencyMs: number,
  modelId: string
): void {
  db.prepare(`
    INSERT INTO triage_results
      (ticket_id, classification_json, routing_json, draft_json,
       customer_history_json, kb_articles_json, applied_rules_json,
       tags_json, urgency_score, latency_ms, model_id)
    VALUES
      (@ticketId, @classification, @routing, @draft,
       @customerHistory, @kbArticles, @appliedRules,
       @tags, @urgencyScore, @latencyMs, @modelId)
  `).run({
    ticketId: result.ticket.id,
    classification: JSON.stringify(result.classification),
    routing: JSON.stringify(result.routing),
    draft: JSON.stringify(result.draft),
    customerHistory: result.customerHistory ? JSON.stringify(result.customerHistory) : null,
    kbArticles: result.kbArticles ? JSON.stringify(result.kbArticles) : null,
    appliedRules: result.appliedRules ? JSON.stringify(result.appliedRules) : null,
    tags: result.tags ? JSON.stringify(result.tags) : null,
    urgencyScore: result.routing.urgencyScore,
    latencyMs,
    modelId,
  });
}

export function getTriageResult(
  db: Database.Database,
  ticketId: string
): TriageResult | null {
  const row = db
    .prepare("SELECT * FROM triage_results WHERE ticket_id = ? ORDER BY triaged_at DESC LIMIT 1")
    .get(ticketId) as Record<string, string | number | null> | undefined;

  if (!row) return null;

  const ticket = db
    .prepare("SELECT raw_ticket_json FROM tickets WHERE id = ?")
    .get(ticketId) as { raw_ticket_json: string } | undefined;

  if (!ticket) return null;

  return {
    ticket: JSON.parse(ticket.raw_ticket_json),
    classification: JSON.parse(row.classification_json as string),
    routing: JSON.parse(row.routing_json as string),
    draft: JSON.parse(row.draft_json as string),
    customerHistory: row.customer_history_json
      ? JSON.parse(row.customer_history_json as string)
      : undefined,
    kbArticles: row.kb_articles_json
      ? JSON.parse(row.kb_articles_json as string)
      : undefined,
    appliedRules: row.applied_rules_json
      ? JSON.parse(row.applied_rules_json as string)
      : undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json as string) : undefined,
  };
}
