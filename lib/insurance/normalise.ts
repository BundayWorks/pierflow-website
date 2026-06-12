/**
 * AI-assisted normalisation — mapping HMO-native plan formats into the
 * Universal Plan Schema.
 *
 * Two public entry points:
 *
 *   proposeMapping(sample)
 *     One Haiku call. Takes a single native plan as JSON, returns a
 *     proposed UniversalPlan + per-field { jsonPath, confidence,
 *     justification }. Staff reviews + confirms in the portal.
 *
 *   applyMapping(template, sample)
 *     Runtime path. Walks each entry in the connector's catalogue push
 *     through the saved JSONPath template and emits a UniversalPlan.
 *     Cheap, deterministic, no Haiku call.
 *
 * When applyMapping fails on a specific plan (missing required path,
 * type mismatch) the catalogue ingest path falls back to
 * proposeMapping for just that plan — so one weird plan doesn't poison
 * the whole push. That fallback wiring lives in lib/insurance/catalogue.ts
 * once we plug it in; this file owns just the two pure primitives.
 *
 * Path syntax (a JSONPath subset; small enough to walk without a
 * library):
 *   "plan.outpatient.limit"     dotted path
 *   "tiers[0].monthly"          numeric index
 *   "tiers[?(@.scope='IND')]"   NOT supported in MVP — keep templates simple
 *
 * Transforms (optional per-field): apply after the path resolves the
 * source value:
 *   "kobo_from_naira"   number * 100  → BigInt-safe at the API boundary
 *   "kobo_from_string"  strip ₦ + commas, then * 100
 *   "iso_date"          best-effort YYYY-MM-DD coercion
 *   "lowercase_enum"    matches a tolerant set to the target enum
 */

import Anthropic from "@anthropic-ai/sdk";
import { universalPlanSchema, type UniversalPlan } from "./plan-schema.ts";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4_096;
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
export const PROMPT_VERSION = "normalise.v1";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Cannot call Haiku for normalisation.",
      );
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type TemplateTransform =
  | "kobo_from_naira"
  | "kobo_from_string"
  | "iso_date"
  | "lowercase_enum";

export type TemplateField = {
  /** Path into the source JSON. Dotted with optional [n] indices. */
  jsonPath: string;
  /** Optional value transform applied after resolving the path. */
  transform?: TemplateTransform;
  /**
   * Optional fallback literal value used if the path resolves to
   * null / undefined. Lets the template encode "default to MONTHLY
   * billing when the source omits it."
   */
  fallback?: unknown;
};

/**
 * A confirmed template: every Universal Plan Schema field that should
 * be populated maps to a TemplateField. Fields omitted from the
 * template are simply absent from the emitted plan.
 *
 * Keys are dotted paths into the Universal Plan Schema:
 *   "name"                          → string
 *   "scope"                         → enum
 *   "billing_frequency"             → enum
 *   "coverage.outpatient.limit"     → number (often kobo)
 *   "pricing.individual_monthly"    → number (kobo)
 *   "pricing.age_bands"             → array — see "array of objects"
 *
 * Arrays of objects (age_bands, exclusions, network providers) use a
 * special "_each" sub-template. See ProposalField below.
 */
export type Template = Record<string, TemplateField | TemplateArrayField>;

/**
 * Array-of-objects template fragment. `each.jsonPath` is the path to
 * the source array; `each.template` maps each element to an object
 * with the listed sub-fields.
 */
export type TemplateArrayField = {
  each: {
    jsonPath: string;
    template: Record<string, TemplateField>;
  };
};

export type ProposalField = {
  jsonPath: string;
  /** 0..1 — Haiku's stated reliability in the path it picked. */
  confidence: number;
  /** Free-text rationale shown to the reviewer. */
  justification: string;
  /** Optional transform Haiku suggests. */
  transform?: TemplateTransform;
};

