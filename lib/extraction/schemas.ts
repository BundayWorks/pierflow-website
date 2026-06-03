/**
 * Per-document-type JSON schemas the model is asked to populate.
 *
 * Every leaf field carries:
 *   { value, _confidence: 0–1, _raw: original text segment }
 *
 * Schemas are deliberately conservative — we'd rather have a small set
 * of high-value fields with reliable confidence than a sprawling shape
 * the model fills with noise.
 */

import type { DocumentType } from "@prisma/client";

export type ExtractionSchemaName =
  | "OUTPATIENT_CARD"
  | "REGISTRATION"
  | "LAB_RESULT"
  | "PRESCRIPTION"
  | "GENERIC";

export function schemaFor(docType: DocumentType): {
  name: ExtractionSchemaName;
  description: string;
} {
  switch (docType) {
    case "OUTPATIENT_CARD":
      return {
        name: "OUTPATIENT_CARD",
        description:
          "General outpatient clinical visit record — demographics + visits with vitals, diagnoses, medications.",
      };
    case "REGISTRATION":
      return {
        name: "REGISTRATION",
        description:
          "Patient registration / enrolment form — demographics, identifiers, contact, allergies.",
      };
    case "LAB_RESULT":
      return {
        name: "LAB_RESULT",
        description:
          "Lab investigation result — patient, requester, panel, individual analyte values with units and reference ranges.",
      };
    case "PRESCRIPTION":
      return {
        name: "PRESCRIPTION",
        description:
          "Drug prescription — prescriber, patient, individual prescription items with dose, route, frequency, duration.",
      };
    default:
      return {
        name: "GENERIC",
        description:
          "Unknown / mixed clinical record — extract whatever patient, visit, diagnosis, medication, and observation data is visible.",
      };
  }
}

/**
 * Return the JSON-schema-as-text the model is asked to fill. We pass
 * this in the system prompt (cacheable) so the variable portion of the
 * request is just the image.
 *
 * Keep schemas as strings rather than building real zod / JSON Schema
 * structures — the model receives them as instructions, not as
 * validators, and the text form is easier to tune.
 */
export function schemaInstructionFor(name: ExtractionSchemaName): string {
  switch (name) {
    case "OUTPATIENT_CARD":
      return OUTPATIENT_CARD_SCHEMA;
    case "REGISTRATION":
      return REGISTRATION_SCHEMA;
    case "LAB_RESULT":
      return LAB_RESULT_SCHEMA;
    case "PRESCRIPTION":
      return PRESCRIPTION_SCHEMA;
    case "GENERIC":
    default:
      return GENERIC_SCHEMA;
  }
}

/* ── Field envelope used everywhere ───────────────────────────── */

const FIELD_NOTE = `
Every leaf field is an object: { "value": <typed value>, "_confidence": 0..1, "_raw": "original text segment used" }.
If you cannot read a field, omit it entirely rather than guessing.`.trim();

/* ── Schemas ─────────────────────────────────────────────────── */

const OUTPATIENT_CARD_SCHEMA = `
${FIELD_NOTE}

Schema:
{
  "patient": {
    "mrn":           { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "full_name":     { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "date_of_birth": { "value": "YYYY-MM-DD", "_confidence": 0.0, "_raw": "..." },
    "age":           { "value": 0, "_confidence": 0.0, "_raw": "..." },
    "sex":           { "value": "M|F|U", "_confidence": 0.0, "_raw": "..." },
    "blood_group":   { "value": "A+|A-|B+|B-|AB+|AB-|O+|O-|U", "_confidence": 0.0, "_raw": "..." },
    "genotype":      { "value": "AA|AS|SS|AC|SC|CC|U", "_confidence": 0.0, "_raw": "..." }
  },
  "visits": [
    {
      "visit_date":           { "value": "YYYY-MM-DD", "_confidence": 0.0, "_raw": "..." },
      "presenting_complaint": { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "vitals": {
        "bp_systolic":  { "value": 0, "_confidence": 0.0, "_raw": "..." },
        "bp_diastolic": { "value": 0, "_confidence": 0.0, "_raw": "..." },
        "temperature_c": { "value": 0.0, "_confidence": 0.0, "_raw": "..." },
        "pulse_bpm":    { "value": 0, "_confidence": 0.0, "_raw": "..." },
        "weight_kg":    { "value": 0.0, "_confidence": 0.0, "_raw": "..." },
        "height_cm":    { "value": 0.0, "_confidence": 0.0, "_raw": "..." }
      },
      "diagnoses": [
        { "text": "string", "icd10_code": "string", "icd10_confidence": 0.0, "_confidence": 0.0, "_raw": "..." }
      ],
      "medications": [
        {
          "name":      { "value": "string", "_confidence": 0.0, "_raw": "..." },
          "atc_code":  { "value": "string", "_confidence": 0.0, "_raw": "..." },
          "dose":      { "value": "string", "_confidence": 0.0, "_raw": "..." },
          "route":     { "value": "PO|IV|IM|SC|topical|inhaled|other", "_confidence": 0.0, "_raw": "..." },
          "frequency": { "value": "string", "_confidence": 0.0, "_raw": "..." },
          "duration":  { "value": "string", "_confidence": 0.0, "_raw": "..." }
        }
      ],
      "clinician": { "value": "string", "_confidence": 0.0, "_raw": "..." }
    }
  ]
}
`.trim();

