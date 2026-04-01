import { z } from "zod";

export const TriageRequestSchema = z.object({
  id: z
    .string()
    .regex(/^[A-Z]+-[A-Z0-9]+$/, "Ticket ID must match pattern like TKT-001 or TKT-A1B2C3D4")
    .optional(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  createdAt: z.string().datetime().optional(),
});

export const FeedbackRequestSchema = z.object({
  actor: z.string().email("actor must be an email address"),
  correctedCategory: z
    .enum(["billing", "technical", "refund", "shipping", "account", "general"])
    .optional(),
  correctedTeam: z
    .enum(["billing-team", "tech-support", "customer-success", "general-support"])
    .optional(),
  correctedEscalate: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

export const MetricsWindowSchema = z.object({
  window: z.enum(["last_24h", "last_7d", "all_time"]).default("last_24h"),
});

export type TriageRequest = z.infer<typeof TriageRequestSchema>;
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
