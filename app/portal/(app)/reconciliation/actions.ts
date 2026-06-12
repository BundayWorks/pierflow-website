"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import {
  listDiscrepancies,
  reconcileEnrollment,
  setDiscrepancyStatus,
} from "@/lib/insurance/reconciliation";

type Filter = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "WRITTEN_OFF" | "ALL";

export async function listDiscrepanciesAction(filter?: Filter) {
  await requireStaff();
  return listDiscrepancies({ status: filter ?? "OPEN" });
}

const StatusUpdate = z.object({
  discrepancyId: z.string().min(1),
  status: z.enum(["ACKNOWLEDGED", "RESOLVED", "WRITTEN_OFF"]),
  notes: z.string().trim().max(2000).nullish(),
});

export async function updateDiscrepancyStatusAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; issues: string[] }> {
  const session = await requireStaff();
  const parsed = StatusUpdate.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  await setDiscrepancyStatus(
    parsed.data.discrepancyId,
    parsed.data.status,
    parsed.data.notes ?? null,
    session.externalId,
  );
  revalidatePath("/portal/reconciliation");
  return { ok: true };
}

export async function reReconcileEnrollmentAction(enrollmentId: string) {
  await requireStaff();
  const r = await reconcileEnrollment(enrollmentId);
  revalidatePath("/portal/reconciliation");
  return r;
}