export type Proposal = {
  /** The complete proposed UniversalPlan as Haiku would emit it. */
  proposedPlan: UniversalPlan;
  /** Per-field mapping rationale. Keys mirror Template. */
  fields: Record<string, ProposalField | { each: { jsonPath: string; fields: Record<string, ProposalField> } }>;
  /** Free-form notes from the model — "source omits dental → I set covered=false." */
  notes: string;
  /** Average confidence across all leaf fields, 0..1. */
  averageConfidence: number;
  /** Field paths whose confidence < LOW_CONFIDENCE_THRESHOLD. */
  lowConfidencePaths: string[];
  diagnostics: {
    model: string;
    promptVersion: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
};

// ─────────────────────────────────────────────────────────────────────
// proposeMapping — the Haiku call
// ─────────────────────────────────────────────────────────────────────

/**
 * Call Haiku with a single native plan sample and the Universal Plan
 * Schema definition. Returns a Proposal staff reviews + confirms.
 *
 * The Universal Plan Schema description is marked cacheable so a
 * burst of new HMO onboardings keeps the cache warm and the marginal
 * call cost low.
 */
export async function proposeMapping(input: {
  /** The HMO's native plan as a parsed JSON object. */
  sample: unknown;
  /** Optional EMR vendor / HMO name — context only, doesn't change shape. */
  providerName?: string;
}): Promise<Proposal> {
  const systemPrompt = buildSystemPrompt();
  const userText = buildUserPrompt({
    sample: input.sample,
    providerName: input.providerName,
  });

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userText }],
      },
    ],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => ("text" in c ? c.text : ""))
    .join("\n")
    .trim();

  const parsed = safeParseJson(text);
  if (!isProposalShape(parsed)) {
    throw new Error(
      "Haiku returned an unexpected shape. Model output was not a valid proposal envelope.",
    );
  }

  // Validate the proposedPlan against our Zod schema. If the model
  // produced something invalid, we surface it as a low-confidence
  // signal — staff can fix in the review UI rather than failing hard.
  const planCheck = universalPlanSchema.safeParse(parsed.proposedPlan);
  const notes = planCheck.success
    ? parsed.notes ?? ""
    : `${parsed.notes ?? ""}\n\n[Validator] Proposed plan didn't match Universal Plan Schema:\n${planCheck.error.issues
        .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n")}`;

  const { avg, lows } = scanConfidence(parsed.fields);

  return {
    proposedPlan: parsed.proposedPlan as UniversalPlan,
    fields: parsed.fields as Proposal["fields"],
    notes,
    averageConfidence: avg,
    lowConfidencePaths: lows,
    diagnostics: {
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
      cacheCreationTokens:
        response.usage.cache_creation_input_tokens ?? undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// applyMapping — the runtime path
// ─────────────────────────────────────────────────────────────────────

export type ApplyResult =
  | { ok: true; plan: UniversalPlan }
  | { ok: false; issues: string[] };

/**
 * Walk a single source plan through a confirmed template and emit a
 * UniversalPlan. Returns issues (not throws) so the catalogue ingest
 * path can decide whether to retry via Haiku.
 */
export function applyMapping(template: Template, sample: unknown): ApplyResult {
  const out: Record<string, unknown> = {};
  const issues: string[] = [];

  for (const [planPath, field] of Object.entries(template)) {
    try {
      if (isArrayField(field)) {
        const sourceArray = getPath(sample, field.each.jsonPath);
        if (!Array.isArray(sourceArray)) {
          // Empty array is fine; missing / non-array is a soft issue.
          if (sourceArray !== undefined && sourceArray !== null) {
            issues.push(
              `${planPath}: source ${field.each.jsonPath} is not an array.`,
            );
          }
          setPath(out, planPath, []);
          continue;
        }
        const rows = sourceArray.map((row, i) => {
          const o: Record<string, unknown> = {};
          for (const [subPath, subField] of Object.entries(field.each.template)) {
            const value = resolveField(row, subField);
            if (value !== undefined) setPath(o, subPath, value);
          }
          if (Object.keys(o).length === 0) {
            issues.push(
              `${planPath}[${i}]: every sub-field was missing — check template.`,
            );
          }
          return o;
        });
        setPath(out, planPath, rows);
      } else {
        const value = resolveField(sample, field);
        if (value === undefined) {
          // Treat omitted optional fields silently; required fields
          // surface in Zod validation below.
          continue;
        }
        setPath(out, planPath, value);
      }
    } catch (err) {
      issues.push(
        `${planPath}: ${(err as Error).message ?? "unknown applier error"}`,
      );
    }
  }

  // Sanity-check against the Universal Plan Schema. If the produced
  // plan is invalid we hand back issues so the orchestrator can decide
  // whether to fall back to per-plan Haiku.
  const parsed = universalPlanSchema.safeParse(out);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        ...issues,
        ...parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      ],
    };
  }
  if (issues.length > 0) {
    // Plan is valid but the template wasn't clean — surface for ops
    // logging, but proceed.
    return { ok: true, plan: parsed.data };
  }
  return { ok: true, plan: parsed.data };
}

// ─────────────────────────────────────────────────────────────────────
// Path + transform internals
// ─────────────────────────────────────────────────────────────────────

function isArrayField(f: TemplateField | TemplateArrayField): f is TemplateArrayField {
  return typeof f === "object" && f !== null && "each" in f;
}

function resolveField(source: unknown, field: TemplateField): unknown {
  let value = getPath(source, field.jsonPath);
  if (value === undefined || value === null) {
    if (field.fallback !== undefined) return field.fallback;
    return undefined;
  }
  if (field.transform) value = applyTransform(value, field.transform);
  return value;
}

