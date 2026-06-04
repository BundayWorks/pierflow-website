/**
 * FHIR R4 mapper.
 *
 * Transforms the structured JSON produced by the extraction worker
 * (lib/extraction/*) into a FHIR R4 Bundle resource. The mapper is
 * defensive — it accepts partial / messy input because that's what we
 * get from the model. Missing fields are skipped, not faked.
 *
 * Reference: https://www.hl7.org/fhir/R4/
 *
 * Internal — do not expose mapping rules or schema shapes in public
 * docs. The fact that we produce FHIR R4 is the contract; how we get
 * there is competitive advantage.
 */

import type { DocumentType } from "@prisma/client";

type FhirResource =
  | FhirPatient
  | FhirEncounter
  | FhirObservation
  | FhirCondition
  | FhirMedicationRequest
  | FhirPractitioner
  | FhirOrganization
  | FhirAllergyIntolerance
  | FhirDiagnosticReport;

export type FhirBundle = {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  total: number;
  entry: { fullUrl: string; resource: FhirResource }[];
};

/* ── Resource type shells (only the fields we actually populate) ─ */

type FhirPatient = {
  resourceType: "Patient";
  id: string;
  identifier?: { system?: string; value: string }[];
  name?: { use?: string; text?: string; family?: string; given?: string[] }[];
  gender?: "male" | "female" | "unknown" | "other";
  birthDate?: string;
  telecom?: { system: "phone" | "email"; value: string }[];
  address?: { text?: string }[];
  extension?: { url: string; valueCode?: string; valueString?: string }[];
};

type FhirEncounter = {
  resourceType: "Encounter";
  id: string;
  status: "finished" | "in-progress" | "unknown";
  class: { system: string; code: string; display: string };
  subject: { reference: string };
  period?: { start?: string; end?: string };
  participant?: { individual?: { reference: string; display?: string } }[];
  reasonCode?: { text: string }[];
};

type FhirObservation = {
  resourceType: "Observation";
  id: string;
  status: "final" | "preliminary";
  category?: { coding: { system: string; code: string; display: string }[] }[];
  code: {
    coding?: { system: string; code: string; display?: string }[];
    text?: string;
  };
  subject: { reference: string };
  encounter?: { reference: string };
  effectiveDateTime?: string;
  valueQuantity?: { value: number; unit?: string; system?: string; code?: string };
  valueString?: string;
  interpretation?: { coding: { system: string; code: string }[] }[];
  referenceRange?: { text?: string }[];
  component?: {
    code: { coding: { system: string; code: string; display: string }[] };
    valueQuantity?: { value: number; unit: string };
  }[];
};

type FhirCondition = {
  resourceType: "Condition";
  id: string;
  clinicalStatus?: { coding: { system: string; code: string }[] };
  code: {
    coding?: { system: string; code: string; display?: string }[];
    text: string;
  };
  subject: { reference: string };
  encounter?: { reference: string };
  recordedDate?: string;
};

type FhirMedicationRequest = {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "completed" | "stopped" | "unknown";
  intent: "order" | "plan";
  medicationCodeableConcept: {
    coding?: { system: string; code: string; display?: string }[];
    text: string;
  };
  subject: { reference: string };
  encounter?: { reference: string };
  authoredOn?: string;
  requester?: { reference: string };
  dosageInstruction?: {
    text?: string;
    timing?: { code?: { text: string } };
    route?: { text: string };
    doseAndRate?: { doseQuantity?: { value?: number; unit?: string } }[];
  }[];
  dispenseRequest?: { expectedSupplyDuration?: { value?: number; unit?: string } };
};

type FhirPractitioner = {
  resourceType: "Practitioner";
  id: string;
  name?: { text: string }[];
};

type FhirOrganization = {
  resourceType: "Organization";
  id: string;
  name: string;
};

type FhirAllergyIntolerance = {
  resourceType: "AllergyIntolerance";
  id: string;
  patient: { reference: string };
  code: { text: string };
};

type FhirDiagnosticReport = {
  resourceType: "DiagnosticReport";
  id: string;
  status: "final";
  category?: { coding: { system: string; code: string }[] }[];
  code: { text: string };
  subject: { reference: string };
  effectiveDateTime?: string;
  performer?: { display: string }[];
  result?: { reference: string }[];
};

