import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tickets (
      id                TEXT PRIMARY KEY,
      customer_email    TEXT NOT NULL,
      customer_name     TEXT NOT NULL,
      subject           TEXT NOT NULL,
      body              TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      ingested_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      triaged_at        TEXT,
      status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','triaged','escalated','resolved','failed')),
      raw_ticket_json   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status     ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_email      ON tickets(customer_email);
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

    CREATE TABLE IF NOT EXISTS triage_results (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id             TEXT NOT NULL REFERENCES tickets(id),
      classification_json   TEXT NOT NULL,
      routing_json          TEXT NOT NULL,
      draft_json            TEXT NOT NULL,
      customer_history_json TEXT,
      kb_articles_json      TEXT,
      applied_rules_json    TEXT,
      tags_json             TEXT,
      urgency_score         INTEGER NOT NULL,
      latency_ms            INTEGER NOT NULL,
      model_id              TEXT NOT NULL,
      triaged_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_triage_ticket_id  ON triage_results(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_triage_triaged_at ON triage_results(triaged_at DESC);

    CREATE TABLE IF NOT EXISTS audit_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      ticket_id     TEXT NOT NULL,
      actor         TEXT NOT NULL,
      action        TEXT NOT NULL,
      before_json   TEXT,
      after_json    TEXT,
      metadata_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_ticket_id ON audit_log(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action);

    CREATE TABLE IF NOT EXISTS customers (
      id                    TEXT PRIMARY KEY,
      email                 TEXT UNIQUE NOT NULL,
      name                  TEXT NOT NULL,
      tier                  TEXT NOT NULL DEFAULT 'free'
                            CHECK(tier IN ('free','pro','enterprise')),
      total_tickets         INTEGER NOT NULL DEFAULT 0,
      open_tickets          INTEGER NOT NULL DEFAULT 0,
      account_age_months    INTEGER NOT NULL DEFAULT 1,
      previous_sentiments   TEXT NOT NULL DEFAULT '[]',
      last_ticket_date      TEXT,
      created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  `);
}
