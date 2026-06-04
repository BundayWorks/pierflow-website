/**
 * Validation rules + completeness scoring for an ExtractedRecord.
 *
 * Two outputs:
 *   1. A list of structured ValidationIssues. Severity drives the
 *      routing decision (auto-approve / soft-flag / human review).
 *   2. A 0–100 completeness score combining required-field presence,
 *      core-field presence, and average extraction confidence.
 *
 * Rules are conservative — we'd rather flag a clinically-plausible
 * outlier for review than reject it. The validator does not throw.
 */

import type { ExtractedJson } from "@/lib/fhir/mapper";

export type ValidationSeverity = "ERROR" | "WARN";
export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  /** Dotted path into the extracted JSON, when applicable. */
  path?: string;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  completenessScore: number; // 0..100
  disposition: "AUTO_APPROVE" | "AUTO_APPROVE_FLAGGED" | "REVIEW" | "URGENT_REVIEW";
};

/* ── Public entry ─────────────────────────────────────────────── */

export function validateExtraction(input: {
  data: ExtractedJson;
  avgConfidence: number;
}): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Required fields
  checkRequired(input.data, issues);
  // Clinical consistency
  checkClinical(input.data, issues);

  const completenessScore = computeCompleteness(input.data, input.avgConfidence);

  // Disposition
  const hasErrors = issues.some((i) => i.severity === "ERROR");
  let disposition: ValidationResult["disposition"];
  if (hasErrors) {
    disposition = "REVIEW";
  } else if (completenessScore >= 85) {
    disposition = "AUTO_APPROVE";
  } else if (completenessScore >= 70) {
    disposition = "AUTO_APPROVE_FLAGGED";
  } else if (completenessScore >= 50) {
    disposition = "REVIEW";
  } else {
    disposition = "URGENT_REVIEW";
  }

  return { issues, completenessScore, disposition };
}

/* ── Required field checks ────────────────────────────────────── */

function checkRequired(data: ExtractedJson, issues: ValidationIssue[]): void {
  const fullName = data.patient?.full_name?.value?.trim();
  if (!fullName || fullName.length < 2) {
    issues.push({
      code: "PATIENT_NAME_MISSING",
      severity: "ERROR",
      message: "Patient name is required and must be at least 2 characters.",
      path: "patient.full_name",
    });
  }

  const dob = data.patient?.date_of_birth?.value;
  const age = data.patient?.age?.value;
  if (!dob && (age == null || Number.isNaN(Number(age)))) {
    issues.push({
      code: "PATIENT_AGE_OR_DOB_MISSING",
      severity: "ERROR",
      message: "At least one of date of birth or age is required.",
      path: "patient",
    });
  }

  if (dob && !isPastDateString(dob)) {
    issues.push({
      code: "PATIENT_DOB_NOT_PAST",
      severity: "ERROR",
      message: "Date of birth must be a valid past date.",
      path: "patient.date_of_birth",
    });
  }

  const sex = data.patient?.sex?.value;
  if (sex && !["M", "F", "U"].includes(sex)) {
    issues.push({
      code: "PATIENT_SEX_INVALID",
      severity: "ERROR",
      message: "Patient sex must be M, F, or U.",
      path: "patient.sex",
    });
  }

  (data.visits ?? []).forEach((visit, i) => {
    const date = visit.visit_date?.value;
    if (!date) {
      issues.push({
        code: "VISIT_DATE_MISSING",
        severity: "WARN",
        message: "Visit date is missing.",
        path: `visits[${i}].visit_date`,
      });
    } else {
      if (!isPastDateString(date)) {
        issues.push({
          code: "VISIT_DATE_NOT_PAST",
          severity: "ERROR",
          message: "Visit date must be a valid non-future date.",
          path: `visits[${i}].visit_date`,
        });
      }
      if (dob && date < dob) {
        issues.push({
          code: "VISIT_DATE_BEFORE_DOB",
          severity: "ERROR",
          message: "Visit date occurs before the patient's date of birth.",
          path: `visits[${i}].visit_date`,
        });
      }
    }

    if (!visit.diagnoses?.length && !visit.presenting_complaint?.value) {
      issues.push({
        code: "VISIT_CLINICAL_CONTEXT_MISSING",
        severity: "WARN",
        message:
          "Visit has neither a presenting complaint nor a diagnosis — clinical context is thin.",
        path: `visits[${i}]`,
      });
    }
  });
}

/* ── Clinical consistency ─────────────────────────────────────── */

