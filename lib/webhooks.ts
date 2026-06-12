/**
 * Webhook delivery.
 *
 * Partners register a WebhookEndpoint with a URL, an HMAC secret, and
 * the list of events they want. When we emit an event we POST a signed
 * payload synchronously, with one retry after 30s on any non-2xx.
 *
 * Signature scheme (Stripe-flavoured):
 *
 *   X-Pierflow-Signature: t=<unix>,v1=<hex>
 *
 * where v1 = HMAC-SHA256(secret, "<t>.<body>"). The partner verifies
 * by re-computing v1 from their stored secret and rejecting any
 * payload whose t is older than ~5 minutes (replay protection).
 *
 * The synchronous + 1-retry model is deliberate for MVP. It runs
 * inline in the same Vercel Function instance that completed the
 * underlying job, so we don't have to stand up a queue. Trade-off:
 * a partner endpoint that responds slowly slows our pipeline. We'll
 * swap to a persisted WebhookDelivery + cron worker when volume
 * justifies the complexity.
 */
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

const SIGNATURE_HEADER = "X-Pierflow-Signature";
const USER_AGENT = "Pierflow-Webhooks/1.0";
const RETRY_DELAY_MS = 30_000;
const HTTP_TIMEOUT_MS = 8_000;

export type WebhookEventName =
  // Records API events
  | "processing_job.completed"
  | "processing_job.failed"
  | "import_package.ready"
  // Insurance API events — enrollment lifecycle
  | "hmo_enrollment.created"
  | "hmo_enrollment.identity_verified"
  | "hmo_enrollment.identity_rejected"
  | "hmo_enrollment.payment_received"
  | "hmo_enrollment.submitted_to_hmo"
  | "hmo_enrollment.activated"
  | "hmo_enrollment.hmo_rejected"
  | "hmo_enrollment.cancelled"
  | "hmo_enrollment.failed"
  // Insurance API events — claims lifecycle
  | "hmo_claim.submitted"
  | "hmo_claim.under_review"
  | "hmo_claim.approved"
  | "hmo_claim.rejected"
  | "hmo_claim.paid"
  // HMO network events
  | "hmo.rate_card.updated"
  // Catch-all + test
  | "test.ping";

export type WebhookPayload = {
  event: WebhookEventName;
  emitted_at: string;
  partner_id: string;
  data: unknown;
};

/** Sign a payload string with the endpoint's secret. */
export function signPayload(
  body: string,
  secret: string,
  timestampSec = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac("sha256", secret)
    .update(`${timestampSec}.${body}`)
    .digest("hex");
  return `t=${timestampSec},v1=${v1}`;
}

type DeliveryResult = {
  endpointId: string;
  url: string;
  status: number | null;
  ok: boolean;
  error?: string;
};

async function deliverOnce(
  url: string,
  body: string,
  signature: string,
): Promise<{ status: number; ok: boolean; error?: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: signature,
        "User-Agent": USER_AGENT,
      },
      body,
      signal: ac.signal,
    });
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Emit an event to every active WebhookEndpoint a partner has
 * registered for it. Synchronous: returns after we've attempted
 * delivery (and one retry on failure) for each endpoint.
 *
 * Returns per-endpoint results so callers can log/observe. Never
 * throws — partner endpoints being down should not break our
 * pipeline.
 */
export async function emit(
  partnerId: string,
  event: WebhookEventName,
  data: unknown,
): Promise<DeliveryResult[]> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      partnerId,
      isActive: true,
      // event is in events[] OR endpoint subscribes to all events ("*")
      OR: [{ events: { has: event } }, { events: { has: "*" } }],
    },
    select: { id: true, url: true, secretHash: true },
  });
  if (endpoints.length === 0) return [];

  const payload: WebhookPayload = {
    event,
    emitted_at: new Date().toISOString(),
    partner_id: partnerId,
    data,
  };
  const body = JSON.stringify(payload);

  const results: DeliveryResult[] = [];
  for (const ep of endpoints) {
    const signature = signPayload(body, ep.secretHash);
    let attempt = await deliverOnce(ep.url, body, signature);
    if (!attempt.ok) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      // Re-sign on retry so the timestamp reflects the new attempt
      // (otherwise some partners reject as "too old").
      const retrySig = signPayload(body, ep.secretHash);
      attempt = await deliverOnce(ep.url, body, retrySig);
    }
    results.push({
      endpointId: ep.id,
      url: ep.url,
      status: attempt.status || null,
      ok: attempt.ok,
      error: attempt.error,
    });
  }
  return results;
}

/**
 * Fire-and-forget wrapper. Use from inside the extraction worker so a
 * slow webhook doesn't block job completion.
 *
 * Vercel Fluid Compute keeps the function instance alive past the
 * response, so the work completes asynchronously.
 */
export function emitFireAndForget(
  partnerId: string,
  event: WebhookEventName,
  data: unknown,
): void {
  void emit(partnerId, event, data).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[webhooks] emit failed:", err);
    }
  });
}