/* ── Input shape (what the extraction layer returns) ────────────── */

type Leaf<T> = { value?: T; _confidence?: number; _raw?: string } | undefined;

type ExtractedDiagnosis = {
  text?: string;
  icd10_code?: string;
  icd10_confidence?: number;
  _confidence?: number;
  _raw?: string;
};

type ExtractedMedication = {
  name?: Leaf<string>;
  atc_code?: Leaf<string>;
  dose?: Leaf<string>;
  route?: Leaf<string>;
  frequency?: Leaf<string>;
  duration?: Leaf<string>;
};

type ExtractedVisit = {
  visit_date?: Leaf<string>;
  presenting_complaint?: Leaf<string>;
  notes?: Leaf<string>;
  vitals?: {
    bp_systolic?: Leaf<number>;
    bp_diastolic?: Leaf<number>;
    temperature_c?: Leaf<number>;
    pulse_bpm?: Leaf<number>;
    weight_kg?: Leaf<number>;
    height_cm?: Leaf<number>;
  };
  diagnoses?: ExtractedDiagnosis[];
  medications?: ExtractedMedication[];
  clinician?: Leaf<string>;
};

type ExtractedPatient = {
  mrn?: Leaf<string>;
  full_name?: Leaf<string>;
  date_of_birth?: Leaf<string>;
  age?: Leaf<number>;
  sex?: Leaf<"M" | "F" | "U">;
  blood_group?: Leaf<string>;
  genotype?: Leaf<string>;
  phone?: Leaf<string>;
  email?: Leaf<string>;
  address?: Leaf<string>;
  next_of_kin?: Leaf<string>;
};

type ExtractedLabResult = {
  analyte?: Leaf<string>;
  loinc_code?: Leaf<string>;
  value?: Leaf<string>;
  unit?: Leaf<string>;
  reference_range?: Leaf<string>;
  flag?: Leaf<string>;
};

export type ExtractedJson = {
  patient?: ExtractedPatient;
  visits?: ExtractedVisit[];
  diagnoses?: ExtractedDiagnosis[];
  medications?: ExtractedMedication[];
  identifiers?: { system?: string; value?: string; _confidence?: number }[];
  allergies?: { substance?: Leaf<string> }[];
  // Lab schema
  report?: {
    report_date?: Leaf<string>;
    requested_by?: Leaf<string>;
    panel?: Leaf<string>;
    lab?: Leaf<string>;
  };
  results?: ExtractedLabResult[];
  // Prescription schema
  prescriber?: Leaf<string>;
  prescribed_at?: Leaf<string>;
  items?: ExtractedMedication[];
};

/* ── Mapper entry point ─────────────────────────────────────────── */

