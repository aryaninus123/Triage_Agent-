export interface MetricsSummary {
  window: "last_24h" | "last_7d" | "all_time";
  generatedAt: string;
  volume: {
    total: number;
    triaged: number;
    escalated: number;
    pending: number;
  };
  latency: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    minMs: number;
    maxMs: number;
  };
  classification: {
    byCategory: Record<string, number>;
    avgConfidence: number;
    lowConfidenceCount: number;
    duplicateCount: number;
  };
  routing: {
    byTeam: Record<string, number>;
    escalationRate: number;
    escalationByTier: Record<string, number>;
  };
  sla: {
    breachCount: number;
    breachRate: number;
  };
  sentiment: {
    distribution: Record<string, number>;
  };
}
