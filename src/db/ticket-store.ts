import type Database from "better-sqlite3";
import type { SupportTicket } from "../types";

type TicketStatus = "pending" | "triaged" | "escalated" | "resolved" | "failed";

export function insertTicket(db: Database.Database, ticket: SupportTicket): void {
  db.prepare(`
    INSERT OR IGNORE INTO tickets
      (id, customer_email, customer_name, subject, body, created_at, raw_ticket_json)
    VALUES
      (@id, @email, @name, @subject, @body, @createdAt, @raw)
  `).run({
    id: ticket.id,
    email: ticket.customerEmail,
    name: ticket.customerName,
    subject: ticket.subject,
    body: ticket.body,
    createdAt: ticket.createdAt,
    raw: JSON.stringify(ticket),
  });
}

export function updateTicketStatus(
  db: Database.Database,
  ticketId: string,
  status: TicketStatus
): void {
  const triagedAt = status === "triaged" || status === "escalated"
    ? new Date().toISOString()
    : undefined;

  db.prepare(`
    UPDATE tickets
    SET status = ?, triaged_at = COALESCE(?, triaged_at)
    WHERE id = ?
  `).run(status, triagedAt ?? null, ticketId);
}

export function getTicket(db: Database.Database, ticketId: string): SupportTicket | null {
  const row = db.prepare("SELECT raw_ticket_json FROM tickets WHERE id = ?").get(ticketId) as
    | { raw_ticket_json: string }
    | undefined;
  return row ? (JSON.parse(row.raw_ticket_json) as SupportTicket) : null;
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

export function listTickets(
  db: Database.Database,
  options: { status?: TicketStatus; limit?: number; offset?: number } = {}
): TicketListItem[] {
  const { status, limit = 20, offset = 0 } = options;

  const rows = status
    ? (db
        .prepare(
          "SELECT id, customer_name, customer_email, subject, status, created_at, triaged_at FROM tickets WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .all(status, limit, offset) as Record<string, unknown>[])
    : (db
        .prepare(
          "SELECT id, customer_name, customer_email, subject, status, created_at, triaged_at FROM tickets ORDER BY created_at DESC LIMIT ? OFFSET ?"
        )
        .all(limit, offset) as Record<string, unknown>[]);

  return rows.map((r) => ({
    id: r.id as string,
    customerName: r.customer_name as string,
    customerEmail: r.customer_email as string,
    subject: r.subject as string,
    status: r.status as TicketStatus,
    createdAt: r.created_at as string,
    triagedAt: (r.triaged_at as string) ?? null,
  }));
}