/** A small dotted/[n]-indexed path resolver. No JSONPath filter syntax. */
export function getPath(root: unknown, path: string): unknown {
  if (!path) return root;
  // Tolerate the canonical JSONPath root marker ("$" or "$.foo.bar")
  // that some AI proposers emit. We're not a real JSONPath engine —
  // we treat the whole input as a dotted/[n]-indexed path off root —
  // so the prefix is purely a noisy header to strip.
  let normalised = path;
  if (normalised.startsWith("$.")) normalised = normalised.slice(2);
  else if (normalised === "$") return root;
  else if (normalised.startsWith("$[")) normalised = normalised.slice(1);
  // Split by "." and [n] tokens, ignoring empty segments.
  const tokens: (string | number)[] = [];
  const re = /([^.\[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalised)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else tokens.push(Number(m[2]));
  }

  let cursor: unknown = root;
  for (const tok of tokens) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof tok === "number") {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[tok];
    } else {
      if (typeof cursor !== "object") return undefined;
      cursor = (cursor as Record<string, unknown>)[tok];
    }
  }
  return cursor;
}

function setPath(root: Record<string, unknown>, path: string, value: unknown) {
  const tokens = path.split(".").filter(Boolean);
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const k = tokens[i];
    if (
      typeof cursor[k] !== "object" ||
      cursor[k] === null ||
      Array.isArray(cursor[k])
    ) {
      cursor[k] = {};
    }
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[tokens[tokens.length - 1]] = value;
}

function applyTransform(value: unknown, t: TemplateTransform): unknown {
  switch (t) {
    case "kobo_from_naira": {
      const n = Number(value);
      if (!Number.isFinite(n)) return undefined;
      return Math.round(n * 100);
    }
    case "kobo_from_string": {
      if (typeof value !== "string") return undefined;
      const cleaned = value.replace(/[₦,\s]/g, "");
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return undefined;
      return Math.round(n * 100);
    }
    case "iso_date": {
      if (typeof value !== "string") return undefined;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return undefined;
      return d.toISOString();
    }
    case "lowercase_enum": {
      if (typeof value !== "string") return undefined;
      return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
    }
    default:
      return value;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Prompt builders (internal — do not log)
// ─────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a data-mapping specialist for Pierflow, the connectivity layer for African healthcare. Your job is to translate health-plan data from any HMO or EMR vendor into Pierflow's Universal Plan Schema.

You'll be given a single native plan as JSON (or similar structure). Produce:
  (a) a complete proposed plan in Universal Plan Schema format
  (b) a per-field mapping showing the JSONPath in the source you used,
      a confidence score 0..1, and a short justification
  (c) any notes about defaults or assumptions you applied

Universal Plan Schema (must match exactly):
{
  "external_id": "string — the HMO's native plan id",
  "name": "string",
  "scope": "INDIVIDUAL | FAMILY | EMPLOYEE_GROUP | STUDENT | OTHER",
  "status": "DRAFT | ACTIVE | WITHDRAWN",
  "billing_frequency": "MONTHLY | QUARTERLY | ANNUAL",
  "coverage": {
    "outpatient":   { "covered": bool, "limit": kobo, "co_pay_percent": 0..100 },
    "inpatient":    { "covered": bool, "limit": kobo, "co_pay_percent": 0..100 },
    "maternity":    { "covered": bool, "limit": kobo, "waiting_period_days": int },
    "dental":       { "covered": bool, "limit": kobo? },
    "optical":      { "covered": bool, "limit": kobo? },
    "emergency":    { "covered": bool, "limit": kobo? },
    "telemedicine": { "covered": bool, "unlimited": bool? },
    "diagnostics":  { "covered": bool, "limit": kobo? },
    "pharmacy":     { "covered": bool, "limit": kobo? },
    "mental_health":{ "covered": bool, "limit": kobo? },
    "wellness":     { "covered": bool, "limit": kobo? }
  },
  "pricing": {
    "individual_monthly": kobo,                     // required
    "age_bands": [ { "min_age": int, "max_age": int, "monthly": kobo } ],
    "family_rate": kobo?,
    "employer_discount_percent": 0..100?
  },
  "waiting_periods": { "general": days, "maternity": days, "pre_existing": days } ?,
  "exclusions": [ "string", ... ] ?,
  "effective_from": "ISO-8601 datetime" ?,
  "effective_to": "ISO-8601 datetime" ?
}

Money rules (apply silently):
- All monetary fields are integer kobo (NGN minor units). ₦200 = 20000.
- If the source data is in naira (e.g. "200000", "₦200,000", "NGN 200000"), multiply by 100.
- If the source data is in kobo already, leave it.
- If unclear, assume naira (the common case in Nigerian HMO data).

Field rules:
- billing_frequency: "monthly", "per month", "MTH" → MONTHLY. Quarterly / yearly likewise.
- scope: "individual" / "single" → INDIVIDUAL; "family" / "household" → FAMILY; "corporate" / "group" → EMPLOYEE_GROUP.
- coverage.<benefit>.covered: if the source explicitly says false / excluded / not covered, mark false. If silent and the plan looks comprehensive, default true with confidence 0.5.
- Don't invent fields the source doesn't support. Omit rather than guess.
- For age_bands: if the source has only one premium, omit age_bands (the engine falls back to individual_monthly).

Output (return ONLY valid JSON, no prose, no fences):
{
  "proposedPlan": { ...UniversalPlan above... },
  "fields": {
    "name":                       { "jsonPath": "...", "confidence": 0..1, "justification": "..." },
    "scope":                      { ... },
    "billing_frequency":          { ... },
    "coverage.outpatient.limit":  { "jsonPath": "...", "confidence": 0..1, "justification": "...", "transform": "kobo_from_naira" },
    ...
    "pricing.age_bands": {
      "each": {
        "jsonPath": "tiers",
        "fields": {
          "min_age": { "jsonPath": "lo", "confidence": 0.9, "justification": "..." },
          "max_age": { "jsonPath": "hi", "confidence": 0.9, "justification": "..." },
          "monthly": { "jsonPath": "monthly", "confidence": 0.9, "justification": "...", "transform": "kobo_from_naira" }
        }
      }
    }
  },
  "notes": "Free-form text — call out anything important about defaults or assumptions."
}

CRITICAL output rules:
- The "fields" object MUST be present at top level even if minimal.
- For array fields, use \`each\` with sub-key "fields" (NOT "template").
  If the source doesn't have a clear array, omit that field from "fields"
  entirely — do not emit \`each\` with empty or null content.
- Every leaf entry under "fields" (and under each.fields) MUST contain
  at minimum: jsonPath (string) and confidence (number 0..1).
- If you can't find a mapping for a Universal Plan Schema field, OMIT
  it from "fields" instead of writing { "jsonPath": null }. The runtime
  will fall back to a default.

Available transforms (use when the source needs coercion):
- "kobo_from_naira" — multiply by 100
- "kobo_from_string" — strip currency symbols/commas, then multiply by 100
- "iso_date" — coerce a date string to ISO-8601
- "lowercase_enum" — uppercase + underscore-normalise an enum-ish string

Confidence scoring:
- 1.0 — exact, unambiguous field match.
- 0.85 — clear but required a transform.
- 0.7 — semantically right but the source field name is non-obvious.
- 0.5 — defaulted because source is silent.
- < 0.5 — guessing. Omit the field instead.`;
}

function buildUserPrompt(input: { sample: unknown; providerName?: string }): string {
  const ctx = input.providerName ? `HMO / vendor: ${input.providerName}\n\n` : "";
  return `${ctx}Native plan JSON:

\`\`\`json
${JSON.stringify(input.sample, null, 2)}
\`\`\`

Produce the proposal envelope now. Return only valid JSON.`;
}

// ─────────────────────────────────────────────────────────────────────
// Parsing helpers
// ─────────────────────────────────────────────────────────────────────

function safeParseJson(text: string): unknown {
  // Tolerate occasional code fences even though the prompt forbids them.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function isProposalShape(v: unknown): v is {
  proposedPlan: unknown;
  fields: Record<string, unknown>;
  notes?: string;
} {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.proposedPlan !== "object" || o.proposedPlan === null) return false;
  if (typeof o.fields !== "object" || o.fields === null) return false;
  return true;
}

