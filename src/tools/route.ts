import { buildRuleContext } from "../rules/rule-context";
import { evaluateRules } from "../rules/rule-engine";
import type {
  AppliedRule,
  ClassificationResult,
  CustomerHistory,
  RoutingResult,
  SLATarget,
  Team,
  TicketPriority,
} from "../types";

interface RouteInput {
  team: Team;
  escalate: boolean;
  reason: string;
}

// Fallback routing rules in case Claude's suggestion needs overriding
const CATEGORY_TO_TEAM: Record<string, Team> = {
  billing: "billing-team",
  refund: "billing-team",
  technical: "tech-support",
  shipping: "customer-success",
  account: "tech-support",
  general: "general-support",
};

const SLA_BY_PRIORITY: Record<TicketPriority, SLATarget> = {
  urgent: { responseTimeHours: 1,  resolutionTimeHours: 4,  label: "1h response / 4h resolution" },
  high:   { responseTimeHours: 4,  resolutionTimeHours: 24, label: "4h response / 24h resolution" },
  medium: { responseTimeHours: 8,  resolutionTimeHours: 48, label: "8h response / 48h resolution" },
  low:    { responseTimeHours: 24, resolutionTimeHours: 72, label: "24h response / 72h resolution" },
};

export function computeUrgencyScore(
  classification: ClassificationResult,
  customerHistory?: CustomerHistory
): number {
  const priorityBase: Record<TicketPriority, number> = {
    urgent: 80,
    high: 60,
    medium: 40,
    low: 20,
  };

  const sentimentBonus: Record<string, number> = {
    angry: 15,
    frustrated: 8,
    neutral: 0,
    positive: -5,
  };

  let score = priorityBase[classification.priority] ?? 40;
  score += sentimentBonus[classification.sentiment] ?? 0;

  if (customerHistory) {
    // Tier bonus
    if (customerHistory.tier === "enterprise") score += 10;
    else if (customerHistory.tier === "pro") score += 5;

    // Repeat frustration penalty (customer is escalating)
    const recentSentiments = customerHistory.previousSentiments.slice(-3);
    const trendingAngry = recentSentiments.filter(
      (s) => s === "angry" || s === "frustrated"
    ).length >= 2;
    if (trendingAngry) score += 8;

    // Multiple open tickets
    if (customerHistory.openTickets > 2) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

export function computeSLA(priority: TicketPriority, urgencyScore: number): SLATarget {
  const base = SLA_BY_PRIORITY[priority];

  // VIP fast-track: halve response time for very high urgency
  if (urgencyScore > 85 && base.responseTimeHours > 1) {
    const halved = Math.max(1, Math.floor(base.responseTimeHours / 2));
    return {
      responseTimeHours: halved,
      resolutionTimeHours: base.resolutionTimeHours,
      label: `${halved}h response / ${base.resolutionTimeHours}h resolution (expedited)`,
    };
  }

  return base;
}

export interface RouteTicketResult extends RoutingResult {
  appliedRules: AppliedRule[];
  tags: string[];
  notifyChannels: string[];
}

/**
 * Validates Claude's routing decision and applies deterministic business rules.
 * Escalation and urgency scoring are computed here — not delegated to the model.
 * The JSON rule engine runs as a post-processing step.
 */
export function routeTicket(
  input: RouteInput,
  classification: ClassificationResult,
  customerHistory?: CustomerHistory
): RouteTicketResult {
  const urgencyScore = computeUrgencyScore(classification, customerHistory);
  const sla = computeSLA(classification.priority, urgencyScore);

  // Baseline deterministic escalation rules
  const baseEscalate =
    input.escalate ||
    (classification.priority === "urgent" && classification.sentiment === "angry") ||
    urgencyScore >= 90 ||
    (customerHistory?.tier === "enterprise" && classification.priority !== "low");

  let team: Team = input.team ?? CATEGORY_TO_TEAM[classification.category] ?? "general-support";

  // Build partial routing for rule context, then run rule engine
  const partialRouting: RoutingResult = { team, escalate: baseEscalate, reason: input.reason, urgencyScore, sla };
  const ctx = buildRuleContext(classification, partialRouting, customerHistory);
  const ruleResult = evaluateRules(ctx);

  // Rule engine overrides take effect after baseline logic
  if (ruleResult.forceTeam) team = ruleResult.forceTeam;
  const shouldEscalate = ruleResult.forceEscalate !== undefined ? ruleResult.forceEscalate : baseEscalate;

  return {
    team,
    escalate: shouldEscalate,
    reason: input.reason,
    urgencyScore,
    sla,
    appliedRules: ruleResult.appliedRules,
    tags: ruleResult.tags,
    notifyChannels: ruleResult.notifyChannels,
  };
}
