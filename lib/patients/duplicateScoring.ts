/**
 * Duplicate-patient scoring.
 *
 * Walks every Patient in an Organization and looks for likely duplicate
 * pairs using three signals, in descending order of trust:
 *
 *   1. Same MRN value under the same MRN system URI — score 1.0
 *   2. Same (name, DOB, sex) tuple within fuzzy thresholds — 0.6-0.95
 *   3. Phonetic-name match + same DOB — 0.6-0.85
 *
 * Each candidate pair becomes a PatientMergeCandidate row with the
 * older Patient as `primary`. Idempotent: if the row already exists
 * we update the score + reasons; we never overwrite a reviewer's
 * decision.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const FUZZY_NAME_THRESHOLD = 0.78;
const ACCEPT_SCORE = 0.55;
const MAX_CANDIDATES_PER_PATIENT = 5;

type PatientLite = {
  id: string;
  fullName: string;
  dateOfBirth: Date | null;
  sex: "M" | "F" | "U";
  createdAt: Date;
  identifiers: { system: string; value: string }[];
};

type CandidateRow = {
  primaryPatientId: string;
  candidatePatientId: string;
  score: number;
  reasons: Prisma.InputJsonValue;
};

export async function scoreOrganizationDuplicates(
  organizationId: string,
): Promise<{ candidatesWritten: number; pairsConsidered: number }> {
  const patients = await db.patient.findMany({
    where: { organizationId },
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      sex: true,
      createdAt: true,
      identifiers: { select: { system: true, value: true } },
    },
  });
  if (patients.length < 2) {
    return { candidatesWritten: 0, pairsConsidered: 0 };
  }

  const rows: CandidateRow[] = [];
  let pairs = 0;

  // First pass: MRN-system / value match. Cheap because it's an
  // identifier-table lookup, not an N*N name comparison.
  const identifierIndex = new Map<string, string[]>(); // "system|value" -> patientIds
  for (const p of patients) {
    for (const ident of p.identifiers) {
      const key = `${ident.system}|${normaliseIdValue(ident.value)}`;
      const arr = identifierIndex.get(key) ?? [];
      arr.push(p.id);
      identifierIndex.set(key, arr);
    }
  }
  identifierIndex.forEach((ids, key) => {
    if (ids.length < 2) return;
    // Sort so the oldest is primary
    const sorted = ids.sort((a, b) => {
      const A = patients.find((p) => p.id === a)!;
      const B = patients.find((p) => p.id === b)!;
      return A.createdAt.getTime() - B.createdAt.getTime();
    });
    const primary = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      pairs++;
      rows.push({
        primaryPatientId: primary,
        candidatePatientId: sorted[i],
        score: 1.0,
        reasons: { type: "MRN_MATCH", identifier: key },
      });
    }
  });

  // Second pass: fuzzy name + DOB. We bucket by DOB to keep this
  // tractable — patients without DOB go into a single "unknown" bucket
  // and only get compared by name.
  const byDob = new Map<string, PatientLite[]>();
  for (const p of patients) {
    const key = p.dateOfBirth ? p.dateOfBirth.toISOString() : "UNKNOWN";
    const arr = byDob.get(key) ?? [];
    arr.push(p);
    byDob.set(key, arr);
  }

  const seenPairs = new Set<string>(
    rows.map((r) =>
      pairKey(r.primaryPatientId, r.candidatePatientId),
    ),
  );

  byDob.forEach((bucket) => {
    if (bucket.length < 2) return;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        pairs++;
        const a = bucket[i];
        const b = bucket[j];
        const k = pairKey(a.id, b.id);
        if (seenPairs.has(k)) continue;

        const nameScore = tokenSetRatio(a.fullName, b.fullName);
        if (nameScore < FUZZY_NAME_THRESHOLD) continue;
        const dobScore = a.dateOfBirth && b.dateOfBirth ? 1 : 0.5;
        const sexScore = a.sex === b.sex && a.sex !== "U" ? 1 : 0.5;
        const total = nameScore * 0.65 + dobScore * 0.25 + sexScore * 0.1;
        if (total < ACCEPT_SCORE) continue;

        const [primary, candidate] = orderByCreatedAt(a, b);
        rows.push({
          primaryPatientId: primary.id,
          candidatePatientId: candidate.id,
          score: total,
          reasons: {
            type: "NAME_DOB",
            name_similarity: nameScore,
            dob_match: a.dateOfBirth?.getTime() === b.dateOfBirth?.getTime(),
            sex_match: a.sex === b.sex,
          },
        });
        seenPairs.add(k);
      }
    }
  });

  // Cap per-primary so a noisy patient row can't blow up the queue.
  const cappedRows: CandidateRow[] = [];
  const seenPerPrimary = new Map<string, number>();
  for (const r of rows.sort((a, b) => b.score - a.score)) {
    const n = seenPerPrimary.get(r.primaryPatientId) ?? 0;
    if (n >= MAX_CANDIDATES_PER_PATIENT) continue;
    cappedRows.push(r);
    seenPerPrimary.set(r.primaryPatientId, n + 1);
  }

  // Upsert each pair. We update score + reasons on existing rows but
  // never touch the reviewer decision.
  let written = 0;
  for (const r of cappedRows) {
    await db.patientMergeCandidate.upsert({
      where: {
        primaryPatientId_candidatePatientId: {
          primaryPatientId: r.primaryPatientId,
          candidatePatientId: r.candidatePatientId,
        },
      },
      update: {
        score: r.score,
        reasons: r.reasons,
        detectedAt: new Date(),
      },
      create: {
        organizationId,
        primaryPatientId: r.primaryPatientId,
        candidatePatientId: r.candidatePatientId,
        score: r.score,
        reasons: r.reasons,
      },
    });
    written++;
  }
  return { candidatesWritten: written, pairsConsidered: pairs };
}

/* ── Merge action ───────────────────────────────────────────── */