export function buildFhirBundle(input: {
  data: ExtractedJson;
  documentType: DocumentType;
  organization: { id: string; name: string };
  /** Stable Pierflow patient id, if we've matched to an existing one. */
  matchedPatientId?: string;
}): FhirBundle {
  const entries: { fullUrl: string; resource: FhirResource }[] = [];
  const now = new Date().toISOString();

  // Organization (the contracted entity Pierflow holds the data for)
  const orgRef = `Organization/${input.organization.id}`;
  entries.push({
    fullUrl: orgRef,
    resource: {
      resourceType: "Organization",
      id: input.organization.id,
      name: input.organization.name,
    },
  });

  // Patient
  const patientId = input.matchedPatientId ?? `pat_${randomId()}`;
  const patient = buildPatient(patientId, input.data);
  if (patient) {
    entries.push({ fullUrl: `Patient/${patientId}`, resource: patient });
  }
  const patientRef = `Patient/${patientId}`;

  // Visits → Encounter + per-visit Observations / Conditions / MedicationRequests
  const visits = input.data.visits ?? [];
  visits.forEach((visit, i) => {
    const encId = `enc_${i + 1}_${randomId()}`;
    const encounter = buildEncounter(encId, visit, patientRef);
    entries.push({ fullUrl: `Encounter/${encId}`, resource: encounter });

    // Vitals as Observations
    const obs = buildVitalObservations(
      encounter.period?.start,
      visit,
      patientRef,
      `Encounter/${encId}`,
    );
    obs.forEach((o) =>
      entries.push({ fullUrl: `Observation/${o.id}`, resource: o }),
    );

    // Diagnoses → Conditions
    (visit.diagnoses ?? []).forEach((dx, j) => {
      const cond = buildCondition(
        `cond_${i + 1}_${j + 1}_${randomId()}`,
        dx,
        patientRef,
        `Encounter/${encId}`,
        encounter.period?.start,
      );
      if (cond) {
        entries.push({ fullUrl: `Condition/${cond.id}`, resource: cond });
      }
    });

    // Medications → MedicationRequests
    (visit.medications ?? []).forEach((med, j) => {
      const mr = buildMedicationRequest(
        `med_${i + 1}_${j + 1}_${randomId()}`,
        med,
        patientRef,
        `Encounter/${encId}`,
        encounter.period?.start,
      );
      if (mr) {
        entries.push({
          fullUrl: `MedicationRequest/${mr.id}`,
          resource: mr,
        });
      }
    });

    // Practitioner from clinician name
    const clinicianName = visit.clinician?.value;
    if (clinicianName) {
      const pid = `prac_${randomId()}`;
      entries.push({
        fullUrl: `Practitioner/${pid}`,
        resource: {
          resourceType: "Practitioner",
          id: pid,
          name: [{ text: clinicianName }],
        },
      });
      encounter.participant = [
        {
          individual: {
            reference: `Practitioner/${pid}`,
            display: clinicianName,
          },
        },
      ];
    }
  });

  // Top-level diagnoses (e.g. from the GENERIC schema when there are no visits)
  (input.data.diagnoses ?? []).forEach((dx, i) => {
    const cond = buildCondition(
      `cond_top_${i + 1}_${randomId()}`,
      dx,
      patientRef,
    );
    if (cond) {
      entries.push({ fullUrl: `Condition/${cond.id}`, resource: cond });
    }
  });

  // Top-level medications (PRESCRIPTION schema uses `items`)
  const standaloneMeds = [
    ...(input.data.medications ?? []),
    ...(input.data.items ?? []),
  ];
  standaloneMeds.forEach((med, i) => {
    const mr = buildMedicationRequest(
      `med_top_${i + 1}_${randomId()}`,
      med,
      patientRef,
      undefined,
      input.data.prescribed_at?.value,
    );
    if (mr) {
      entries.push({
        fullUrl: `MedicationRequest/${mr.id}`,
        resource: mr,
      });
    }
  });

  // Allergies
  (input.data.allergies ?? []).forEach((a, i) => {
    const substance = a.substance?.value;
    if (substance) {
      const id = `allergy_${i + 1}_${randomId()}`;
      entries.push({
        fullUrl: `AllergyIntolerance/${id}`,
        resource: {
          resourceType: "AllergyIntolerance",
          id,
          patient: { reference: patientRef },
          code: { text: substance },
        },
      });
    }
  });

  // Lab results → DiagnosticReport + per-analyte Observations
  if (input.data.report || (input.data.results ?? []).length > 0) {
    const reportId = `dr_${randomId()}`;
    const resultRefs: { reference: string }[] = [];

    (input.data.results ?? []).forEach((r, i) => {
      const obs = buildLabObservation(
        `obs_lab_${i + 1}_${randomId()}`,
        r,
        patientRef,
        input.data.report?.report_date?.value,
      );
      if (obs) {
        entries.push({ fullUrl: `Observation/${obs.id}`, resource: obs });
        resultRefs.push({ reference: `Observation/${obs.id}` });
      }
    });

    entries.push({
      fullUrl: `DiagnosticReport/${reportId}`,
      resource: {
        resourceType: "DiagnosticReport",
        id: reportId,
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                code: "LAB",
              },
            ],
          },
        ],
        code: { text: input.data.report?.panel?.value ?? "Laboratory report" },
        subject: { reference: patientRef },
        effectiveDateTime: input.data.report?.report_date?.value,
        performer: input.data.report?.lab?.value
          ? [{ display: input.data.report.lab.value }]
          : undefined,
        result: resultRefs.length ? resultRefs : undefined,
      },
    });
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: now,
    total: entries.length,
    entry: entries,
  };
}

/* ── Per-resource builders ──────────────────────────────────────── */

