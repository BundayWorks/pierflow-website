/**
 * Pierflow ledger.
 *
 * Independent double-entry record of every settlement instruction
 * we've issued and every executed report the fintech has sent back.
 *
 *   • INSTRUCTED entries — written when we tell the fintech to
 *     credit a set of parties (typically when an enrollment goes
 *     ACTIVE). Balanced: the user-wallet debit + each party credit
 *     sum to zero per correlationId.
 *
 *   • EXECUTED entries — written when the fintech reports back
 *     what they actually credited. Also balanced.
 *
 *   • Reconciliation (separate module) walks the two sides per
 *     correlationId and flags any net delta.
 *
 * Account scope: (partner × role × settlementTag). One LedgerAccount
 * per tuple; auto-created on first use via getOrCreateAccount.
 *
 * Money is BigInt minor units throughout. Signed: credits to parties
 * are positive, the user-wallet debit is the negative counter-entry.
 */

import { Prisma, type LedgerAccountRole, type LedgerEntryKind } from "@prisma/client";
import { db } from "@/lib/db";

const ZERO = BigInt(0);

// ─────────────────────────────────────────────────────────────────────
// Account resolution
// ─────────────────────────────────────────────────────────────────────

/**
 * Look up or create the LedgerAccount for a (partner, role, tag)
 * tuple. The same tuple always resolves to the same account row.
 *
 * Multi-tenancy: the partner is always the fintech where the funds
 * physically sit. Even though an HMO is the eventual recipient, the
 * money lives at the fintech until it's swept — so the account is
 * keyed by the fintech, not the HMO.
 */
export async function getOrCreateAccount(input: {
  partnerId: string;
  role: LedgerAccountRole;
  settlementTag: string | null;
  displayName?: string;
}): Promise<{ id: string }> {
  // Prisma's findOrCreate behaviour via upsert. The compound-unique
  // type marks settlementTag as required-string even though the column
  // is nullable; cast the where-key payload through unknown to permit
  // the null lookup.
  const account = await db.ledgerAccount.upsert({
    where: {
      partnerId_role_settlementTag: {
        partnerId: input.partnerId,
        role: input.role,
        settlementTag: input.settlementTag,
      } as unknown as {
        partnerId: string;
        role: LedgerAccountRole;
        settlementTag: string;
      },
    },
    update: {},
    create: {
      partnerId: input.partnerId,
      role: input.role,
      settlementTag: input.settlementTag,
      displayName:
        input.displayName ??
        `${input.role}${input.settlementTag ? ` (${input.settlementTag})` : ""}`,
    },
    select: { id: true },
  });
  return account;
}

// ─────────────────────────────────────────────────────────────────────
// Writing entries
// ─────────────────────────────────────────────────────────────────────

/**
 * Shape of one party line in the splits_snapshot we already store on
 * HmoEnrollment. Mirrors lib/insurance/quotes.ts summariseSplits().
 */
type SnapshotLine = {
  role: string;
  amount_ngn: string;
  settlement_tag: string | null;
  is_remainder?: boolean;
};

type SnapshotShape = {
  mode: string;
  wholesale_ngn: string;
  markup_ngn: string;
  member_pays_ngn: string;
  hmo_line: {
    role: string;
    amount_ngn: string;
    settlement_tag: string | null;
  };
  lines: SnapshotLine[];
};

/**
 * Write the INSTRUCTED set for an enrollment that just went ACTIVE.
 * Idempotent — if INSTRUCTED entries already exist for this
 * correlationId, returns without writing duplicates.
 *
 * Invariant: sum of `amountNgn` across the written entries is exactly
 * zero. We refuse to write a mis-balanced set.
 *
 * Logic:
 *   • HMO line — credit (positive) at the HMO account.
 *   • Each party line — credit (positive) at the per-party account.
 *   • USER account — debit (negative) for the full memberPays.
 */
export async function writeInstructedFromEnrollment(input: {
  enrollmentId: string;
  partnerId: string;
  splitsSnapshot: SnapshotShape;
}): Promise<
  | { ok: true; entryIds: string[]; alreadyWritten: boolean }
  | { ok: false; reason: "BALANCE_VIOLATION" | "INVALID_SNAPSHOT"; detail?: string }
