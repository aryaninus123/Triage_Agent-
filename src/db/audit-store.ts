import type Database from "better-sqlite3";
import type { AuditEvent } from "../audit/events";

export function appendAuditEvent(db: Database.Database, event: AuditEvent): void {
  db.prepare(`
    INSERT INTO audit_log (timestamp, ticket_id, actor, action, before_json, after_json, metadata_json)
    VALUES (@timestamp, @ticketId, @actor, @action, @before, @after, @metadata)
  `).run({
    timestamp: event.timestamp,
    ticketId: event.ticketId,
    actor: event.actor,
    action: event.action,
    before: event.before !== undefined ? JSON.stringify(event.before) : null,
    after: event.after !== undefined ? JSON.stringify(event.after) : null,
    metadata: event.metadata !== undefined ? JSON.stringify(event.metadata) : null,
  });
}

export function getAuditLog(db: Database.Database, ticketId: string): AuditEvent[] {
  const rows = db
    .prepare(
      "SELECT * FROM audit_log WHERE ticket_id = ? ORDER BY timestamp ASC"
    )
    .all(ticketId) as Record<string, string | null>[];

  return rows.map((r) => ({
    timestamp: r.timestamp!,
    ticketId: r.ticket_id!,
    actor: r.actor!,
    action: r.action as AuditEvent["action"],
    before: r.before_json ? JSON.parse(r.before_json) : undefined,
    after: r.after_json ? JSON.parse(r.after_json) : undefined,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
  }));
}
