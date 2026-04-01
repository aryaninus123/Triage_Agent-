import express from "express";
import type Database from "better-sqlite3";
import type { AgentConfig } from "../types";
import { errorHandler } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";
import { healthRouter } from "./routes/health";
import { metricsRouter } from "./routes/metrics";
import { ticketsRouter } from "./routes/tickets";

export function createApp(
  db: Database.Database,
  config: AgentConfig,
  isShuttingDown: () => boolean
): express.Application {
  const app = express();

  app.use(express.json({ limit: "512kb" }));
  app.use(requestId());

  // Reject requests when draining
  app.use((_req, res, next) => {
    if (isShuttingDown()) {
      res.setHeader("Connection", "close");
      res.status(503).json({ error: "Server is shutting down" });
      return;
    }
    next();
  });

  app.use("/health", healthRouter(db, isShuttingDown));
  app.use("/metrics", metricsRouter(db));
  app.use("/tickets", ticketsRouter(db, config));

  app.use(errorHandler);

  return app;
}