function scanConfidence(
  fields: unknown,
): { avg: number; lows: string[] } {
  const leaves: { path: string; conf: number }[] = [];
  const walk = (obj: unknown, prefix: string) => {
    if (typeof obj !== "object" || obj === null) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v !== "object" || v === null) continue;
      const node = v as Record<string, unknown>;
      if ("each" in node) {
        // Tolerate Haiku occasionally returning each.fields = null,
        // each.template (wrong key from its own confusion with our
        // runtime Template), or an empty object. None should throw.
        const each = node.each as Record<string, unknown> | null | undefined;
        const sub =
          each && typeof each === "object"
            ? (each.fields ?? each.template)
            : null;
        if (sub && typeof sub === "object") {
          walk(sub, prefix ? `${prefix}.${k}.each` : `${k}.each`);
        }
      } else if ("confidence" in node) {
        const conf = Number(node.confidence ?? NaN);
        if (Number.isFinite(conf)) {
          leaves.push({ path: prefix ? `${prefix}.${k}` : k, conf });
        }
      }
    }
  };
  walk(fields, "");
  if (leaves.length === 0) return { avg: 0, lows: [] };
  const avg = leaves.reduce((a, b) => a + b.conf, 0) / leaves.length;
  const lows = leaves
    .filter((l) => l.conf < LOW_CONFIDENCE_THRESHOLD)
    .map((l) => l.path);
  return { avg, lows };
}
