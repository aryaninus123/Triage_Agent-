import { z } from "zod";

export const ConditionSchema = z.object({
  field: z.enum([
    "category",
    "priority",
    "sentiment",
    "tier",
    "urgencyScore",
    "confidence",
    "isDuplicate",
    "language",
    "openTickets",
  ]),
  operator: z.enum(["eq", "neq", "gte", "lte", "in", "notIn"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

export const ActionSchema = z.object({
  forceTeam: z
    .enum(["billing-team", "tech-support", "customer-success", "general-support"])
    .optional(),
  forceEscalate: z.boolean().optional(),
  addTag: z.string().optional(),
  notifyChannel: z.string().optional(),
});

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(999),
  conditionMode: z.enum(["AND", "OR"]).default("AND"),
  conditions: z.array(ConditionSchema),
  actions: ActionSchema,
});

export const RulesFileSchema = z.array(RuleSchema);

export type Rule = z.infer<typeof RuleSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type RuleAction = z.infer<typeof ActionSchema>;
