/**
 * Smoke tests for the identity verification service.
 *
 * Pure function exercise — no DB, no NIMC. Verifies:
 *   1. Stub provider returns AUTO_APPROVED at 95 for normal names.
 *   2. The TEST_FAIL magic name returns REJECTED.
 *   3. The TEST_SOFT magic name returns SOFT_REVIEW.
 *   4. Hash + last-4 are produced for NIN and BVN.
 *   5. Encrypt-then-decrypt round-trip recovers the original.
 *   6. Same NIN under same secret produces same hash (dedup).
 *
 * Run: node --experimental-strip-types scripts/test-identity.ts
 */

import {
  verifyIdentity,
  decryptIdentityPayload,
} from "../lib/insurance/identity.ts";

function fail(label: string, detail?: unknown): never {
  console.error(`FAIL ${label}`);
  if (detail !== undefined) console.error(detail);
  process.exit(1);
}

// ── Test 1: Stub returns AUTO_APPROVED ─────────────────────────────

const r1 = await verifyIdentity({
  nin: "12345678901",
  fullName: "Adaeze Margaret Nwosu",
  dateOfBirth: "1985-03-14",
  sex: "F",
});
if (r1.status !== "AUTO_APPROVED") fail("Test 1: expected AUTO_APPROVED", r1);
if (r1.confidence !== 95) fail("Test 1: expected confidence 95", r1.confidence);
if (r1.provider !== "STUB") fail("Test 1: expected STUB provider", r1.provider);
console.log("Test 1 — Stub AUTO_APPROVED at 95 OK");

// ── Test 2: TEST_FAIL magic name → REJECTED ────────────────────────

const r2 = await verifyIdentity({
  nin: "12345678901",
  fullName: "TEST_FAIL synthetic user",
  dateOfBirth: "1985-03-14",
});
if (r2.status !== "REJECTED") fail("Test 2: expected REJECTED", r2);
console.log("Test 2 — TEST_FAIL → REJECTED (confidence 30) OK");

// ── Test 3: TEST_SOFT magic name → SOFT_REVIEW ─────────────────────

const r3 = await verifyIdentity({
  bvn: "22222222222",
  fullName: "TEST_SOFT synthetic user",
  dateOfBirth: "1985-03-14",
});
if (r3.status !== "SOFT_REVIEW")
  fail("Test 3: expected SOFT_REVIEW", r3);
if (r3.confidence !== 70) fail("Test 3: expected confidence 70", r3.confidence);
console.log("Test 3 — TEST_SOFT → SOFT_REVIEW (confidence 70) OK");

// ── Test 4: Hash + last-4 produced for both identifiers ────────────

if (!r1.toPersist.ninHash || r1.toPersist.ninHash.length !== 64) {
  fail("Test 4: ninHash should be 64-char hex", r1.toPersist.ninHash);
}
if (r1.toPersist.ninLast4 !== "8901")
  fail("Test 4: ninLast4 should be 8901", r1.toPersist.ninLast4);
if (r1.toPersist.bvnHash !== null)
  fail("Test 4: bvnHash should be null when bvn absent", r1.toPersist.bvnHash);

if (!r3.toPersist.bvnHash || r3.toPersist.bvnLast4 !== "2222") {
  fail("Test 4: bvn hash + last-4 wrong", r3.toPersist);
}
console.log("Test 4 — Hash + last-4 generated correctly for NIN and BVN OK");

// ── Test 5: Encrypt-then-decrypt round-trip ────────────────────────

const enc = r1.toPersist.encryptedPayload;
if (!enc) fail("Test 5: encryptedPayload should exist", r1.toPersist);
const decoded = decryptIdentityPayload(enc);
if (!decoded || decoded.nin !== "12345678901") {
  fail("Test 5: decrypt should recover original nin", decoded);
}
if (decoded.fullName !== "Adaeze Margaret Nwosu") {
  fail("Test 5: decrypt should recover full name", decoded);
}
console.log("Test 5 — AEAD round-trip recovers plaintext OK");

// ── Test 6: Same NIN under same secret = same hash ─────────────────

const r6a = await verifyIdentity({
  nin: "98765432109",
  fullName: "Other Person",
  dateOfBirth: "1990-01-01",
});
const r6b = await verifyIdentity({
  nin: "98765432109",
  fullName: "Yet Another Spelling",
  dateOfBirth: "1990-01-01",
});
if (r6a.toPersist.ninHash !== r6b.toPersist.ninHash) {
  fail("Test 6: same NIN should hash to same value", {
    r6a: r6a.toPersist.ninHash,
    r6b: r6b.toPersist.ninHash,
  });
}
console.log("Test 6 — Stable hash across calls (dedup-safe) OK");

console.log("\nAll identity tests passed.");
