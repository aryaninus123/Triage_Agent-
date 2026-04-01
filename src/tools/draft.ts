import type { DraftResult, DraftTone, KBArticle, SupportTicket } from "../types";

export interface DraftInput {
  subject: string;
  body: string;
  tone: DraftTone;
}

function buildKBSection(articles: KBArticle[]): string {
  if (articles.length === 0) return "";

  const top = articles.slice(0, 2);
  const links = top.map((a) => `  - ${a.title}: https://help.example.com${a.url}`).join("\n");
  return `\n\nHelpful Resources:\n${links}`;
}

/**
 * Structures Claude's drafted response and attaches metadata.
 * In production, this could directly call your email API (SendGrid, SES, etc.)
 */
export function draftResponse(
  input: DraftInput,
  ticket: SupportTicket,
  kbArticles?: KBArticle[]
): DraftResult {
  // Ensure ticket ID is referenced in the subject
  const subject = input.subject.includes(ticket.id)
    ? input.subject
    : `Re: [${ticket.id}] ${input.subject}`;

  // Append KB links if available
  const kbSection = kbArticles ? buildKBSection(kbArticles) : "";
  const body = `To: ${ticket.customerEmail}\n\n${input.body}${kbSection}`;

  return {
    subject,
    body,
    tone: input.tone,
  };
}
