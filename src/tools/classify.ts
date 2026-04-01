import type { ClassificationResult, TicketCategory, TicketPriority, TicketSentiment } from "../types";

interface ClassifyInput {
  category: TicketCategory;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  summary: string;
  confidence: number;
  subCategory: string;
  language: string;
  isDuplicate: boolean;
}

export function classifyTicket(input: ClassifyInput): ClassificationResult {
  return {
    category: input.category,
    priority: input.priority,
    sentiment: input.sentiment,
    summary: input.summary,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    subCategory: input.subCategory,
    language: input.language || "en",
    isDuplicate: input.isDuplicate ?? false,
  };
}
