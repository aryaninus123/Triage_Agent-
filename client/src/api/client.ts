import type {
  ListTicketsResponse,
  MetricsSummary,
  TicketDetailResponse,
  TriageResult,
} from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  submitTicket: (data: {
    customerName: string;
    customerEmail: string;
    subject: string;
    body: string;
  }) =>
    request<TriageResult>("/tickets/triage", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listTickets: (params?: { status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return request<ListTicketsResponse>(`/tickets${qs ? `?${qs}` : ""}`);
  },

  getTicket: (id: string) => request<TicketDetailResponse>(`/tickets/${id}`),

  submitFeedback: (
    id: string,
    data: {
      actor: string;
      correctedCategory?: string;
      correctedTeam?: string;
      correctedEscalate?: boolean;
      notes?: string;
    }
  ) =>
    request<{ ok: boolean; ticketId: string }>(`/tickets/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMetrics: (window: "last_24h" | "last_7d" | "all_time" = "last_24h") =>
    request<MetricsSummary>(`/metrics?window=${window}`),
};
