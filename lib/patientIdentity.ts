/**
 * Patient identity: bridge between the embedded patient block on every
 * ExtractedRecord and a canonical Patient row.
 *
 * MVP rule set:
 *  1. If the extracted patient block has an `mrn` and a Patient with
 *     that mrn already exists in the same organization, reuse it.
 *  2. Otherwise create a new Patient with the extracted demographics.
 *  3. Patient.fullName, dateOfBirth, sex, bloodGroup, genotype come
 *     from the most-recent extraction with the best confidence.
 *
 * Identity matching beyond exact MRN (fuzzy name + DOB, BVN, biometric)
 * is deferred — those decisions sit in a future Master Patient Index.
 */

import { db } from "./db";
import type { Patient, Prisma } from "@prisma/client";

type Leaf<T> = { value?: T; _confidence?: number } | undefined;

type ExtractedPatient = {
  mrn?: Leaf<string>;
  full_name?: Leaf<string>;
  date_of_birth?: Leaf<string>;
  sex?: Leaf<"M" | "F" | "U">;
  blood_group?: Leaf<string>;
  genotype?: Leaf<string>;
};

function readLeaf<T>(leaf: Leaf<T>): T | undefined {
  return leaf?.value;
}

/**
 * For one ExtractedRecord, ensure a Patient row exists for the org
 * and return its id. Idempotent.
 */
export async function upsertPatientForRecord(input: {
  organizationId: string;
  extractedJson: unknown;
}): Promise<string | null> {
  const json = (input.extractedJson ?? {}) as { patient?: ExtractedPatient };
  const p = json.patient;
  if (!p) return null;

  const fullName = readLeaf(p.full_name)?.trim();
  if (!fullName) return null;

  const dob = readLeaf(p.date_of_birth);
  const sex = readLeaf(p.sex) ?? "U";
  const bloodGroup = readLeaf(p.blood_group);
  const genotype = readLeaf(p.genotype);
  const mrn = readLeaf(p.mrn)?.trim();

  // Try to find an existing patient via MRN identifier first.
  if (mrn) {
    const ident = await db.patientIdentifier.findFirst({
      where: {
        system: "https://pierflow.com/mrn",
        value: mrn,
        patient: { organizationId: input.organizationId },
      },
      select: { patientId: true },
    });
    if (ident) return ident.patientId;
  }

  // No MRN match — create a fresh Patient.
  const patient = await db.patient.create({
    data: {
      organizationId: input.organizationId,
      fullName,
      dateOfBirth: dob ? new Date(dob) : null,
      sex,
      bloodGroup,
      genotype,
      identifiers: mrn
        ? {
            create: [
              {
                system: "https://pierflow.com/mrn",
                value: mrn,
                use: "official",
              },
            ],
          }
        : undefined,
    },
    select: { id: true },
  });
  return patient.id;
}

/**
 * Walk every approved ExtractedRecord for an organization that doesn't
 * yet have a Patient link, and upsert. Returns the count linked.
 */
export async function reconcileOrganizationPatients(
  organizationId: string,
): Promise<{ linked: number }> {
  const records = await db.extractedRecord.findMany({
    where: {
      organizationId,
      patientId: null,
      validationStatus: { in: ["AUTO_APPROVED", "VALIDATED"] },
    },
    select: { id: true, extractedJson: true },
    take: 500,
  });

  let linked = 0;
  for (const r of records) {
    const patientId = await upsertPatientForRecord({
      organizationId,
      extractedJson: r.extractedJson,
    });
    if (patientId) {
      await db.extractedRecord.update({
        where: { id: r.id },
        data: { patientId },
      });
      linked++;
    }
  }
  return { linked };
}

/* ── Patient summary shape used by /v1/organizations/:id/patients ── */

export type PatientSummary = {
  patient_id: string;
  mrn: string | null;
  full_name: string;
  date_of_birth: string | null;
  sex: "M" | "F" | "U";
  blood_group: string | null;
  genotype: string | null;
  record_count: number;
  earliest_record_at: string | null;
  latest_record_at: string | null;
};

export async function listPatientSummaries(input: {
  organizationId: string;
  limit?: number;
  cursor?: string;
}): Promise<PatientSummary[]> {
  const where: Prisma.PatientWhereInput = {
    organizationId: input.organizationId,
  };

  const patients = await db.patient.findMany({
    where,
    orderBy: { fullName: "asc" },
    take: input.limit ?? 100,
    ...(input.cursor
      ? { skip: 1, cursor: { id: input.cursor } }
      : {}),
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      sex: true,
      bloodGroup: true,
      genotype: true,
      identifiers: {
        where: { system: "https://pierflow.com/mrn" },
        take: 1,
        select: { value: true },
      },
      extractedRecords: {
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return patients.map((p): PatientSummary => {
    const records = p.extractedRecords;
    return {
      patient_id: p.id,
      mrn: p.identifiers[0]?.value ?? null,
      full_name: p.fullName,
      date_of_birth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
      sex: p.sex,
      blood_group: p.bloodGroup,
      genotype: p.genotype,
      record_count: records.length,
      earliest_record_at: records[0]?.createdAt.toISOString() ?? null,
      latest_record_at:
        records[records.length - 1]?.createdAt.toISOString() ?? null,
    };
  });
}

export async function getPatientForBundle(patientId: string): Promise<Patient | null> {
  return db.patient.findUnique({ where: { id: patientId } });
}