function buildPatient(id: string, data: ExtractedJson): FhirPatient | null {
  const p = data.patient;
  if (!p) return null;

  const identifiers: { system?: string; value: string }[] = [];
  if (p.mrn?.value) {
    identifiers.push({
      system: "https://pierflow.com/mrn",
      value: p.mrn.value,
    });
  }
  (data.identifiers ?? []).forEach((id) => {
    if (id.value) {
      identifiers.push({
        system: id.system
          ? `https://pierflow.com/${id.system}`
          : "https://pierflow.com/external",
        value: id.value,
      });
    }
  });

  const name = p.full_name?.value
    ? [
        {
          use: "official",
          text: p.full_name.value,
          ...splitName(p.full_name.value),
        },
      ]
    : undefined;

  const telecom: { system: "phone" | "email"; value: string }[] = [];
  if (p.phone?.value) telecom.push({ system: "phone", value: p.phone.value });
  if (p.email?.value) telecom.push({ system: "email", value: p.email.value });

  const extension: FhirPatient["extension"] = [];
  if (p.blood_group?.value) {
    extension.push({
      url: "https://pierflow.com/fhir/StructureDefinition/blood-group",
      valueCode: p.blood_group.value,
    });
  }
  if (p.genotype?.value) {
    extension.push({
      url: "https://pierflow.com/fhir/StructureDefinition/genotype",
      valueCode: p.genotype.value,
    });
  }

  return {
    resourceType: "Patient",
    id,
    identifier: identifiers.length ? identifiers : undefined,
    name,
    gender:
      p.sex?.value === "M"
        ? "male"
        : p.sex?.value === "F"
          ? "female"
          : "unknown",
    birthDate: p.date_of_birth?.value,
    telecom: telecom.length ? telecom : undefined,
    address: p.address?.value ? [{ text: p.address.value }] : undefined,
    extension: extension.length ? extension : undefined,
  };
}

function buildEncounter(
  id: string,
  visit: ExtractedVisit,
  patientRef: string,
): FhirEncounter {
  return {
    resourceType: "Encounter",
    id,
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory",
    },
    subject: { reference: patientRef },
    period: visit.visit_date?.value
      ? { start: visit.visit_date.value }
      : undefined,
    reasonCode: visit.presenting_complaint?.value
      ? [{ text: visit.presenting_complaint.value }]
      : undefined,
  };
}

function buildVitalObservations(
  date: string | undefined,
  visit: ExtractedVisit,
  patientRef: string,
  encounterRef: string,
): FhirObservation[] {
  const out: FhirObservation[] = [];
  const v = visit.vitals;
  if (!v) return out;

  const make = (
    code: string,
    display: string,
    valueQuantity: { value: number; unit: string },
  ): FhirObservation => ({
    resourceType: "Observation",
    id: `obs_${code}_${randomId()}`,
    status: "final",
    category: [
      {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs",
          },
        ],
      },
    ],
    code: {
      coding: [{ system: "http://loinc.org", code, display }],
      text: display,
    },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    effectiveDateTime: date,
    valueQuantity: {
      ...valueQuantity,
      system: "http://unitsofmeasure.org",
    },
  });

  // Composite BP observation (LOINC 85354-9)
  if (
    typeof v.bp_systolic?.value === "number" ||
    typeof v.bp_diastolic?.value === "number"
  ) {
    const components: FhirObservation["component"] = [];
    if (typeof v.bp_systolic?.value === "number") {
      components.push({
        code: {
          coding: [
            { system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" },
          ],
        },
        valueQuantity: { value: v.bp_systolic.value, unit: "mmHg" },
      });
    }
    if (typeof v.bp_diastolic?.value === "number") {
      components.push({
        code: {
          coding: [
            { system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" },
          ],
        },
        valueQuantity: { value: v.bp_diastolic.value, unit: "mmHg" },
      });
    }
    out.push({
      resourceType: "Observation",
      id: `obs_bp_${randomId()}`,
      status: "final",
      category: [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
              display: "Vital Signs",
            },
          ],
        },
      ],
      code: {
        coding: [
          { system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel" },
        ],
        text: "Blood pressure",
      },
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      effectiveDateTime: date,
      component: components,
    });
  }

  if (typeof v.temperature_c?.value === "number") {
    out.push(make("8310-5", "Body temperature", { value: v.temperature_c.value, unit: "Cel" }));
  }
  if (typeof v.pulse_bpm?.value === "number") {
    out.push(make("8867-4", "Heart rate", { value: v.pulse_bpm.value, unit: "/min" }));
  }
  if (typeof v.weight_kg?.value === "number") {
    out.push(make("29463-7", "Body weight", { value: v.weight_kg.value, unit: "kg" }));
  }
  if (typeof v.height_cm?.value === "number") {
    out.push(make("8302-2", "Body height", { value: v.height_cm.value, unit: "cm" }));
  }

  return out;
}

