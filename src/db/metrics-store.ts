import type Database from "better-sqlite3";
import type { MetricsSummary } from "../metrics/types";

type Window = "last_24h" | "last_7d" | "all_time";

const WINDOW_SQL: Record<Window, string> = {
  last_24h: "datetime('now', '-24 hours')",
  last_7d: "datetime('now', '-7 days')",
  all_time: "datetime('1970-01-01')",
};

export function computeMetrics(db: Database.Database, window: Window = "last_24h"): MetricsSummary {
  const since = WINDOW_SQL[window];

  // Volume
  const volume = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'triaged' OR status = 'escalated' THEN 1 ELSE 0 END) as triaged,
      SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM tickets
    WHERE created_at >= ${since}
  `).get() as Record<string, number>;

  // Latency from triage_results
  const latencyRows = db.prepare(`
    SELECT latency_ms FROM triage_results
    WHERE triaged_at >= ${since}
    ORDER BY latency_ms ASC
  `).all() as { latency_ms: number }[];

  const latencies = latencyRows.map((r) => r.latency_ms).sort((a, b) => a - b);
  const avgMs = latencies.length
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : 0;
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  // Classification breakdown
  const categoryRows = db.prepare(`
    SELECT json_extract(classification_json, '$.category') as category, COUNT(*) as cnt
    FROM triage_results
    WHERE triaged_at >= ${since}
    GROUP BY category
  `).all() as { category: string; cnt: number }[];

  const byCategory: Record<string, number> = {};
  for (const r of categoryRows) byCategory[r.category] = r.cnt;

  const confRow = db.prepare(`
    SELECT
      AVG(CAST(json_extract(classification_json, '$.confidence') AS REAL)) as avg_conf,
      SUM(CASE WHEN CAST(json_extract(classification_json, '$.confidence') AS REAL) < 0.6 THEN 1 ELSE 0 END) as low_conf,
      SUM(CASE WHEN json_extract(classification_json, '$.isDuplicate') = 1 THEN 1 ELSE 0 END) as dupes
    FROM triage_results
    WHERE triaged_at >= ${since}
  `).get() as { avg_conf: number | null; low_conf: number; dupes: number };

  // Routing breakdown
  const teamRows = db.prepare(`
    SELECT json_extract(routing_json, '$.team') as team, COUNT(*) as cnt
    FROM triage_results
    WHERE triaged_at >= ${since}
    GROUP BY team
  `).all() as { team: string; cnt: number }[];

  const byTeam: Record<string, number> = {};
  for (const r of teamRows) byTeam[r.team] = r.cnt;

  const escalationRow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN json_extract(routing_json, '$.escalate') = 1 THEN 1 ELSE 0 END) as escalated
    FROM triage_results
    WHERE triaged_at >= ${since}
  `).get() as { total: number; escalated: number };

  const escalationRate = escalationRow.total
    ? Math.round((escalationRow.escalated / escalationRow.total) * 1000) / 1000
    : 0;

  const tierEscalationRows = db.prepare(`
    SELECT
      json_extract(customer_history_json, '$.tier') as tier,
      COUNT(*) as total,
      SUM(CASE WHEN json_extract(routing_json, '$.escalate') = 1 THEN 1 ELSE 0 END) as escalated
    FROM triage_results
    WHERE triaged_at >= ${since} AND customer_history_json IS NOT NULL
    GROUP BY tier
  `).all() as { tier: string; total: number; escalated: number }[];

  const escalationByTier: Record<string, number> = {};
  for (const r of tierEscalationRows) {
    escalationByTier[r.tier] = r.total ? Math.round((r.escalated / r.total) * 1000) / 1000 : 0;
  }

  // Sentiment distribution
  const sentimentRows = db.prepare(`
    SELECT json_extract(classification_json, '$.sentiment') as sentiment, COUNT(*) as cnt
    FROM triage_results
    WHERE triaged_at >= ${since}
    GROUP BY sentiment
  `).all() as { sentiment: string; cnt: number }[];

  const sentimentDist: Record<string, number> = {};
  for (const r of sentimentRows) sentimentDist[r.sentiment] = r.cnt;

  // SLA breach — tickets where triage latency exceeded SLA response time
  const slaBreachRow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN
        latency_ms > CASE json_extract(routing_json, '$.sla.responseTimeHours')
          WHEN 1  THEN 3600000
          WHEN 4  THEN 14400000
          WHEN 8  THEN 28800000
          ELSE         86400000
        END
      THEN 1 ELSE 0 END) as breached
    FROM triage_results
    WHERE triaged_at >= ${since}
  `).get() as { total: number; breached: number };

  const breachRate = slaBreachRow.total
    ? Math.round((slaBreachRow.breached / slaBreachRow.total) * 1000) / 1000
    : 0;

  return {
    window,
    generatedAt: new Date().toISOString(),
    volume: {
      total: volume.total ?? 0,
      triaged: volume.triaged ?? 0,
      escalated: volume.escalated ?? 0,
      pending: volume.pending ?? 0,
    },
    latency: {
      avgMs,
      p50Ms: p50,
      p95Ms: p95,
      minMs: latencies[0] ?? 0,
      maxMs: latencies[latencies.length - 1] ?? 0,
    },
    classification: {
      byCategory,
      avgConfidence: confRow.avg_conf !== null ? Math.round(confRow.avg_conf * 100) / 100 : 0,
      lowConfidenceCount: confRow.low_conf ?? 0,
      duplicateCount: confRow.dupes ?? 0,
    },
    routing: {
      byTeam,
      escalationRate,
      escalationByTier,
    },
    sla: {
      breachCount: slaBreachRow.breached ?? 0,
      breachRate,
    },
    sentiment: {
      distribution: sentimentDist,
    },
  };
}
