import "dotenv/config";
import { validateEnv } from "./config-validation/env";
import { triageTicket } from "./agent";
import { createConfig } from "./config";
import { initDb, closeDb } from "./db/database";
import type { SupportTicket } from "./types";

// ─── Sample tickets for the demo ──────────────────────────────────────────

const SAMPLE_TICKETS: SupportTicket[] = [
  {
    id: "TKT-001",
    customerName: "Sarah Chen",
    customerEmail: "sarah.chen@example.com",
    subject: "Charged twice for my subscription",
    body: `Hi,

I was charged twice this month for my Pro subscription — once on March 1st and again on March 3rd.
I've attached my bank statement. This is really frustrating and I need this resolved ASAP.
I expect a full refund for the duplicate charge.

Thanks,
Sarah`,
    createdAt: new Date().toISOString(),
  },
  {
    id: "TKT-002",
    customerName: "Marcus Rivera",
    customerEmail: "m.rivera@techcorp.io",
    subject: "Dashboard not loading after update",
    body: `Hey support team,

Since the update yesterday, my dashboard just shows a blank white screen.
I've tried Chrome and Firefox, cleared cache, nothing works.
I'm on the Enterprise plan and my whole team is blocked. Please help!

Browser: Chrome 122
OS: macOS Sonoma

Marcus`,
    createdAt: new Date().toISOString(),
  },
  {
    id: "TKT-003",
    customerName: "Priya Kapoor",
    customerEmail: "priya.k@gmail.com",
    subject: "How do I export my data?",
    body: `Hello,

I'd like to export all my project data as a CSV.
I've looked through the settings but can't find the option.
Could you point me in the right direction?

Thanks so much,
Priya`,
    createdAt: new Date().toISOString(),
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const env = validateEnv();
  const config = createConfig({ logTiming: env.LOG_TIMING });
  const db = initDb(env.DB_PATH);

  console.log("\nSupport Triage Agent — Demo mode");
  console.log(`  Model : ${config.model}`);
  console.log(`  DB    : ${env.DB_PATH}`);
  console.log(`  Processing ${SAMPLE_TICKETS.length} sample tickets\n`);

  // Insert sample tickets into DB first
  const { insertTicket } = await import("./db/ticket-store");
  for (const ticket of SAMPLE_TICKETS) {
    insertTicket(db, ticket);
  }

  for (const ticket of SAMPLE_TICKETS) {
    console.log(`Triaging ticket ${ticket.id}...`);
    try {
      await triageTicket(ticket, config, db);
    } catch (err) {
      console.error(`Failed to triage ${ticket.id}:`, err);
    }
  }

  closeDb();
  console.log("\nAll tickets processed.\n");
}

main();
