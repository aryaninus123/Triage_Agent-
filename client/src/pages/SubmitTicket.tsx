import { useState } from "react";
import { api } from "../api/client";
import type { TriageResult } from "../types";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const sentimentColors: Record<string, string> = {
  positive: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-700",
  frustrated: "bg-orange-100 text-orange-700",
  angry: "bg-red-100 text-red-700",
};

export default function SubmitTicket() {
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    subject: "",
    body: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.submitTicket(form);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Submit Ticket</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
            <input
              type="email"
              required
              value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            required
            rows={5}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Triaging with AI…
            </>
          ) : (
            "Submit & Triage"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Triage Result — {result.ticket.id}</h2>

          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${priorityColors[result.classification.priority]}`}>
                {result.classification.priority}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                {result.classification.category}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${sentimentColors[result.classification.sentiment]}`}>
                {result.classification.sentiment}
              </span>
              {result.routing.escalate && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">ESCALATE</span>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">Summary</p>
              <p className="text-sm text-gray-600 mt-1">{result.classification.summary}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">Routed to</p>
                <p className="text-gray-600">{result.routing.team}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">SLA</p>
                <p className="text-gray-600">{result.routing.sla.label}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Urgency Score</p>
                <p className="text-gray-600">{result.routing.urgencyScore}/100</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Confidence</p>
                <p className="text-gray-600">{Math.round(result.classification.confidence * 100)}%</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">Draft Response</p>
              <div className="mt-2 bg-gray-50 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {result.draft.body}
              </div>
            </div>

            {result.kbArticles && result.kbArticles.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700">Related KB Articles</p>
                <ul className="mt-1 space-y-1">
                  {result.kbArticles.map((a) => (
                    <li key={a.id} className="text-sm text-blue-600 hover:underline">
                      <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
