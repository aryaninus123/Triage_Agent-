import type { ClassificationResult, TicketCategory, TicketPriority, TicketSentiment } from "../types";

export interface ClassifyInput {
  category: TicketCategory;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  summary: string;
  confidence: number;
  subCategory: string;
  language: string;
  isDuplicate: boolean;
}

/**
 * Processes classification data returned by Claude and
 * structures it into a typed ClassificationResult.
 */
export function classifyTicket(input: ClassifyInput): ClassificationResult {
  return {
    category: input.category,
    priority: input.priority,
    sentiment: input.sentiment,
    summary: input.summary,
    confidence: Math.min(1, Math.max(0, input.confidence)),
    subCategory: input.subCategory,
    language: input.language || "en",
    isDuplicate: input.isDuplicate,
  };
}
