import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { MetricsSummary } from "../types";

type Window = "last_24h" | "last_7d" | "all_time";

const WINDOWS: Array<{ value: Window; label: string }> = [
  { value: "last_24h", label: "Last 24h" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "all_time", label: "All time" },
];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 text-gray-600 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-gray-500">{value}</span>
    </div>
  );
}

function ms(val: number) {
  return val >= 1000 ? `${(val / 1000).toFixed(1)}s` : `${Math.round(val)}ms`;
}

export default function MetricsDashboard() {
  const [window, setWindow] = useState<Window>("last_24h");
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getMetrics(window)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [window]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Metrics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWindow(w.value)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                window === w.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : data ? (
        <>
          {/* Volume */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Volume</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total" value={data.volume.total} />
              <StatCard label="Triaged" value={data.volume.triaged} />
              <StatCard label="Escalated" value={data.volume.escalated} />
              <StatCard label="Pending" value={data.volume.pending} />
            </div>
          </div>

          {/* Latency */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Triage Latency</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard label="Avg" value={ms(data.latency.avgMs)} />
              <StatCard label="p50" value={ms(data.latency.p50Ms)} />
              <StatCard label="p95" value={ms(data.latency.p95Ms)} />
              <StatCard label="Min" value={ms(data.latency.minMs)} />
              <StatCard label="Max" value={ms(data.latency.maxMs)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">By Category</h2>
              <div className="space-y-2">
                {Object.entries(data.classification.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <BarRow
                      key={cat}
                      label={cat}
                      value={count}
                      max={Math.max(...Object.values(data.classification.byCategory))}
                    />
                  ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex gap-4">
                <span>Avg confidence: {Math.round(data.classification.avgConfidence * 100)}%</span>
                <span>Low confidence: {data.classification.lowConfidenceCount}</span>
                <span>Duplicates: {data.classification.duplicateCount}</span>
              </div>
            </div>

            {/* By Team */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">By Team</h2>
              <div className="space-y-2">
                {Object.entries(data.routing.byTeam)
                  .sort(([, a], [, b]) => b - a)
                  .map(([team, count]) => (
                    <BarRow
                      key={team}
                      label={team}
                      value={count}
                      max={Math.max(...Object.values(data.routing.byTeam))}
                    />
                  ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                Escalation rate: {(data.routing.escalationRate * 100).toFixed(1)}%
              </div>
            </div>

            {/* Sentiment */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Sentiment</h2>
              <div className="space-y-2">
                {Object.entries(data.sentiment.distribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([s, count]) => (
                    <BarRow
                      key={s}
                      label={s}
                      value={count}
                      max={Math.max(...Object.values(data.sentiment.distribution))}
                    />
                  ))}
              </div>
            </div>

            {/* SLA */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">SLA</h2>
              <div className="space-y-3">
                <StatCard label="Breaches" value={data.sla.breachCount} />
                <StatCard label="Breach Rate" value={`${(data.sla.breachRate * 100).toFixed(1)}%`} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
