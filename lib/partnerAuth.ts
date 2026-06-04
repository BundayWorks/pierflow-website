/**
 * Bearer-token auth for the partner-facing /v1 API.
 *
 * Partners authenticate with API keys we issue them (PartnerApiKey
 * table). We never store the raw key — only a SHA-256 hash. Each
 * incoming request:
 *   1. Reads `Authorization: Bearer pf_<live|test>_sk_<random>`
 *   2. Hashes the bearer token
 *   3. Looks up the row by keyHash
 *   4. Returns the Partner + a set of organizationIds the key can act on
 *
 * Errors return a structured 401/403 envelope so partners get a
 * consistent shape across the API.
 */

import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { NextResponse } from "next/server";

export type PartnerSession = {
  partnerId: string;
  partnerName: string;
  /** Organization ids this key is permitted to act on. */
  organizationIds: Set<string>;
  apiKeyId: string;
};

/** Format `pf_<env>_sk_<24-char-base64url>`. */
export function generateApiKey(env: "test" | "live" = "test"): {
  raw: string;
  hash: string;
  last4: string;
} {
  const random = randomBytes(24)
    .toString("base64url")
    .replace(/[_-]/g, "")
    .slice(0, 32);
  const raw = `pf_${env}_sk_${random}`;
  return {
    raw,
    hash: hashKey(raw),
    last4: raw.slice(-4),
  };
}

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Parse the Authorization header and resolve to a PartnerSession.
 * Returns null on any failure; the route handler turns that into a 401.
 */
export async function resolvePartnerSession(
  req: Request,
): Promise<PartnerSession | null> {
  const header = req.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;

  const raw = header.slice(7).trim();
  if (!raw.startsWith("pf_") || raw.length < 16) return null;

  const keyHash = hashKey(raw);
  const apiKey = await db.partnerApiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      partner: {
        select: {
          id: true,
          name: true,
          isActive: true,
          organizationLinks: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!apiKey) return null;
  if (apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  if (!apiKey.partner.isActive) return null;

  // Best-effort lastUsedAt update — fire and forget so we don't slow
  // down hot reads waiting on a write.
  void db.partnerApiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {
      /* swallow */
    });

  return {
    partnerId: apiKey.partner.id,
    partnerName: apiKey.partner.name,
    apiKeyId: apiKey.id,
    organizationIds: new Set(
      apiKey.partner.organizationLinks.map((l) => l.organizationId),
    ),
  };
}

/** Convenience: standard error envelope used by every /v1 route. */
export function unauthorized(message = "UNAUTHENTICATED") {
  return NextResponse.json(
    { error: message },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="pierflow"' },
    },
  );
}

export function forbidden(message = "FORBIDDEN") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "NOT_FOUND") {
  return NextResponse.json({ error: message }, { status: 404 });
}
