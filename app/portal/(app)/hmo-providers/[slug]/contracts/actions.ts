"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { findProviderBySlug } from "@/lib/insurance/providers";
import {
  createContractDraft,
  activateContract,
  listContractsForProvider,
  getContractDetail,
  computeContractPreview,
  computePremiumPreview,
  computeEnrollmentPreview,
  type CreateContractDraftInput,
} from "@/lib/insurance/contracts";
import type { SplitEvent } from "@/lib/insurance/split-engine.ts";

const PartyInput = z.object({
  role: z.enum([
    "HMO",
    "PIERFLOW",
    "EMR_VENDOR",
    "FINTECH",
    "BROKER",
    "REGULATOR_LEVY",
    "REFERRER",
    "OTHER",
  ]),
  displayName: z.string().trim().max(120).nullish(),
  partnerId: z.string().trim().nullish(),
  kind: z.enum(["FLAT", "PERCENTAGE"]),
  timing: z.enum(["ENROLLMENT_ONLY", "RECURRING_ONLY", "BOTH"]),
  amountFlatNaira: z.number().min(0).nullish(),
  amountPercent: z.number().min(0).max(100).nullish(),
  minPerCycleNaira: z.number().min(0).nullish(),
  maxPerCycleNaira: z.number().min(0).nullish(),
  settlementAccountTag: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

const ROLE_ENUM = z.enum([
  "HMO",
  "PIERFLOW",
  "EMR_VENDOR",
  "FINTECH",
  "BROKER",
  "REGULATOR_LEVY",
  "REFERRER",
  "OTHER",
]);

const CreateInput = z.object({
  slug: z.string().trim().min(1),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().nullish(),
  markupMode: z
    .enum(["GROSS_SHARE", "MARKUP_FIXED", "MARKUP_FROM_SHARES"])
    .default("GROSS_SHARE"),
  markupFixedNaira: z.number().min(0).nullish(),
  enrollmentFeeNaira: z.number().min(0).nullish(),
  enrollmentBeneficiaryRole: ROLE_ENUM.nullish(),
  remainderBearer: ROLE_ENUM,
  parties: z.array(PartyInput).min(1).max(12),
  notes: z.string().trim().max(2000).nullish(),
});

export type CreateContractActionOutcome =
  | { ok: true; contractId: string; version: number }
  | {
      ok: false;
      reason:
        | "VALIDATION_FAILED"
        | "PROVIDER_NOT_FOUND"
        | "INVALID_INPUT";
      issues?: string[];
    };

export async function createContractAction(
  raw: unknown,
): Promise<CreateContractActionOutcome> {
  const session = await requireStaff();
  const parsed = CreateInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "INVALID_INPUT",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const v = parsed.data;

  const provider = await findProviderBySlug(v.slug);
  if (!provider) return { ok: false, reason: "PROVIDER_NOT_FOUND" };

  const input: CreateContractDraftInput = {
    providerId: provider.id,
    effectiveFrom: new Date(v.effectiveFrom),
    effectiveTo: v.effectiveTo ? new Date(v.effectiveTo) : null,
    markupMode: v.markupMode,
    markupFixedNaira: v.markupFixedNaira ?? null,
    enrollmentFeeNaira: v.enrollmentFeeNaira ?? null,
    enrollmentBeneficiaryRole: v.enrollmentBeneficiaryRole ?? null,
    remainderBearer: v.remainderBearer,
    parties: v.parties,
    notes: v.notes ?? null,
    createdByExternalId: session.externalId,
  };

  const result = await createContractDraft(input);
  if (!result.ok) return result;
  revalidatePath(`/portal/hmo-providers/${v.slug}/contracts`);
  return {
    ok: true,
    contractId: result.contractId,
    version: result.version,
  };
}

export async function activateContractAction(
  contractId: string,
  slug: string,
) {
  await requireStaff();
  await activateContract(contractId);
  revalidatePath(`/portal/hmo-providers/${slug}/contracts`);
  revalidatePath(`/portal/hmo-providers/${slug}`);
}

export async function listContractsAction(providerId: string) {
  await requireStaff();
  return listContractsForProvider(providerId);
}

export async function getContractAction(contractId: string) {
  await requireStaff();
  return getContractDetail(contractId);
}

export async function previewContractAction(
  contractId: string,
  event: SplitEvent,
  totalNaira: number,
) {
  await requireStaff();
  const contract = await getContractDetail(contractId);
  return computeContractPreview(contract, event, totalNaira);
}

export async function previewPremiumAction(
  contractId: string,
  wholesaleNaira: number,
) {
  await requireStaff();
  const contract = await getContractDetail(contractId);
  return computePremiumPreview(contract, wholesaleNaira);
}

export async function previewEnrollmentAction(contractId: string) {
  await requireStaff();
  const contract = await getContractDetail(contractId);
  return computeEnrollmentPreview(contract);
}
