"use server";

import { resolveSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  updateProviderSettlement,
  type UpdateSettlementInput,
} from "@/lib/insurance/providers";

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

// ── Read ───────────────────────────────────────────────────────────

export type SettlementConfig = {
  defaultSettlementMode: string;
  settlementBankName: string | null;
  settlementBankAccount: string | null;
  settlementBankCode: string | null;
  channelOverrides: ChannelOverride[];
};

type ChannelOverride = {
  id: string;
  partnerName: string;
  settlementMode: string | null;
  settlementBankName: string | null;
  settlementBankAccount: string | null;
};

export async function getSettlementConfig(): Promise<SettlementConfig | null> {
  const providerId = await resolveProviderId();
  if (!providerId) return null;

  const provider = await db.hmoProvider.findUnique({
    where: { id: providerId },
    select: {
      defaultSettlementMode: true,
      settlementBankName: true,
      settlementBankAccount: true,
      settlementBankCode: true,
      channelSettlements: {
        include: { partner: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!provider) return null;

  return {
    defaultSettlementMode: provider.defaultSettlementMode,
    settlementBankName: provider.settlementBankName,
    settlementBankAccount: provider.settlementBankAccount,
    settlementBankCode: provider.settlementBankCode,
    channelOverrides: provider.channelSettlements.map((cs) => ({
      id: cs.id,
      partnerName: cs.partner.name,
      settlementMode: cs.settlementMode,
      settlementBankName: cs.settlementBankName,
      settlementBankAccount: cs.settlementBankAccount,
    })),
  };
}

// ── Update ─────────────────────────────────────────────────────────

type MutationResult = { ok: true } | { ok: false; reason: string };

export async function updateSettlementAction(input: {
  defaultSettlementMode: string;
  settlementBankName?: string;
  settlementBankAccount?: string;
  settlementBankCode?: string;
}): Promise<MutationResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  const mode = input.defaultSettlementMode;
  if (mode !== "IN_FINTECH_ACCOUNT" && mode !== "EXTERNAL_BANK_SWEEP") {
    return { ok: false, reason: "Invalid settlement mode" };
  }

  if (mode === "EXTERNAL_BANK_SWEEP") {
    if (!input.settlementBankName?.trim()) {
      return { ok: false, reason: "Bank name is required for external sweep" };
    }
    if (!input.settlementBankAccount?.trim()) {
      return { ok: false, reason: "Account number is required for external sweep" };
    }
    if (!input.settlementBankCode?.trim()) {
      return { ok: false, reason: "Bank code is required for external sweep" };
    }
  }

  const updateInput: UpdateSettlementInput = {
    defaultSettlementMode: mode,
    settlementBankName: input.settlementBankName?.trim() || null,
    settlementBankAccount: input.settlementBankAccount?.trim() || null,
    settlementBankCode: input.settlementBankCode?.trim() || null,
  };

  await updateProviderSettlement(providerId, updateInput);
  return { ok: true };
}