function checkClinical(data: ExtractedJson, issues: ValidationIssue[]): void {
  // Per-visit checks
  (data.visits ?? []).forEach((visit, i) => {
    const v = visit.vitals;
    if (v) {
      const sys = v.bp_systolic?.value;
      const dia = v.bp_diastolic?.value;
      if (typeof sys === "number") {
        if (sys < 50 || sys > 300) {
          issues.push({
            code: "BP_SYSTOLIC_OUT_OF_RANGE",
            severity: "WARN",
            message: `Systolic BP ${sys} mmHg is outside the plausible 50–300 range.`,
            path: `visits[${i}].vitals.bp_systolic`,
          });
        }
      }
      if (typeof dia === "number") {
        if (dia < 20 || dia > 200) {
          issues.push({
            code: "BP_DIASTOLIC_OUT_OF_RANGE",
            severity: "WARN",
            message: `Diastolic BP ${dia} mmHg is outside the plausible 20–200 range.`,
            path: `visits[${i}].vitals.bp_diastolic`,
          });
        }
      }
      if (typeof sys === "number" && typeof dia === "number" && sys <= dia) {
        issues.push({
          code: "BP_SYSTOLIC_NOT_GREATER_THAN_DIASTOLIC",
          severity: "ERROR",
          message: `Systolic (${sys}) must be greater than diastolic (${dia}).`,
          path: `visits[${i}].vitals`,
        });
      }

      const temp = v.temperature_c?.value;
      if (typeof temp === "number" && (temp < 30 || temp > 43)) {
        issues.push({
          code: "TEMPERATURE_OUT_OF_RANGE",
          severity: "WARN",
          message: `Temperature ${temp}°C is outside the plausible 30–43 range.`,
          path: `visits[${i}].vitals.temperature_c`,
        });
      }
    }
  });

  // Age vs DOB consistency
  const dob = data.patient?.date_of_birth?.value;
  const statedAge = data.patient?.age?.value;
  if (
    dob &&
    typeof statedAge === "number" &&
    !Number.isNaN(statedAge) &&
    isPastDateString(dob)
  ) {
    const calculated = calculateAgeYears(dob);
    if (calculated !== null && Math.abs(calculated - statedAge) > 3) {
      issues.push({
        code: "AGE_DOB_INCONSISTENT",
        severity: "WARN",
        message: `Stated age ${statedAge} differs from calculated age ${calculated} by more than 3 years.`,
        path: "patient",
      });
    }
  }

  // Visit dates must be in chronological order
  const visitDates = (data.visits ?? [])
    .map((v) => v.visit_date?.value)
    .filter((d): d is string => Boolean(d));
  for (let i = 1; i < visitDates.length; i++) {
    if (visitDates[i] < visitDates[i - 1]) {
      issues.push({
        code: "VISIT_DATES_OUT_OF_ORDER",
        severity: "WARN",
        message: "Visit dates are not in chronological order.",
        path: "visits",
      });
      break;
    }
  }
}

/* ── Completeness ─────────────────────────────────────────────── */

function computeCompleteness(data: ExtractedJson, avgConfidence: number): number {
  // 50 pts: required field presence
  let required = 0;
  const requiredWeights: [boolean, number][] = [
    [!!data.patient?.full_name?.value, 20],
    [!!data.patient?.date_of_birth?.value || !!data.patient?.age?.value, 15],
    [!!data.patient?.sex?.value, 5],
    [(data.visits ?? []).length > 0 ||
      (data.diagnoses ?? []).length > 0 ||
      (data.items ?? []).length > 0 ||
      (data.results ?? []).length > 0, 10],
  ];
  requiredWeights.forEach(([ok, w]) => {
    if (ok) required += w;
  });

  // 30 pts: core fields
  let core = 0;
  const coreWeights: [boolean, number][] = [
    [!!data.patient?.mrn?.value, 5],
    [(data.identifiers ?? []).length > 0, 5],
    [
      (data.visits ?? []).some((v) => v.vitals && Object.keys(v.vitals).length > 0),
      5,
    ],
    [
      (data.visits ?? []).some((v) => (v.diagnoses ?? []).length > 0) ||
        (data.diagnoses ?? []).length > 0,
      8,
    ],
    [
      (data.visits ?? []).some((v) => (v.medications ?? []).length > 0) ||
        (data.items ?? []).length > 0,
      4,
    ],
    [
      (data.visits ?? []).some((v) => !!v.clinician?.value) ||
        !!data.prescriber?.value,
      3,
    ],
  ];
  coreWeights.forEach(([ok, w]) => {
    if (ok) core += w;
  });

  // 20 pts: average confidence (already 0..1)
  const conf = Math.max(0, Math.min(1, avgConfidence)) * 20;

  return Math.round(required + core + conf);
}

/* ── Tiny helpers ─────────────────────────────────────────────── */

function isPastDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  const d = Date.parse(s);
  if (Number.isNaN(d)) return false;
  return d <= Date.now();
}

function calculateAgeYears(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
