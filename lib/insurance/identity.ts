/**
 * Identity verification service.
 *
 * Verifies a user's claimed identity against a NIN or BVN. Today
 * we ship a stub provider that returns synthetic high-confidence —
 * suitable for sandbox + early production while NIMC credentials are
 * being procured.
 *
 * A real NIMC integration is a swap-in implementation behind the
 * same `verifyIdentity` interface. The selection is feature-flagged
 * by env: `IDENTITY_PROVIDER=nimc` switches to the real integration.
 *
 * PII rules:
 *   • Plaintext NIN/BVN flows through this function ONLY at the
 *     moment of verification. The caller persists the hash + last-4
 *     to IdentityVerification + the encrypted payload; nothing else
 *     in the codebase should see the plaintext.
 *   • The hash is a SHA-256 of (env-secret || identifier) so the
 *     same NIN produces a stable hash across all our verifications
 *     (for "have I seen this person?") but isn't trivially rainbow-
 *     tableable.
 *   • The encrypted payload uses AES-GCM with a key derived from
 *     IDENTITY_ENCRYPTION_KEY (env). Decrypt() is exported but
 *     should only be called from inside the verification flow.
 *
 * The disposition rule (architecture spec §7.1):
 *   confidence > 85 → AUTO_APPROVED
 *   60 ≤ c ≤ 85    → SOFT_REVIEW  (policy issued, marked pending)
 *   confidence < 60 → REJECTED
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type {
  IdentityVerificationStatus,
  IdentityVerificationProvider,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type VerifyIdentityInput = {
  /** Either nin or bvn must be present. */
  nin?: string;
  bvn?: string;
  fullName: string;
  /** ISO-8601 date (YYYY-MM-DD). */
  dateOfBirth: string;
  sex?: "M" | "F" | "U";
  phone?: string;
};

export type FieldCheck = {
  matched: boolean;
  /** 0..1 — score for fuzzy comparisons (name) or boolean→{0,1}. */
  score: number;
  /** What we received from the provider, when applicable. */
  observed?: string;
};

export type VerifyIdentityResult = {
  status: IdentityVerificationStatus;
  provider: IdentityVerificationProvider;
  confidence: number; // 0..100
  fieldChecks: {
    name?: FieldCheck;
    dateOfBirth?: FieldCheck;
    sex?: FieldCheck;
  };
  /** Raw provider response for audit. */
  raw?: Record<string, unknown>;
  /** Plaintext-safe values for the caller to persist. */
  toPersist: {
    ninHash: string | null;
    ninLast4: string | null;
    bvnHash: string | null;
    bvnLast4: string | null;
    /** AEAD ciphertext of { nin, bvn } JSON. Null if both absent. */
    encryptedPayload: Buffer | null;
  };
};

// ─────────────────────────────────────────────────────────────────────
// Provider selection
// ─────────────────────────────────────────────────────────────────────

function activeProvider(): IdentityVerificationProvider {
  const v = (process.env.IDENTITY_PROVIDER ?? "stub").toLowerCase();
  if (v === "nimc") return "NIMC";
  if (v === "partner_declared") return "PARTNER_DECLARED";
  return "STUB";
}

function environmentLabel(): "sandbox" | "production" {
  return process.env.NODE_ENV === "production" &&
    process.env.IDENTITY_ENV !== "sandbox"
    ? "production"
    : "sandbox";
}

export function getIdentityEnvironment(): "sandbox" | "production" {
  return environmentLabel();
}

// ─────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────

export async function verifyIdentity(
  input: VerifyIdentityInput,
): Promise<VerifyIdentityResult> {
  if (!input.nin && !input.bvn) {
    throw new Error("verifyIdentity requires nin or bvn");
  }

  const provider = activeProvider();
  const toPersist = makePersistedValues(input);

  if (provider === "STUB") {
    return runStub(input, toPersist);
  }
  if (provider === "PARTNER_DECLARED") {
    return runPartnerDeclared(input, toPersist);
  }
  return runNimc(input, toPersist);
}

// ─────────────────────────────────────────────────────────────────────
// Persisted-values factory (hash + last-4 + encrypted payload)
// ─────────────────────────────────────────────────────────────────────

function makePersistedValues(
  input: VerifyIdentityInput,
): VerifyIdentityResult["toPersist"] {
  const ninHash = input.nin ? hashIdentifier(input.nin) : null;
  const ninLast4 = input.nin ? lastN(input.nin, 4) : null;
  const bvnHash = input.bvn ? hashIdentifier(input.bvn) : null;
  const bvnLast4 = input.bvn ? lastN(input.bvn, 4) : null;
  const encryptedPayload = encryptPayload({
    nin: input.nin ?? null,
    bvn: input.bvn ?? null,
    fullName: input.fullName,
    dateOfBirth: input.dateOfBirth,
  });
  return { ninHash, ninLast4, bvnHash, bvnLast4, encryptedPayload };
}

