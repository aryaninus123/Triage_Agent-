import crypto from "crypto";
import fs from "fs";
import path from "path";
import { z } from "zod";
import type { TriageEvent, TriageEventName } from "./types";
import type { TriageEventBus } from "./event-bus";

const WebhookConfigSchema = z.object({
  event: z.union([
    z.enum([
      "ticket.triaged",
      "ticket.escalated",
      "ticket.routed",
      "ticket.sla_warning",
      "ticket.feedback_received",
      "rule.matched",
      "*",
    ]),
    z.literal("*"),
  ]),
  url: z.string().url(),
  secret: z.string().optional(),
});

const WebhooksFileSchema = z.array(WebhookConfigSchema);
type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

function signPayload(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function dispatchWebhook(webhook: WebhookConfig, event: TriageEvent): Promise<void> {
  const payload = JSON.stringify(event);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Triage-Event": event.name,
    "X-Triage-Delivery": event.id,
  };
  if (webhook.secret) {
    headers["X-Triage-Signature"] = signPayload(payload, webhook.secret);
  }

  try {
    const res = await fetch(webhook.url, { method: "POST", headers, body: payload });
    if (!res.ok) {
      console.warn(`[Webhook] ${event.name} → ${webhook.url} responded ${res.status}`);
    }
  } catch (err) {
    console.warn(`[Webhook] ${event.name} → ${webhook.url} failed:`, (err as Error).message);
  }
}

export function loadWebhooks(webhooksPath?: string): WebhookConfig[] {
  const resolvedPath = webhooksPath ?? path.join(process.cwd(), "config", "webhooks.json");
  if (!fs.existsSync(resolvedPath)) return [];

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  const parsed = WebhooksFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[Webhook] Invalid webhooks.json:", parsed.error.flatten());
    return [];
  }
  return parsed.data;
}

export function registerWebhookListeners(bus: TriageEventBus, webhooks: WebhookConfig[]): void {
  for (const webhook of webhooks) {
    const eventName = webhook.event as TriageEventName | "*";
    bus.on(eventName, (event: TriageEvent) => {
      void dispatchWebhook(webhook, event);
    });
  }
}
