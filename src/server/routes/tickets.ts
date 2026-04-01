import { Router } from "express";
import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { triageTicket } from "../../agent";
import { appendAuditEvent } from "../../db/audit-store";
import { getTicket, insertTicket, listTickets, updateTicketStatus } from "../../db/ticket-store";
import { getTriageResult } from "../../db/triage-store";
import { eventBus } from "../../events/event-bus";
import type { AgentConfig } from "../../types";
import { ApiError } from "../middleware/error-handler";
import { FeedbackRequestSchema, TriageRequestSchema } from "../schemas";

export function ticketsRouter(db: Database.Database, config: AgentConfig): Router {
  const router = Router();

  // POST /tickets/triage — submit a ticket for triage
  router.post("/triage", async (req, res, next) => {
    try {
      const body = TriageRequestSchema.parse(req.body);

      const ticket = {
        id: body.id ?? `TKT-${uuidv4().slice(0, 8).toUpperCase()}`,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        subject: body.subject,
        body: body.body,
        createdAt: body.createdAt ?? new Date().toISOString(),
      };

      insertTicket(db, ticket);
      appendAuditEvent(db, {
        timestamp: new Date().toISOString(),
        ticketId: ticket.id,
        actor: "api",
        action: "triage.started",
        metadata: { modelId: config.model },
      });

      const result = await triageTicket(ticket, config, db);

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /tickets — list tickets with optional status filter
  router.get("/", (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const offset = Number(req.query.offset ?? 0);

      type TicketStatus = "pending" | "triaged" | "escalated" | "resolved" | "failed";
      const tickets = listTickets(db, {
        status: status as TicketStatus | undefined,
        limit,
        offset,
      });

      res.json({ tickets, limit, offset });
    } catch (err) {
      next(err);
    }
  });

  // GET /tickets/:id — fetch ticket + triage result
  router.get("/:id", (req, res, next) => {
    try {
      const ticket = getTicket(db, req.params.id);
      if (!ticket) throw new ApiError(404, `Ticket ${req.params.id} not found`);

      const triagedResult = getTriageResult(db, req.params.id);
      const auditLog = db
        .prepare("SELECT * FROM audit_log WHERE ticket_id = ? ORDER BY timestamp ASC")
        .all(req.params.id);

      res.json({ ticket, triagedResult, auditLog });
    } catch (err) {
      next(err);
    }
  });

  // POST /tickets/:id/feedback — human correction
  router.post("/:id/feedback", (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const ticket = getTicket(db, ticketId);
      if (!ticket) throw new ApiError(404, `Ticket ${ticketId} not found`);

      const feedback = FeedbackRequestSchema.parse(req.body);
      const existing = getTriageResult(db, ticketId);

      appendAuditEvent(db, {
        timestamp: new Date().toISOString(),
        ticketId,
        actor: `human:${feedback.actor}`,
        action: feedback.correctedCategory ? "classification.corrected" : "routing.overridden",
        before: existing
          ? {
              category: existing.classification.category,
              team: existing.routing.team,
              escalate: existing.routing.escalate,
            }
          : undefined,
        after: {
          correctedCategory: feedback.correctedCategory,
          correctedTeam: feedback.correctedTeam,
          correctedEscalate: feedback.correctedEscalate,
          notes: feedback.notes,
        },
      });

      eventBus.emit("ticket.feedback_received", ticketId, feedback);

      // Update ticket status if escalation override
      if (feedback.correctedEscalate) {
        updateTicketStatus(db, ticketId, "escalated");
      }

      res.json({ ok: true, ticketId });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
