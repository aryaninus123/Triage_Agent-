import type Database from "better-sqlite3";
import type { CustomerHistory } from "../types";

interface CustomerRow {
  id: string;
  email: string;
  name: string;
  tier: string;
  total_tickets: number;
  open_tickets: number;
  account_age_months: number;
  previous_sentiments: string;
  last_ticket_date: string | null;
}

// Seed data matching our demo tickets
const SEED_CUSTOMERS = [
  {
    id: "USR-1042",
    email: "sarah.chen@example.com",
    name: "Sarah Chen",
    tier: "pro",
    total_tickets: 4,
    open_tickets: 1,
    account_age_months: 14,
    previous_sentiments: JSON.stringify(["neutral", "frustrated", "frustrated"]),
    last_ticket_date: "2026-02-15T10:22:00Z",
  },
  {
    id: "USR-0089",
    email: "m.rivera@techcorp.io",
    name: "Marcus Rivera",
    tier: "enterprise",
    total_tickets: 12,
    open_tickets: 2,
    account_age_months: 36,
    previous_sentiments: JSON.stringify(["positive", "neutral", "neutral", "frustrated"]),
    last_ticket_date: "2026-03-10T08:45:00Z",
  },
  {
    id: "USR-3317",
    email: "priya.k@gmail.com",
    name: "Priya Kapoor",
    tier: "free",
    total_tickets: 1,
    open_tickets: 0,
    account_age_months: 3,
    previous_sentiments: JSON.stringify(["positive"]),
    last_ticket_date: "2026-01-05T14:30:00Z",
  },
];

export function seedCustomers(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO customers
      (id, email, name, tier, total_tickets, open_tickets, account_age_months, previous_sentiments, last_ticket_date)
    VALUES
      (@id, @email, @name, @tier, @total_tickets, @open_tickets, @account_age_months, @previous_sentiments, @last_ticket_date)
  `);
  for (const c of SEED_CUSTOMERS) {
    insert.run(c);
  }
}

export function getCustomerByEmail(db: Database.Database, email: string): CustomerHistory | null {
  const row = db
    .prepare("SELECT * FROM customers WHERE email = ? COLLATE NOCASE")
    .get(email) as CustomerRow | undefined;

  if (!row) return null;

  return {
    customerId: row.id,
    customerEmail: row.email,
    tier: row.tier as CustomerHistory["tier"],
    totalTickets: row.total_tickets,
    openTickets: row.open_tickets,
    accountAgeMonths: row.account_age_months,
    previousSentiments: JSON.parse(row.previous_sentiments),
    lastTicketDate: row.last_ticket_date,
  };
}

export function upsertCustomerTicketCount(
  db: Database.Database,
  email: string,
  newSentiment: string
): void {
  db.prepare(`
    UPDATE customers
    SET
      total_tickets = total_tickets + 1,
      open_tickets  = open_tickets + 1,
      last_ticket_date = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      previous_sentiments = json_insert(
        previous_sentiments,
        '$[#]',
        ?
      )
    WHERE email = ? COLLATE NOCASE
  `).run(newSentiment, email);
}

export function decrementOpenTickets(db: Database.Database, email: string): void {
  db.prepare(`
    UPDATE customers
    SET open_tickets = MAX(0, open_tickets - 1)
    WHERE email = ? COLLATE NOCASE
  `).run(email);
}
