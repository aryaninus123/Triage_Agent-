import { Router } from "express";
import type Database from "better-sqlite3";

export function healthRouter(db: Database.Database, isShuttingDown: () => boolean): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    if (isShuttingDown()) {
      res.status(503).json({ status: "shutting_down" });
      return;
    }

    try {
      // Lightweight DB connectivity check
      db.prepare("SELECT 1").get();
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    } catch {
      res.status(503).json({ status: "db_unavailable" });
    }
  });

  return router;
}