const REGISTRATION_SCHEMA = `
${FIELD_NOTE}

Schema:
{
  "patient": {
    "mrn":           { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "full_name":     { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "date_of_birth": { "value": "YYYY-MM-DD", "_confidence": 0.0, "_raw": "..." },
    "age":           { "value": 0, "_confidence": 0.0, "_raw": "..." },
    "sex":           { "value": "M|F|U", "_confidence": 0.0, "_raw": "..." },
    "blood_group":   { "value": "A+|A-|B+|B-|AB+|AB-|O+|O-|U", "_confidence": 0.0, "_raw": "..." },
    "genotype":      { "value": "AA|AS|SS|AC|SC|CC|U", "_confidence": 0.0, "_raw": "..." },
    "phone":         { "value": "+234...", "_confidence": 0.0, "_raw": "..." },
    "email":         { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "address":       { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "next_of_kin":   { "value": "string", "_confidence": 0.0, "_raw": "..." }
  },
  "identifiers": [
    { "system": "mrn|bvn|nin|nhis|hmo_card|other", "value": "string", "_confidence": 0.0, "_raw": "..." }
  ],
  "allergies": [
    { "substance": { "value": "string", "_confidence": 0.0, "_raw": "..." } }
  ]
}
`.trim();

const LAB_RESULT_SCHEMA = `
${FIELD_NOTE}

Schema:
{
  "patient": {
    "mrn":       { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "full_name": { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "sex":       { "value": "M|F|U", "_confidence": 0.0, "_raw": "..." },
    "age":       { "value": 0, "_confidence": 0.0, "_raw": "..." }
  },
  "report": {
    "report_date":     { "value": "YYYY-MM-DD", "_confidence": 0.0, "_raw": "..." },
    "requested_by":    { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "panel":           { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "lab":             { "value": "string", "_confidence": 0.0, "_raw": "..." }
  },
  "results": [
    {
      "analyte":   { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "loinc_code": { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "value":     { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "unit":      { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "reference_range": { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "flag":      { "value": "normal|high|low|critical_high|critical_low|abnormal", "_confidence": 0.0, "_raw": "..." }
    }
  ]
}
`.trim();

const PRESCRIPTION_SCHEMA = `
${FIELD_NOTE}

Schema:
{
  "patient": {
    "mrn":       { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "full_name": { "value": "string", "_confidence": 0.0, "_raw": "..." }
  },
  "prescriber": { "value": "string", "_confidence": 0.0, "_raw": "..." },
  "prescribed_at": { "value": "YYYY-MM-DD", "_confidence": 0.0, "_raw": "..." },
  "items": [
    {
      "name":      { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "atc_code":  { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "dose":      { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "route":     { "value": "PO|IV|IM|SC|topical|inhaled|other", "_confidence": 0.0, "_raw": "..." },
      "frequency": { "value": "string", "_confidence": 0.0, "_raw": "..." },
      "duration":  { "value": "string", "_confidence": 0.0, "_raw": "..." }
    }
  ]
}
`.trim();

const GENERIC_SCHEMA = `
${FIELD_NOTE}

Schema (fill only what is visibly present):
{
  "document_type_observed": { "value": "string describing what this record actually is", "_confidence": 0.0 },
  "patient": {
    "mrn":           { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "full_name":     { "value": "string", "_confidence": 0.0, "_raw": "..." },
    "date_of_birth": { "value": "YYYY-MM-DD", "_confidence": 0.0, "_raw": "..." },
    "sex":           { "value": "M|F|U", "_confidence": 0.0, "_raw": "..." }
  },
  "visits": [
    {
      "visit_date": { "value": "YYYY-MM-DD", "_confidence": 0.0, "_raw": "..." },
      "notes":      { "value": "string", "_confidence": 0.0, "_raw": "..." }
    }
  ],
  "diagnoses": [
    { "text": "string", "icd10_code": "string", "icd10_confidence": 0.0, "_confidence": 0.0, "_raw": "..." }
  ],
  "medications": [
    { "name": { "value": "string", "_confidence": 0.0, "_raw": "..." } }
  ]
}
`.trim();
