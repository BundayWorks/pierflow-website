"use server";

import { resolveSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  listContractsForProvider,
  getContractDetail as getContractDetailLib,
  computePremiumPreview,
  computeEnrollmentPreview,
} from "@/lib/insurance/contracts";

async function resolveProviderId(): Promise<string | null> {
  const session = await resolveSession();
  if (session.kind !== "partner") return null;
  const link = await db.partnerOrganizationLink.findFirst({
    where: { partnerId: session.partner.id },
    include: {
      organization: {
        include: { hmoProvider: { select: { id: true } } },
      },
    },
  });
  return link?.organization?.hmoProvider?.id ?? null;
}

// ── List ───────────────────────────────────────────────────────────

export type ContractRow = {
  id: string;
  version: number;
  status: string;
  markupMode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  enrollmentFeeNgn: string | null;
  partyCount: number;
  createdAt: string;
};

export async function getContracts(): Promise<ContractRow[]> {
  const providerId = await resolveProviderId();
  if (!providerId) return [];

  const rows = await listContractsForProvider(providerId);

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    status: r.status,
    markupMode: r.markupMode,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
    enrollmentFeeNgn: r.enrollmentFeeNgn?.toString() ?? null,
    partyCount: r._count.parties,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── Detail ─────────────────────────────────────────────────────────

export type ContractPartyRow = {
  id: string;
  role: string;
  displayName: string | null;
  kind: string;
  timing: string;
  amountFlatNgn: string | null;
  amountBps: number | null;
  minPerCycleNgn: string | null;
  maxPerCycleNgn: string | null;
  settlementAccountTag: string | null;
  notes: string | null;
};

export type ContractDetailResult = {
  id: string;
  version: number;
  status: string;
  markupMode: string;
  markupFixedNgn: string | null;
  enrollmentFeeNgn: string | null;
  enrollmentBeneficiaryRole: string | null;
  remainderBearer: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
  parties: ContractPartyRow[];
};

export async function getContractDetailAction(
  contractId: string,
): Promise<ContractDetailResult | null> {
  const providerId = await resolveProviderId();
  if (!providerId) return null;

  const contract = await getContractDetailLib(contractId);
  if (!contract || contract.providerId !== providerId) return null;

  return {
    id: contract.id,
    version: contract.version,
    status: contract.status,
    markupMode: contract.markupMode,
    markupFixedNgn: contract.markupFixedNgn?.toString() ?? null,
    enrollmentFeeNgn: contract.enrollmentFeeNgn?.toString() ?? null,
    enrollmentBeneficiaryRole: contract.enrollmentBeneficiaryRole,
    remainderBearer: contract.remainderBearer,
    effectiveFrom: contract.effectiveFrom.toISOString(),
    effectiveTo: contract.effectiveTo?.toISOString() ?? null,
    notes: contract.notes,
    createdAt: contract.createdAt.toISOString(),
    parties: contract.parties.map((p) => ({
      id: p.id,
      role: p.role,
      displayName: p.displayName,
      kind: p.kind,
      timing: p.timing,
      amountFlatNgn: p.amountFlatNgn?.toString() ?? null,
      amountBps: p.amountBps,
      minPerCycleNgn: p.minPerCycleNgn?.toString() ?? null,
      maxPerCycleNgn: p.maxPerCycleNgn?.toString() ?? null,
      settlementAccountTag: p.settlementAccountTag,
      notes: p.notes,
    })),
  };
}

// ── Preview ────────────────────────────────────────────────────────

export type SplitLinePreview = {
  role: string;
  amountKobo: string;
};

export type ContractPreviewResult =
  | {
      ok: true;
      premium: {
        wholesaleKobo: string;
        markupKobo: string;
        memberPaysKobo: string;
        lines: SplitLinePreview[];
      };
      enrollment: {
        feeKobo: string;
        lines: SplitLinePreview[];
      } | null;
    }
  | { ok: false; issues: string[] };

export async function getContractPreview(
  contractId: string,
  sampleWholesaleNaira: number,
): Promise<ContractPreviewResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, issues: ["Unauthorized"] };

  const contract = await getContractDetailLib(contractId);
  if (!contract || contract.providerId !== providerId) {
    return { ok: false, issues: ["Contract not found"] };
  }

  const premiumResult = computePremiumPreview(contract, sampleWholesaleNaira);
  if (!premiumResult.ok) return { ok: false, issues: premiumResult.issues };

  const enrollmentResult = contract.enrollmentFeeNgn
    ? computeEnrollmentPreview(contract)
    : null;

  if (enrollmentResult && !enrollmentResult.ok) {
    return { ok: false, issues: enrollmentResult.issues };
  }

  return {
    ok: true,
    premium: {
      wholesaleKobo: premiumResult.wholesaleNgn.toString(),
      markupKobo: premiumResult.markupNgn.toString(),
      memberPaysKobo: premiumResult.memberPaysNgn.toString(),
      lines: premiumResult.lines.map((l) => ({
        role: l.role,
        amountKobo: l.amountNgn.toString(),
      })),
    },
    enrollment:
      enrollmentResult && enrollmentResult.ok
        ? {
            feeKobo: enrollmentResult.memberPaysNgn.toString(),
            lines: enrollmentResult.lines.map((l) => ({
              role: l.role,
              amountKobo: l.amountNgn.toString(),
            })),
          }
        : null,
  };
}
