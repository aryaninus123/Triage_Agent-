import type { ClassificationResult, CustomerHistory, RoutingResult } from "../types";

// Flat context object used by rule condition evaluation
export interface RuleContext {
  category: string;
  priority: string;
  sentiment: string;
  confidence: number;
  isDuplicate: boolean;
  language: string;
  urgencyScore: number;
  tier: string;
  openTickets: number;
  team: string;
  escalate: boolean;
}

export function buildRuleContext(
  classification: ClassificationResult,
  routing: RoutingResult,
  customerHistory?: CustomerHistory
): RuleContext {
  return {
    category: classification.category,
    priority: classification.priority,
    sentiment: classification.sentiment,
    confidence: classification.confidence,
    isDuplicate: classification.isDuplicate,
    language: classification.language,
    urgencyScore: routing.urgencyScore,
    tier: customerHistory?.tier ?? "free",
    openTickets: customerHistory?.openTickets ?? 0,
    team: routing.team,
    escalate: routing.escalate,
  };
}
