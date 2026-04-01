import { Router } from "express";
import type Database from "better-sqlite3";
import { computeMetrics } from "../../db/metrics-store";
import { MetricsWindowSchema } from "../schemas";

export function metricsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (req, res, next) => {
    try {
      const { window } = MetricsWindowSchema.parse(req.query);
      const metrics = computeMetrics(db, window);
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
