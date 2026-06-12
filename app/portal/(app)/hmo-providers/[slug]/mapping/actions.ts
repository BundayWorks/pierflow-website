"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { findProviderBySlug } from "@/lib/insurance/providers";
import { proposeMapping } from "@/lib/insurance/normalise";
import {
  createDraftFromProposal,
  activateMapping,
  listMappingsForProvider,
} from "@/lib/insurance/mappings";
import { db } from "@/lib/db";

const SampleInput = z.object({
  slug: z.string().trim().min(1),
  sampleJson: z
    .string()
    .trim()
    .min(2)
    .max(200_000, "Sample is too large — paste one plan at a time."),
});

export type ProposeOutcome =
  | {
      ok: true;
      mappingId: string;
      version: number;
      averageConfidence: number | null;
      lowConfidenceFields: number;
    }
  | {
      ok: false;
      reason:
        | "VALIDATION_FAILED"
        | "PROVIDER_NOT_FOUND"
        | "INVALID_JSON"
        | "MODEL_ERROR";
      detail?: string;
      issues?: string[];
    };

export async function proposeMappingAction(raw: unknown): Promise<ProposeOutcome> {
  const session = await requireStaff();
  const parsed = SampleInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "VALIDATION_FAILED",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }

  const provider = await findProviderBySlug(parsed.data.slug);
  if (!provider) return { ok: false, reason: "PROVIDER_NOT_FOUND" };

  let sample: unknown;
  try {
    sample = JSON.parse(parsed.data.sampleJson);
  } catch (e) {
    return {
      ok: false,
      reason: "INVALID_JSON",
      detail: (e as Error).message,
    };
  }

  try {
    const proposal = await proposeMapping({
      sample,
      providerName: provider.displayName,
    });
    const created = await createDraftFromProposal({
      providerId: provider.id,
      sample,
      proposal,
      createdByExternalId: session.externalId,
    });
    revalidatePath(`/portal/hmo-providers/${provider.slug}/mapping`);
    return {
      ok: true,
      mappingId: created.id,
      version: created.version,
      averageConfidence: created.averageConfidence,
      lowConfidenceFields: created.lowConfidenceFields,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "MODEL_ERROR",
      detail: (e as Error).message,
    };
  }
}

export async function activateMappingAction(
  mappingId: string,
  slug: string,
) {
  const session = await requireStaff();
  await activateMapping(mappingId, session.externalId);
  revalidatePath(`/portal/hmo-providers/${slug}/mapping`);
  revalidatePath(`/portal/hmo-providers/${slug}`);
}

export async function listMappingsAction(providerId: string) {
  await requireStaff();
  return listMappingsForProvider(providerId);
}

export async function getMappingDetail(mappingId: string) {
  await requireStaff();
  return db.connectorMapping.findUnique({
    where: { id: mappingId },
    select: {
      id: true,
      version: true,
      status: true,
      sample: true,
      proposal: true,
      template: true,
      averageConfidence: true,
      lowConfidenceFields: true,
      createdAt: true,
      activatedAt: true,
      reviewedAt: true,
    },
  });
}