function buildCondition(
  id: string,
  dx: ExtractedDiagnosis,
  patientRef: string,
  encounterRef?: string,
  recordedDate?: string,
): FhirCondition | null {
  if (!dx.text) return null;
  return {
    resourceType: "Condition",
    id,
    clinicalStatus: {
      coding: [
        {
          system:
            "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
        },
      ],
    },
    code: {
      coding: dx.icd10_code
        ? [
            {
              system: "http://hl7.org/fhir/sid/icd-10",
              code: dx.icd10_code,
              display: dx.text,
            },
          ]
        : undefined,
      text: dx.text,
    },
    subject: { reference: patientRef },
    encounter: encounterRef ? { reference: encounterRef } : undefined,
    recordedDate,
  };
}

function buildMedicationRequest(
  id: string,
  med: ExtractedMedication,
  patientRef: string,
  encounterRef?: string,
  authoredOn?: string,
): FhirMedicationRequest | null {
  const name = med.name?.value;
  if (!name) return null;
  const doseText = [
    med.dose?.value,
    med.frequency?.value,
    med.duration?.value && `× ${med.duration.value}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    resourceType: "MedicationRequest",
    id,
    status: "active",
    intent: "order",
    medicationCodeableConcept: {
      coding: med.atc_code?.value
        ? [
            {
              system: "http://www.whocc.no/atc",
              code: med.atc_code.value,
              display: name,
            },
          ]
        : undefined,
      text: name,
    },
    subject: { reference: patientRef },
    encounter: encounterRef ? { reference: encounterRef } : undefined,
    authoredOn,
    dosageInstruction: doseText
      ? [
          {
            text: doseText,
            timing: med.frequency?.value
              ? { code: { text: med.frequency.value } }
              : undefined,
            route: med.route?.value ? { text: med.route.value } : undefined,
          },
        ]
      : undefined,
  };
}

function buildLabObservation(
  id: string,
  r: ExtractedLabResult,
  patientRef: string,
  effective?: string,
): FhirObservation | null {
  const analyte = r.analyte?.value;
  if (!analyte) return null;
  const numeric = r.value?.value && Number(r.value.value);
  const useQty = typeof numeric === "number" && !Number.isNaN(numeric);
  return {
    resourceType: "Observation",
    id,
    status: "final",
    category: [
      {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "laboratory",
            display: "Laboratory",
          },
        ],
      },
    ],
    code: {
      coding: r.loinc_code?.value
        ? [
            {
              system: "http://loinc.org",
              code: r.loinc_code.value,
              display: analyte,
            },
          ]
        : undefined,
      text: analyte,
    },
    subject: { reference: patientRef },
    effectiveDateTime: effective,
    valueQuantity:
      useQty && r.unit?.value
        ? { value: numeric as number, unit: r.unit.value }
        : undefined,
    valueString: !useQty ? r.value?.value : undefined,
    interpretation: r.flag?.value
      ? [
          {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                code: flagToCode(r.flag.value),
              },
            ],
          },
        ]
      : undefined,
    referenceRange: r.reference_range?.value
      ? [{ text: r.reference_range.value }]
      : undefined,
  };
}

/* ── Helpers ───────────────────────────────────────────────────── */

function splitName(text: string): { family?: string; given?: string[] } {
  const parts = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { family: parts[0] };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1) };
}

function flagToCode(flag: string): string {
  switch (flag.toLowerCase()) {
    case "high":
      return "H";
    case "low":
      return "L";
    case "critical_high":
      return "HH";
    case "critical_low":
      return "LL";
    case "abnormal":
      return "A";
    default:
      return "N";
  }
}

function randomId(): string {
  // 12-char base36 — enough for FHIR resource ids inside a bundle
  return Math.random().toString(36).slice(2, 14);
}
