"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePartnerUser } from "@/lib/auth";
import { emit, type WebhookEventName } from "@/lib/webhooks";

const ALL_EVENTS: WebhookEventName[] = [
  "processing_job.completed",
  "processing_job.failed",
  "import_package.ready",
];

/* ── List ─────────────────────────────────────────────────────── */

export async function listMyEndpoints() {
  const { partner } = await requirePartnerUser();
  return db.webhookEndpoint.findMany({
    where: { partnerId: partner.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
  });
}

/* ── Register ─────────────────────────────────────────────────── */

const RegisterInput = z.object({
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith("https://"), {
      message: "Webhook URL must use https://",
    }),
  events: z.array(z.string()).min(1).optional(),
});

export async function registerEndpoint(input: z.infer<typeof RegisterInput>) {
  const { partner } = await requirePartnerUser();
  if (partner.accessStatus !== "SANDBOX" && partner.accessStatus !== "PRODUCTION") {
    throw new Error("PARTNER_NOT_APPROVED");
  }
  const parsed = RegisterInput.parse(input);

  // 32-byte random secret, base64url-encoded so it's safe to copy/paste.
  // Returned to the partner once and never shown again.
  const secret = randomBytes(32).toString("base64url");

  const events = parsed.events && parsed.events.length > 0
    ? parsed.events.filter((e): e is WebhookEventName =>
        ALL_EVENTS.includes(e as WebhookEventName),
      )
    : ALL_EVENTS;

  const endpoint = await db.webhookEndpoint.create({
    data: {
      partnerId: partner.id,
      url: parsed.url,
      secretHash: secret,
      events,
      isActive: true,
    },
    select: { id: true, url: true, events: true },
  });

  revalidatePath("/portal/webhooks");
  return { ok: true, endpoint, secret };
}

/* ── Disable / re-enable / delete ─────────────────────────────── */

export async function setEndpointActive(input: {
  endpointId: string;
  active: boolean;
}) {
  const { partner } = await requirePartnerUser();
  const row = await db.webhookEndpoint.findFirst({
    where: { id: input.endpointId, partnerId: partner.id },
    select: { id: true },
  });
  if (!row) throw new Error("ENDPOINT_NOT_FOUND");
  await db.webhookEndpoint.update({
    where: { id: row.id },
    data: { isActive: input.active },
  });
  revalidatePath("/portal/webhooks");
  return { ok: true };
}

export async function deleteEndpoint(input: { endpointId: string }) {
  const { partner } = await requirePartnerUser();
  const row = await db.webhookEndpoint.findFirst({
    where: { id: input.endpointId, partnerId: partner.id },
    select: { id: true },
  });
  if (!row) throw new Error("ENDPOINT_NOT_FOUND");
  await db.webhookEndpoint.delete({ where: { id: row.id } });
  revalidatePath("/portal/webhooks");
  return { ok: true };
}

/* ── Test ping ────────────────────────────────────────────────── */

export async function sendTestPing() {
  const { partner } = await requirePartnerUser();
  const results = await emit(partner.id, "test.ping", {
    note: "If you received this, your endpoint is wired up correctly.",
  });
  return {
    deliveries: results.map((r) => ({
      endpointId: r.endpointId,
      url: r.url,
      status: r.status,
      ok: r.ok,
      error: r.error ?? null,
    })),
  };
}