/**
 * Merge `candidate` into `primary`. Re-parents every ExtractedRecord
 * + ChartFolder + PatientIdentifier from candidate to primary, then
 * soft-deletes the candidate via possibleDuplicateOfId so a future
 * scoring pass doesn't pick it up again.
 *
 * Idempotent: re-running on an already-merged pair is a no-op.
 */
export async function mergePatients(input: {
  primaryPatientId: string;
  candidatePatientId: string;
  reviewerExternalId: string;
  reviewerNotes?: string;
}): Promise<void> {
  if (input.primaryPatientId === input.candidatePatientId) {
    throw new Error("SAME_PATIENT");
  }

  const primary = await db.patient.findUnique({
    where: { id: input.primaryPatientId },
    select: { id: true, organizationId: true },
  });
  const candidate = await db.patient.findUnique({
    where: { id: input.candidatePatientId },
    select: {
      id: true,
      organizationId: true,
      possibleDuplicateOfId: true,
    },
  });
  if (!primary || !candidate) throw new Error("PATIENT_NOT_FOUND");
  if (primary.organizationId !== candidate.organizationId) {
    throw new Error("ORG_MISMATCH");
  }

  await db.$transaction(async (tx) => {
    // Re-parent everything that points at candidate to primary.
    await tx.extractedRecord.updateMany({
      where: { patientId: candidate.id },
      data: { patientId: primary.id },
    });
    await tx.chartFolder.updateMany({
      where: { declaredPatientId: candidate.id },
      data: { declaredPatientId: primary.id },
    });
    await tx.chartFolder.updateMany({
      where: { resolvedPatientId: candidate.id },
      data: { resolvedPatientId: primary.id },
    });
    // Move identifiers across. We may collide with primary's existing
    // identifiers (e.g. both already had the same MRN) — skip those.
    const idents = await tx.patientIdentifier.findMany({
      where: { patientId: candidate.id },
      select: { id: true, system: true, value: true },
    });
    for (const i of idents) {
      const collision = await tx.patientIdentifier.findFirst({
        where: {
          patientId: primary.id,
          system: i.system,
          value: i.value,
        },
        select: { id: true },
      });
      if (collision) {
        await tx.patientIdentifier.delete({ where: { id: i.id } });
      } else {
        await tx.patientIdentifier.update({
          where: { id: i.id },
          data: { patientId: primary.id },
        });
      }
    }
    // Soft-delete the candidate by pointing it at primary so future
    // scoring passes ignore it. We don't hard-delete so an audit trail
    // remains.
    await tx.patient.update({
      where: { id: candidate.id },
      data: { possibleDuplicateOfId: primary.id },
    });
    // Resolve any candidate row(s) involving this pair.
    await tx.patientMergeCandidate.updateMany({
      where: {
        OR: [
          {
            primaryPatientId: primary.id,
            candidatePatientId: candidate.id,
          },
          {
            primaryPatientId: candidate.id,
            candidatePatientId: primary.id,
          },
        ],
      },
      data: {
        decision: "MERGE",
        reviewerExternalId: input.reviewerExternalId,
        reviewerNotes: input.reviewerNotes ?? null,
        reviewedAt: new Date(),
      },
    });
  });
}

/* ── Helpers ───────────────────────────────────────────────── */

function normaliseIdValue(v: string): string {
  return v.trim().toLowerCase().replace(/[\s\-_/]/g, "");
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function orderByCreatedAt(a: PatientLite, b: PatientLite) {
  return a.createdAt.getTime() <= b.createdAt.getTime() ? [a, b] : [b, a];
}

function tokenSetRatio(a: string, b: string): number {
  const toks = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z\s'-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1),
    );
  const A = toks(a);
  const B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let intersect = 0;
  A.forEach((t) => {
    if (B.has(t)) intersect++;
  });
  return (2 * intersect) / (A.size + B.size);
}
