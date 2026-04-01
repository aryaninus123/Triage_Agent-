import "dotenv/config";
import { validateEnv } from "../config-validation/env";
import { createConfig } from "../config";
import { initDb, closeDb } from "../db/database";
import { loadWebhooks, registerWebhookListeners } from "../events/webhook-dispatcher";
import { eventBus } from "../events/event-bus";
import { createApp } from "./app";

// Validate env vars — exits with clear error if misconfigured
const env = validateEnv();

const config = createConfig({
  model: "claude-opus-4-6",
  maxTokens: env.MAX_TOKENS,
  logTiming: env.LOG_TIMING,
  enableKBSearch: env.ENABLE_KB_SEARCH,
  enableCustomerHistory: env.ENABLE_CUSTOMER_HISTORY,
});

const db = initDb(env.DB_PATH);

// Register webhook listeners from config/webhooks.json
const webhooks = loadWebhooks();
if (webhooks.length > 0) {
  registerWebhookListeners(eventBus, webhooks);
  console.log(`[Webhooks] Registered ${webhooks.length} webhook(s)`);
}

let shuttingDown = false;
const app = createApp(db, config, () => shuttingDown);

const server = app.listen(env.PORT, () => {
  console.log(`\nSupport Triage Agent — HTTP server listening on port ${env.PORT}`);
  console.log(`  Model  : ${config.model}`);
  console.log(`  DB     : ${env.DB_PATH}`);
  console.log(`  Env    : ${env.NODE_ENV}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST   http://localhost:${env.PORT}/tickets/triage`);
  console.log(`  GET    http://localhost:${env.PORT}/tickets`);
  console.log(`  GET    http://localhost:${env.PORT}/tickets/:id`);
  console.log(`  POST   http://localhost:${env.PORT}/tickets/:id/feedback`);
  console.log(`  GET    http://localhost:${env.PORT}/metrics?window=last_24h|last_7d|all_time`);
  console.log(`  GET    http://localhost:${env.PORT}/health\n`);
});

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(() => {
    closeDb();
    console.log("Shutdown complete.");
    process.exit(0);
  });

  // Force exit after 10s if requests don't drain
  setTimeout(() => {
    console.error("Shutdown timeout — forcing exit.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
