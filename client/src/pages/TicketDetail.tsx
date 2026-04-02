import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { TicketDetailResponse } from "../types";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState({
    actor: "",
    correctedCategory: "",
    correctedTeam: "",
    correctedEscalate: "",
    notes: "",
  });
  const [fbLoading, setFbLoading] = useState(false);
  const [fbSuccess, setFbSuccess] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getTicket(id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setFbLoading(true);
    setFbError(null);
    try {
      await api.submitFeedback(id, {
        actor: feedback.actor,
        correctedCategory: feedback.correctedCategory || undefined,
        correctedTeam: feedback.correctedTeam || undefined,
        correctedEscalate: feedback.correctedEscalate !== "" ? feedback.correctedEscalate === "true" : undefined,
        notes: feedback.notes || undefined,
      });
      setFbSuccess(true);
      setShowFeedback(false);
    } catch (err) {
      setFbError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFbLoading(false);
    }
  };

  if (loading) return <p className="text-gray-400">Loading…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return null;

  const { ticket, triagedResult: tr, auditLog } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/tickets" className="text-sm text-gray-400 hover:text-gray-600">← Queue</Link>
        <h1 className="text-xl font-bold text-gray-900">{ticket.id}</h1>
      </div>

      {/* Ticket Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">{ticket.subject}</h2>
        <div className="text-sm text-gray-500">{ticket.customerName} &lt;{ticket.customerEmail}&gt;</div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.body}</p>
        <p className="text-xs text-gray-400">{new Date(ticket.createdAt).toLocaleString()}</p>
      </div>

      {/* Triage Result */}
      {tr ? (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Triage Result</h2>
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${priorityColors[tr.classification.priority]}`}>
              {tr.classification.priority}
            </span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 uppercase">
              {tr.classification.category}
            </span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
              {tr.classification.sentiment}
            </span>
            {tr.routing.escalate && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">ESCALATE</span>
            )}
          </div>
          <p className="text-sm text-gray-600">{tr.classification.summary}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-medium text-gray-700">Team:</span> {tr.routing.team}</div>
            <div><span className="font-medium text-gray-700">SLA:</span> {tr.routing.sla.label}</div>
            <div><span className="font-medium text-gray-700">Urgency:</span> {tr.routing.urgencyScore}/100</div>
            <div><span className="font-medium text-gray-700">Confidence:</span> {Math.round(tr.classification.confidence * 100)}%</div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Draft Response</p>
            <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap">{tr.draft.body}</div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          This ticket has not been triaged yet.
        </div>
      )}

      {/* Feedback */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Human Feedback</h2>
          {!showFeedback && !fbSuccess && (
            <button
              onClick={() => setShowFeedback(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Add correction
            </button>
          )}
        </div>
        {fbSuccess && <p className="text-sm text-green-600 mt-2">Feedback submitted.</p>}
        {showFeedback && (
          <form onSubmit={submitFeedback} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Your email (required)</label>
              <input
                type="email"
                required
                value={feedback.actor}
                onChange={(e) => setFeedback({ ...feedback, actor: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correct category</label>
                <select
                  value={feedback.correctedCategory}
                  onChange={(e) => setFeedback({ ...feedback, correctedCategory: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none"
                >
                  <option value="">— no change —</option>
                  {["billing","technical","refund","shipping","account","general"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correct team</label>
                <select
                  value={feedback.correctedTeam}
                  onChange={(e) => setFeedback({ ...feedback, correctedTeam: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none"
                >
                  <option value="">— no change —</option>
                  {["billing-team","tech-support","customer-success","general-support"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Override escalation</label>
              <select
                value={feedback.correctedEscalate}
                onChange={(e) => setFeedback({ ...feedback, correctedEscalate: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none"
              >
                <option value="">— no change —</option>
                <option value="true">Escalate</option>
                <option value="false">Don't escalate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                rows={3}
                value={feedback.notes}
                onChange={(e) => setFeedback({ ...feedback, notes: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none resize-none"
              />
            </div>
            {fbError && <p className="text-xs text-red-600">{fbError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={fbLoading}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {fbLoading ? "Submitting…" : "Submit Feedback"}
              </button>
              <button
                type="button"
                onClick={() => setShowFeedback(false)}
                className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Audit Log */}
      {auditLog.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Audit Log</h2>
          <ol className="relative border-l border-gray-200 space-y-4 ml-2">
            {auditLog.map((ev) => (
              <li key={ev.id} className="ml-4">
                <div className="absolute w-2 h-2 bg-gray-300 rounded-full -left-1 mt-1.5" />
                <p className="text-xs text-gray-400">{new Date(ev.timestamp).toLocaleString()}</p>
                <p className="text-sm font-medium text-gray-700">{ev.action}</p>
                <p className="text-xs text-gray-500">{ev.actor}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
