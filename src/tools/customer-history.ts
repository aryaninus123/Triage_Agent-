import type Database from "better-sqlite3";
import type { CustomerHistory, TicketSentiment } from "../types";
import { getCustomerByEmail } from "../db/customer-store";

interface CheckHistoryInput {
  customerEmail: string;
}

function buildDefaultHistory(email: string): CustomerHistory {
  return {
    customerId: `USR-${Math.floor(Math.random() * 9000 + 1000)}`,
    customerEmail: email,
    tier: "free",
    totalTickets: 1,
    openTickets: 0,
    accountAgeMonths: 3,
    previousSentiments: [] as TicketSentiment[],
    lastTicketDate: null,
  };
}

export function checkCustomerHistory(
  input: CheckHistoryInput,
  db?: Database.Database
): CustomerHistory {
  if (db) {
    const found = getCustomerByEmail(db, input.customerEmail);
    if (found) return found;
  }
  return buildDefaultHistory(input.customerEmail);
}
