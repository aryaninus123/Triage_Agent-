import express from "express";
import fs from "fs";
import path from "path";
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

  // Serve React frontend in production
  if (process.env.NODE_ENV === "production") {
    const clientDist = path.resolve(__dirname, "../../client/dist");
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(clientDist, "index.html"));
      });
    }
  }

  app.use(errorHandler);

  return app;
}