> {
  const snap = input.splitsSnapshot;
  if (!snap || !snap.lines || !snap.member_pays_ngn) {
    return { ok: false, reason: "INVALID_SNAPSHOT" };
  }

  // Idempotency check.
  const existing = await db.ledgerEntry.findFirst({
    where: {
      correlationId: input.enrollmentId,
      kind: "INSTRUCTED",
    },
    select: { id: true },
  });
  if (existing) {
    const all = await db.ledgerEntry.findMany({
      where: { correlationId: input.enrollmentId, kind: "INSTRUCTED" },
      select: { id: true },
    });
    return { ok: true, entryIds: all.map((e) => e.id), alreadyWritten: true };
  }

  // Build the entries: HMO credit + each party credit + USER debit.
  type EntryDraft = {
    accountId: string;
    amountNgn: bigint;
  };
  const drafts: EntryDraft[] = [];

  // HMO line — credit. The HMO doesn't have a settlement_tag on its
  // own line (the fintech routes wholesale per HmoProvider settings).
  const hmoAmount = BigInt(snap.hmo_line.amount_ngn);
  if (hmoAmount > ZERO) {
    const hmoAccount = await getOrCreateAccount({
      partnerId: input.partnerId,
      role: "HMO",
      settlementTag: snap.hmo_line.settlement_tag ?? null,
      displayName: snap.hmo_line.settlement_tag
        ? `HMO ${snap.hmo_line.settlement_tag}`
        : "HMO",
    });
    drafts.push({ accountId: hmoAccount.id, amountNgn: hmoAmount });
  }

  for (const line of snap.lines) {
    const amt = BigInt(line.amount_ngn);
    if (amt === ZERO) continue;
    const account = await getOrCreateAccount({
      partnerId: input.partnerId,
      role: line.role as LedgerAccountRole,
      settlementTag: line.settlement_tag ?? null,
      displayName: line.settlement_tag
        ? `${line.role} ${line.settlement_tag}`
        : String(line.role),
    });
    drafts.push({ accountId: account.id, amountNgn: amt });
  }

  // User-wallet debit — counter-entry that makes everything sum to 0.
  const partyTotal = drafts.reduce((acc, d) => acc + d.amountNgn, ZERO);
  const memberPays = BigInt(snap.member_pays_ngn);
  if (partyTotal !== memberPays) {
    return {
      ok: false,
      reason: "BALANCE_VIOLATION",
      detail: `Party credits sum to ${partyTotal} but snapshot.member_pays_ngn = ${memberPays}. Snapshot is internally inconsistent.`,
    };
  }
  const userAccount = await getOrCreateAccount({
    partnerId: input.partnerId,
    role: "USER",
    settlementTag: null,
    displayName: "User wallet",
  });
  drafts.push({ accountId: userAccount.id, amountNgn: -memberPays });

  // Final invariant check — should be zero by construction.
  const sum = drafts.reduce((acc, d) => acc + d.amountNgn, ZERO);
  if (sum !== ZERO) {
    return {
      ok: false,
      reason: "BALANCE_VIOLATION",
      detail: `Internal error: drafts sum to ${sum}, not 0.`,
    };
  }

  // Persist atomically.
  const created = await db.$transaction(
    drafts.map((d) =>
      db.ledgerEntry.create({
        data: {
          accountId: d.accountId,
          kind: "INSTRUCTED",
          source: "ENROLLMENT_FIRST_PREMIUM",
          amountNgn: d.amountNgn,
          correlationId: input.enrollmentId,
          enrollmentId: input.enrollmentId,
        },
        select: { id: true },
      }),
    ),
  );
  return { ok: true, entryIds: created.map((e) => e.id), alreadyWritten: false };
}

// ─────────────────────────────────────────────────────────────────────
// Executed-report ingestion
// ─────────────────────────────────────────────────────────────────────

/**
 * Shape the fintech sends on POST /payment-received when they want
 * to report executed credits inline. Each entry says "I credited
 * this much to this party at this tag." Sum across reports + the
 * negative user-wallet debit we compute must be zero.
 */
export type ExecutedReportLine = {
  role: LedgerAccountRole;
  settlement_tag: string | null;
  amount_ngn: bigint;
};

/**
 * Persist an EXECUTED set for an enrollment. Idempotent — if EXECUTED
 * entries already exist for this correlationId we return without
 * writing duplicates (this matches /payment-received being safely
 * re-callable).
 *
 * Invariant: entries (party credits + the implied USER debit) sum to
 * zero. We compute the USER debit as -sum(reports) so the caller
 * doesn't have to send it.
 */
export async function writeExecutedFromReport(input: {
  enrollmentId: string;
  partnerId: string;
  reports: ExecutedReportLine[];
}): Promise<
  | { ok: true; entryIds: string[]; alreadyWritten: boolean }
  | { ok: false; reason: "BALANCE_VIOLATION" | "EMPTY_REPORT"; detail?: string }
