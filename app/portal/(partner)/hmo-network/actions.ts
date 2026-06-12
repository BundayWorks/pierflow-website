"use server";

import { revalidatePath } from "next/cache";
import { requirePartnerUser } from "@/lib/auth";
import { listHmosForFintech, optInToHmo, optOutOfHmo } from "@/lib/insurance/hmo-access";

export async function getHmoNetwork() {
  const session = await requirePartnerUser();
  return listHmosForFintech(session.partner.id);
}

export async function optInAction(providerSlug: string) {
  const session = await requirePartnerUser();
  const result = await optInToHmo(session.partner.id, providerSlug);
  revalidatePath("/portal/hmo-network");
  return result;
}

export async function optOutAction(providerSlug: string) {
  const session = await requirePartnerUser();
  const result = await optOutOfHmo(session.partner.id, providerSlug);
  revalidatePath("/portal/hmo-network");
  return result;
}
