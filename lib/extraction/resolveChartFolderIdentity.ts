/**
 * Chart-folder identity resolver.
 *
 * Once a chart folder is closed and all of its jobs have reached a
 * terminal status (VALIDATED / AWAITING_REVIEW / FAILED), we pick the
 * Patient this folder maps to using a four-step waterfall:
 *
 *   1. DECLARED_BY_OPERATOR — the operator explicitly chose a Patient
 *      while capturing. Use it.
 *   2. MRN_LOOKUP            — the operator typed an MRN. Look it up
 *      under the org's mrnSystem URI. Exact match.
 *   3. FUZZY_MATCH           — score the folder's extracted records
 *      against existing Patients by (name, dob, mrn). Best score wins
 *      if above a threshold.
 *   4. NEW_PATIENT           — none of the above matched. Create a
 *      Patient from the best-confidence extraction in the folder.
 *
 * Every ExtractedRecord in the folder then gets `patientId` set to the
 * resolved Patient. We also write the resolution back to the folder so
 * a reviewer can see WHY the system picked this patient.
 *
 * Idempotent: re-running it on an already-resolved folder updates the
 * resolution if extracted evidence has changed (e.g. a reviewer fixed
 * a name on one of the pages).
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const FUZZY_NAME_THRESHOLD = 0.85; // 0-1 token-set ratio
const FUZZY_ACCEPT_SCORE = 0.75; // weighted total
const RECORD_FETCH_FIELDS = {
  id: true,
  extractedJson: true,
  avgConfidence: true,
  patientId: true,
} as const;

type ResolvedSource =
  | "DECLARED_BY_OPERATOR"
  | "MRN_LOOKUP"
  | "FUZZY_MATCH"
  | "NEW_PATIENT";

export type ResolutionOutcome = {
  patientId: string;
  source: ResolvedSource;
  confidence: number;
};

/**
 * Resolve identity for one chart folder. Returns null if the folder
 * has no extracted records yet (caller should try again later) or if
 * the folder doesn't exist.
 */
export async function resolveChartFolderIdentity(
  chartFolderId: string,
): Promise<ResolutionOutcome | null> {
  const folder = await db.chartFolder.findUnique({
    where: { id: chartFolderId },
    select: {
      id: true,
      organizationId: true,
      declaredPatientId: true,
      declaredMrn: true,
      organization: { select: { mrnSystem: true } },
      jobs: {
        select: {
          id: true,
          extractedRecords: { select: RECORD_FETCH_FIELDS },
        },
      },
    },
  });
  if (!folder) return null;

  const records = folder.jobs.flatMap((j) => j.extractedRecords);

  // If the operator declared a patient OR an MRN, we can resolve
  // immediately — we don't need any extracted evidence to know who
  // this chart belongs to. Records that haven't extracted yet will get
  // their patientId set the moment they do, via applyResolution writing
  // resolvedPatientId on the folder (extraction transactions copy from
  // the folder when present).
  if (records.length === 0 && !folder.declaredPatientId && !folder.declaredMrn) {
    // No extracted evidence AND no operator declaration — there's
    // nothing for us to match against. The caller will try again when
    // extraction lands.
    return null;
  }

  const outcome = await pickPatient(folder, records);
  if (!outcome) return null;

  await applyResolution(folder.id, records, outcome);
  return outcome;
}

/* ── Resolution waterfall ─────────────────────────────────── */

async function pickPatient(
  folder: {
    id: string;
    organizationId: string;
    declaredPatientId: string | null;
    declaredMrn: string | null;
    organization: { mrnSystem: string | null };
  },
  records: { extractedJson: Prisma.JsonValue; avgConfidence: number | null }[],
): Promise<ResolutionOutcome | null> {
  // 1. DECLARED_BY_OPERATOR
  if (folder.declaredPatientId) {
    const exists = await db.patient.findFirst({
      where: { id: folder.declaredPatientId, organizationId: folder.organizationId },
      select: { id: true },
    });
    if (exists) {
      return {
        patientId: exists.id,
        source: "DECLARED_BY_OPERATOR",
        confidence: 1,
      };
    }
  }

  // 2. MRN_LOOKUP
  if (folder.declaredMrn) {
    const mrnSystem = folder.organization.mrnSystem ?? "https://pierflow.com/mrn";
    const ident = await db.patientIdentifier.findFirst({
      where: {
        system: mrnSystem,
        value: folder.declaredMrn.trim(),
        patient: { organizationId: folder.organizationId },
      },
      select: { patientId: true },
    });
    if (ident) {
      return {
        patientId: ident.patientId,
        source: "MRN_LOOKUP",
        confidence: 1,
      };
    }
  }

  // 3. FUZZY_MATCH — collect candidate signals from the folder's
  //    extracted records, then score against existing Patients in the
  //    org. We pick the highest-confidence record as the canonical
  //    signal for matching.
  const ranked = records
    .filter((r) => extractPatientBlock(r.extractedJson) != null)
    .sort((a, b) => (b.avgConfidence ?? 0) - (a.avgConfidence ?? 0));
  const canonical = ranked[0]
    ? extractPatientBlock(ranked[0].extractedJson)
    : null;

  if (canonical) {
    // Pull every patient identifier in the org that matches a value we
    // saw across the folder — handles "MRN was on page 5, not page 1".
    const mrnSystem = folder.organization.mrnSystem ?? "https://pierflow.com/mrn";
    const foundMrns = records
      .map((r) => extractMrnValue(r.extractedJson))
      .filter((v): v is string => Boolean(v));
    if (foundMrns.length > 0) {
      const ident = await db.patientIdentifier.findFirst({
        where: {
          system: mrnSystem,
          value: { in: foundMrns },
          patient: { organizationId: folder.organizationId },
        },
        select: { patientId: true },
      });
      if (ident) {
        return {
          patientId: ident.patientId,
          source: "MRN_LOOKUP",
          confidence: 0.95,
        };
      }
    }

    // No MRN hit — search by name + DOB.
    const candidates = await db.patient.findMany({
      where: {
        organizationId: folder.organizationId,
        ...(canonical.dateOfBirth
          ? { dateOfBirth: canonical.dateOfBirth }
          : {}),
      },
      take: 100,
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
      },
    });

    let best: { id: string; score: number } | null = null;
    for (const c of candidates) {
      const nameScore = tokenSetRatio(canonical.fullName, c.fullName);
      const dobScore = canonical.dateOfBirth
        ? c.dateOfBirth?.getTime() === canonical.dateOfBirth.getTime()
          ? 1
          : 0
        : 0.5;
      const total = nameScore * 0.7 + dobScore * 0.3;
      if (nameScore >= FUZZY_NAME_THRESHOLD && total >= FUZZY_ACCEPT_SCORE) {
        if (!best || total > best.score) best = { id: c.id, score: total };
      }
    }
    if (best) {
      return {
        patientId: best.id,
        source: "FUZZY_MATCH",
        confidence: best.score,
      };
    }
  }

  // 4. NEW_PATIENT — fall back to creating one from the canonical
  //    record. We mark identityConfidence low by using
  //    `possibleDuplicateOfId = null` and leaving it for a later
  //    duplicate-detection pass to flag.
  if (canonical) {
    const created = await db.patient.create({
      data: {
        organizationId: folder.organizationId,
        fullName: canonical.fullName,
        dateOfBirth: canonical.dateOfBirth ?? null,
        sex: canonical.sex ?? "U",
        bloodGroup: canonical.bloodGroup ?? null,
        genotype: canonical.genotype ?? null,
        ...(canonical.mrn
          ? {
              identifiers: {
                create: [
                  {
                    system:
                      folder.organization.mrnSystem ??
                      "https://pierflow.com/mrn",
                    value: canonical.mrn,
                  },
                ],
              },
            }
          : {}),
      },
      select: { id: true },
    });
    return {
      patientId: created.id,
      source: "NEW_PATIENT",
      confidence: ranked[0]?.avgConfidence ?? 0.5,
    };
  }

  return null;
}