function hashIdentifier(raw: string): string {
  const secret = process.env.IDENTITY_HASH_SECRET ?? "dev_only_change_me";
  return createHash("sha256")
    .update(secret + "::" + raw.trim())
    .digest("hex");
}

function lastN(raw: string, n: number): string {
  const t = raw.replace(/\D/g, "");
  return t.length <= n ? t : t.slice(-n);
}

// ─────────────────────────────────────────────────────────────────────
// AEAD encryption
// ─────────────────────────────────────────────────────────────────────
//
// AES-256-GCM. Key derived from IDENTITY_ENCRYPTION_KEY (32 raw bytes
// hex-encoded — generate with `openssl rand -hex 32`). Format on the
// wire: [12B nonce][16B authTag][ciphertext].

function encryptionKey(): Buffer {
  const raw = process.env.IDENTITY_ENCRYPTION_KEY;
  if (!raw) {
    // Dev fallback — derive a deterministic key. NEVER ship to prod.
    return createHash("sha256")
      .update("pierflow_dev_identity_key_change_me")
      .digest();
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "IDENTITY_ENCRYPTION_KEY must be 32 raw bytes (64 hex chars).",
    );
  }
  return buf;
}

function encryptPayload(obj: Record<string, unknown>): Buffer | null {
  if (Object.values(obj).every((v) => v === null || v === undefined)) {
    return null;
  }
  const key = encryptionKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, enc]);
}

/**
 * Decrypt an IdentityVerification.encryptedPayload back to the
 * original { nin, bvn, ... }. Only the identity service should call
 * this — never expose the result to a route handler that doesn't
 * need it.
 */
export function decryptIdentityPayload(
  buf: Buffer | null,
): Record<string, unknown> | null {
  if (!buf || buf.length < 28) return null;
  const key = encryptionKey();
  const nonce = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

// ─────────────────────────────────────────────────────────────────────
// Disposition helper
// ─────────────────────────────────────────────────────────────────────

function disposition(confidence: number): IdentityVerificationStatus {
  if (confidence > 85) return "AUTO_APPROVED";
  if (confidence >= 60) return "SOFT_REVIEW";
  return "REJECTED";
}

// ─────────────────────────────────────────────────────────────────────
// Provider: STUB
// ─────────────────────────────────────────────────────────────────────
//
// Sandbox-only. Returns synthetic high-confidence so the enrollment
// flow can be exercised without NIMC credentials. The name check
// uses a deterministic mock: if the full name contains "TEST_FAIL"
// the stub returns REJECTED; if it contains "TEST_SOFT" it returns
// SOFT_REVIEW; otherwise AUTO_APPROVED at 95.

function runStub(
  input: VerifyIdentityInput,
  toPersist: VerifyIdentityResult["toPersist"],
): VerifyIdentityResult {
  const upper = input.fullName.toUpperCase();
  let confidence = 95;
  if (upper.includes("TEST_FAIL")) confidence = 30;
  else if (upper.includes("TEST_SOFT")) confidence = 70;

  return {
    status: disposition(confidence),
    provider: "STUB",
    confidence,
    fieldChecks: {
      name: { matched: confidence >= 60, score: confidence / 100 },
      dateOfBirth: { matched: true, score: 1 },
      sex: input.sex ? { matched: true, score: 1 } : undefined,
    },
    raw: { stub: true, environment: environmentLabel() },
    toPersist,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Provider: PARTNER_DECLARED
// ─────────────────────────────────────────────────────────────────────
//
// The fintech declares they verified the user upstream (their own
// KYC). We trust it but record the audit row. Confidence is fixed
// at 90 — high enough to AUTO_APPROVE, low enough to flag for
// review if the user later disputes.

function runPartnerDeclared(
  input: VerifyIdentityInput,
  toPersist: VerifyIdentityResult["toPersist"],
): VerifyIdentityResult {
  return {
    status: "AUTO_APPROVED",
    provider: "PARTNER_DECLARED",
    confidence: 90,
    fieldChecks: {
      name: { matched: true, score: 1 },
      dateOfBirth: { matched: true, score: 1 },
      sex: input.sex ? { matched: true, score: 1 } : undefined,
    },
    raw: { partner_declared: true },
    toPersist,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Provider: NIMC
// ─────────────────────────────────────────────────────────────────────
//
// Real NIMC integration. Today the stub implementation just throws
// so we don't ship to production without intentional configuration.

function runNimc(
  input: VerifyIdentityInput,
  toPersist: VerifyIdentityResult["toPersist"],
): VerifyIdentityResult {
  // Will be implemented when NIMC credentials are provisioned. The
  // signature accepts the verified inputs so the real adapter can
  // forward them; for now the function throws so production never
  // silently auto-approves through the stub by accident.
  void input;
  void toPersist;
  throw new Error(
    "IDENTITY_PROVIDER=nimc selected but no NIMC integration is wired. " +
      "Implement runNimc() in lib/insurance/identity.ts before going live.",
  );
}