> {
  if (input.reports.length === 0) {
    return { ok: false, reason: "EMPTY_REPORT" };
  }
  const existing = await db.ledgerEntry.findFirst({
    where: { correlationId: input.enrollmentId, kind: "EXECUTED" },
    select: { id: true },
  });
  if (existing) {
    const all = await db.ledgerEntry.findMany({
      where: { correlationId: input.enrollmentId, kind: "EXECUTED" },
      select: { id: true },
    });
    return { ok: true, entryIds: all.map((e) => e.id), alreadyWritten: true };
  }

  type EntryDraft = { accountId: string; amountNgn: bigint };
  const drafts: EntryDraft[] = [];
  let total = ZERO;

  for (const r of input.reports) {
    if (r.amount_ngn === ZERO) continue;
    if (r.amount_ngn < ZERO) {
      return {
        ok: false,
        reason: "BALANCE_VIOLATION",
        detail: `Executed report for ${r.role} has negative amount; should be positive (credit).`,
      };
    }
    const account = await getOrCreateAccount({
      partnerId: input.partnerId,
      role: r.role,
      settlementTag: r.settlement_tag ?? null,
    });
    drafts.push({ accountId: account.id, amountNgn: r.amount_ngn });
    total += r.amount_ngn;
  }
  if (total === ZERO) {
    return { ok: false, reason: "EMPTY_REPORT" };
  }
  const userAccount = await getOrCreateAccount({
    partnerId: input.partnerId,
    role: "USER",
    settlementTag: null,
    displayName: "User wallet",
  });
  drafts.push({ accountId: userAccount.id, amountNgn: -total });

  const created = await db.$transaction(
    drafts.map((d) =>
      db.ledgerEntry.create({
        data: {
          accountId: d.accountId,
          kind: "EXECUTED",
          source: "ENROLLMENT_FIRST_PREMIUM",
          amountNgn: d.amountNgn,
          correlationId: input.enrollmentId,
          enrollmentId: input.enrollmentId,
        },
        select: { id: true },
      }),
    ),
  );
  return { ok: true, entryIds: created.map((e) => e.id), alreadyWritten: false };
}

// ─────────────────────────────────────────────────────────────────────
// Read paths (for reconciliation + portal)
// ─────────────────────────────────────────────────────────────────────

export async function getEntriesByCorrelation(
  correlationId: string,
  kind?: LedgerEntryKind,
) {
  return db.ledgerEntry.findMany({
    where: { correlationId, ...(kind ? { kind } : {}) },
    include: { account: true },
    orderBy: { occurredAt: "asc" },
  });
}

/**
 * Net balance per account for a correlation. Used by reconciliation
 * to compare INSTRUCTED vs EXECUTED side-by-side.
 *
 * Returns a map keyed by accountId → { instructed, executed, delta }
 * where delta = instructed - executed (positive = under-paid).
 */
export async function netByAccountForCorrelation(
  correlationId: string,
): Promise<
  {
    accountId: string;
    displayName: string;
    role: LedgerAccountRole;
    settlementTag: string | null;
    instructed: bigint;
    executed: bigint;
    delta: bigint;
  }[]
> {
  const entries = await getEntriesByCorrelation(correlationId);
  const map = new Map<
    string,
    {
      accountId: string;
      displayName: string;
      role: LedgerAccountRole;
      settlementTag: string | null;
      instructed: bigint;
      executed: bigint;
    }
  >();
  for (const e of entries) {
    const k = e.accountId;
    let row = map.get(k);
    if (!row) {
      row = {
        accountId: e.accountId,
        displayName: e.account.displayName,
        role: e.account.role,
        settlementTag: e.account.settlementTag,
        instructed: ZERO,
        executed: ZERO,
      };
      map.set(k, row);
    }
    if (e.kind === "INSTRUCTED") row.instructed += e.amountNgn;
    else if (e.kind === "EXECUTED") row.executed += e.amountNgn;
  }
  return Array.from(map.values()).map((r) => ({
    ...r,
    delta: r.instructed - r.executed,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Manual staff adjustments
// ─────────────────────────────────────────────────────────────────────

/**
 * Apply a staff-initiated adjustment to a specific account. Used
 * during dispute resolution. Writes a single ADJUSTMENT entry; this
 * is intentionally not balanced (it's a one-sided correction).
 */
export async function writeAdjustment(input: {
  accountId: string;
  amountNgn: bigint;
  correlationId: string;
  enrollmentId?: string;
  reason: string;
  staffExternalId: string;
}): Promise<{ id: string }> {
  return db.ledgerEntry.create({
    data: {
      accountId: input.accountId,
      kind: "ADJUSTMENT",
      source: "MANUAL_ADJUSTMENT",
      amountNgn: input.amountNgn,
      correlationId: input.correlationId,
      enrollmentId: input.enrollmentId ?? null,
      detail: {
        reason: input.reason,
        staff_external_id: input.staffExternalId,
      } satisfies Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}