async function applyResolution(
  chartFolderId: string,
  records: { id: string }[],
  outcome: ResolutionOutcome,
) {
  await db.$transaction([
    db.chartFolder.update({
      where: { id: chartFolderId },
      data: {
        resolvedPatientId: outcome.patientId,
        resolvedSource: outcome.source,
        resolvedConfidence: outcome.confidence,
        resolvedAt: new Date(),
      },
    }),
    db.extractedRecord.updateMany({
      where: { id: { in: records.map((r) => r.id) } },
      data: { patientId: outcome.patientId },
    }),
  ]);
}

/* ── Helpers ──────────────────────────────────────────────── */

type PatientBlock = {
  fullName: string;
  dateOfBirth?: Date;
  sex?: "M" | "F" | "U";
  bloodGroup?: string;
  genotype?: string;
  mrn?: string;
};

function extractPatientBlock(json: Prisma.JsonValue): PatientBlock | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const data = json as Record<string, unknown>;
  const patient = data.patient as Record<string, unknown> | undefined;
  if (!patient) return null;

  const fullName = readFieldValue(patient.full_name) ?? readFieldValue(patient.name);
  if (!fullName) return null;

  const block: PatientBlock = { fullName };
  const dobRaw = readFieldValue(patient.date_of_birth) ?? readFieldValue(patient.dob);
  if (dobRaw) {
    const parsed = parseDate(dobRaw);
    if (parsed) block.dateOfBirth = parsed;
  }
  const sex = readFieldValue(patient.sex) ?? readFieldValue(patient.gender);
  if (sex) {
    const s = sex.trim().toUpperCase();
    if (s.startsWith("M")) block.sex = "M";
    else if (s.startsWith("F")) block.sex = "F";
  }
  block.bloodGroup = readFieldValue(patient.blood_group);
  block.genotype = readFieldValue(patient.genotype);
  block.mrn = readFieldValue(patient.mrn);
  return block;
}

function extractMrnValue(json: Prisma.JsonValue): string | null {
  const block = extractPatientBlock(json);
  return block?.mrn ?? null;
}

/**
 * Extracted fields come back as either { value, confidence } or as the
 * bare value. This helper handles both shapes.
 */
function readFieldValue(field: unknown): string | undefined {
  if (typeof field === "string") return field.trim() || undefined;
  if (
    field &&
    typeof field === "object" &&
    !Array.isArray(field) &&
    "value" in (field as Record<string, unknown>)
  ) {
    const v = (field as Record<string, unknown>).value;
    if (typeof v === "string") return v.trim() || undefined;
  }
  return undefined;
}

function parseDate(raw: string): Date | null {
  // Accept ISO, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, etc. Nigerian
  // outpatient cards often use DD/MM/YYYY.
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return new Date(iso);
  const dmy = raw.match(/^(\d{1,2})[\/\-\. ](\d{1,2})[\/\-\. ](\d{2,4})$/);
  if (dmy) {
    const [, d, m] = dmy;
    let y = dmy[3];
    if (y.length === 2) y = (Number(y) < 30 ? "20" : "19") + y;
    const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
}

/**
 * Token-set ratio: tokenise both strings, lowercase, intersect, ratio.
 * Robust to word order and casing. "Adaeze Margaret Nwosu" matches
 * "Margaret A Nwosu" with ~0.67; "Adaeze Nwosu" matches with ~0.66 too,
 * which is below threshold — we lean on DOB to disambiguate.
 */
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
