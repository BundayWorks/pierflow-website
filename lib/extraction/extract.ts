/**
 * Claude Haiku 4.5 extraction.
 *
 * Multimodal: a single call ingests the image (via Cloudinary URL),
 * applies the schema embedded in the system prompt, and returns
 * structured JSON with per-field confidence scores.
 *
 * The system prompt is identical across every page of a given document
 * type, so we mark it cacheable. Anthropic caches the system block for
 * the lifetime of the cache (~5 minutes idle / ~1 hour active), which
 * makes the marginal cost of subsequent pages drop sharply.
 *
 * NOTE: we intentionally keep our model selection, prompt design, and
 * disambiguation strategy out of the public docs. They are competitive
 * advantage.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DocumentType } from "@prisma/client";
import { schemaFor, schemaInstructionFor } from "./schemas";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4_096;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Cannot run extraction worker.",
      );
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export type ExtractionResult = {
  /** Whatever JSON the model returned, parsed. Shape depends on schema. */
  data: unknown;
  /** Average of all leaf _confidence fields we found in `data`. */
  avgConfidence: number;
  /** Paths to fields below the per-field confidence threshold. */
  lowConfidenceFields: string[];
  /** Provenance + cost diagnostics for the audit log. */
  diagnostics: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  /** The document type the model thought it was actually looking at. */
  observedDocumentType?: string;
};

const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Extract structured data from a single page image.
 *
 * @param imageUrl  Publicly fetchable URL (Cloudinary secure_url).
 * @param hint      Hint at the document type. AUTO is fine; the model
 *                  classifies if asked.
 */
export async function extractPage(input: {
  imageUrl: string;
  hint: DocumentType;
  facilityName?: string;
}): Promise<ExtractionResult> {
  const { name: schemaName, description } = schemaFor(input.hint);
  const schemaInstruction = schemaInstructionFor(schemaName);

  const systemPrompt = buildSystemPrompt({
    schemaName,
    description,
    schemaInstruction,
  });

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // System is a single cacheable block.
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
        content: [
          {
            type: "image",
            source: { type: "url", url: input.imageUrl },
          },
          {
            type: "text",
            text: input.facilityName
              ? `Facility context: ${input.facilityName}. Extract this page now. Return only valid JSON.`
              : "Extract this page now. Return only valid JSON.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => ("text" in c ? c.text : ""))
    .join("\n")
    .trim();

  const data = safeParseJson(text);
  const { avg, lows } = scanConfidence(data);

  // Pull observed type out if the generic schema was used and the model
  // told us what the page actually is.
  let observed: string | undefined;
  if (
    schemaName === "GENERIC" &&
    typeof data === "object" &&
    data !== null &&
    "document_type_observed" in data
  ) {
    const obs = (data as Record<string, unknown>).document_type_observed;
    if (typeof obs === "object" && obs !== null && "value" in obs) {
      const v = (obs as Record<string, unknown>).value;
      if (typeof v === "string") observed = v;
    }
  }

  return {
    data,
    avgConfidence: avg,
    lowConfidenceFields: lows,
    diagnostics: {
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
      cacheCreationTokens:
        response.usage.cache_creation_input_tokens ?? undefined,
    },
    observedDocumentType: observed,
  };
}

/* ── Prompt builder (internal — never log this) ───────────────── */

function buildSystemPrompt(input: {
  schemaName: string;
  description: string;
  schemaInstruction: string;
}): string {
  return `You are a Nigerian clinical records specialist extracting structured data from a scanned medical record page.

Document context: ${input.description}

Disambiguation rules (apply silently — do not echo them in the output):
- Common Nigerian drug abbreviations: PCM=Paracetamol, AMX=Amoxicillin, MTZ=Metronidazole, ART/ARV=Antiretroviral, ORS=Oral Rehydration Salts, IVF=Intravenous Fluid, IM=intramuscular, IV=intravenous, PO=per oral, SC=subcutaneous.
- Diagnosis shorthands: HBP=Hypertension, PTB=Pulmonary Tuberculosis, SSA/SCD=Sickle Cell Anaemia/Disease, PID=Pelvic Inflammatory Disease, URTI=Upper Respiratory Tract Infection, UTI=Urinary Tract Infection, T2DM=Type 2 Diabetes Mellitus, CCF=Congestive Cardiac Failure, MI=Myocardial Infarction.
- Date formats: prefer ISO YYYY-MM-DD. "12/6/22" in Nigerian convention is DD/MM/YY → 2022-06-12. If the year is two digits and ambiguous, prefer the most recent plausible interpretation. If only a day-month is visible, use context (admission stamps, lab dates) to infer the year.
- Vitals shorthand: "BP 130/80" → systolic 130 diastolic 80. "T-37.5" or "T37.5" → temperature 37.5°C. "P 88" → pulse 88 bpm. "Wt 65" → weight 65 kg.
- Name conventions: Yoruba, Hausa, Igbo names use family-name-first in some forms. Always populate full_name with the natural spoken order (given names, then family name) when the form clearly shows family name first.
- ICD-10 codes: when you confidently know the code for a diagnosis, include it. Otherwise omit icd10_code rather than guessing.

Output requirements:
- Return ONLY a single valid JSON object, nothing else. No prose, no markdown, no code fences.
- For every leaf field include: value, _confidence (0..1), _raw (the original text segment you read).
- If a field is not visible or you cannot confidently read it, omit it entirely rather than guessing low-confidence values.
- _confidence reflects your subjective reliability in the extracted value: 1.0 = printed and unambiguous; 0.85 = handwritten and clear; 0.6 = readable with effort; below 0.4 = guessing — in which case you should omit the field instead.

Schema you must produce:
${input.schemaInstruction}`;
}

/* ── JSON parsing + confidence scan ───────────────────────────── */

function safeParseJson(text: string): unknown {
  // Strip code-fences if the model returned any despite the instruction.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try to recover the first {...} block.
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    return { _parse_error: true, _raw_model_output: stripped };
  }
}

/**
 * Walk the object collecting every numeric `_confidence` and noting the
 * path to any field below the threshold.
 */
function scanConfidence(data: unknown): {
  avg: number;
  lows: string[];
} {
  const values: number[] = [];
  const lows: string[] = [];

  function walk(node: unknown, path: string) {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof node === "object") {
      const rec = node as Record<string, unknown>;
      // Treat this object as a leaf field if it has a _confidence number.
      if (typeof rec._confidence === "number") {
        values.push(rec._confidence);
        if (rec._confidence < LOW_CONFIDENCE_THRESHOLD) lows.push(path || "(root)");
        return;
      }
      for (const [k, v] of Object.entries(rec)) {
        if (k.startsWith("_")) continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  }

  walk(data, "");
  const avg =
    values.length === 0
      ? 0
      : values.reduce((s, x) => s + x, 0) / values.length;
  return { avg, lows };
}
