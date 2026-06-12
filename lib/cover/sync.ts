/**
 * Cover sync orchestrators.
 *
 * High-level functions that load Prisma relations and call bridge sync
 * functions in the right order. Used as fire-and-forget hooks from the
 * enrollment and claim lifecycle.
 *
 * Guard: all functions return silently when MEDPLUM_CLIENT_ID is absent
 * (Cover not configured). Failures are caught and logged — Cover sync
 * must never block the primary business flow.
 */

import { db } from "@/lib/db";
import {
  syncOrganizationToMedplum,
  syncPatientToMedplum,
  syncCoverageToMedplum,
  syncClaimToMedplum,
  syncClaimResponseToMedplum,
  syncEobToMedplum,
} from "@/lib/cover/bridge.ts";
import type { EnrollmentForFhir, ClaimForFhir } from "@/lib/cover/fhir.ts";

// ─────────────────────────────────────────────────────────────────────
// Enrollment sync
// ─────────────────────────────────────────────────────────────────────

/**
 * Full enrollment sync: Patient → Organization → Coverage.
 * Updates medplumPatientId and medplumCoverageId on the enrollment row.
 */
export async function syncEnrollmentToMedplum(
  enrollmentId: string,
): Promise<void> {
  // Guard: Cover not configured.
  if (!process.env.MEDPLUM_CLIENT_ID) return;

  try {
    const enrollment = await db.hmoEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        identityVerification: true,
        plan: true,
        provider: {
          include: { organization: true },
        },
      },
    });
    if (!enrollment || !enrollment.provider) return;

    const org = enrollment.provider.organization;
    const enrollmentForFhir: EnrollmentForFhir = {
      id: enrollment.id,
      fullName: enrollment.fullName,
      email: enrollment.email,
      phone: enrollment.phone,
      effectiveFrom: enrollment.effectiveFrom,
      effectiveTo: enrollment.effectiveTo,
      status: enrollment.status,
      fintechUserRef: enrollment.fintechUserRef,
      hmoPolicyId: enrollment.hmoPolicyId,
      hmoMemberId: enrollment.hmoMemberId,
      wholesaleNgn: enrollment.wholesaleNgn,
      markupNgn: enrollment.markupNgn,
      memberPaysNgn: enrollment.memberPaysNgn,
      contractVersion: enrollment.contractVersion,
      identityVerification: enrollment.identityVerification
        ? {
            fullName: enrollment.identityVerification.fullName,
            dateOfBirth: enrollment.identityVerification.dateOfBirth,
            sex: enrollment.identityVerification.sex,
            ninLast4: enrollment.identityVerification.ninLast4,
            bvnLast4: enrollment.identityVerification.bvnLast4,
            ninHash: enrollment.identityVerification.ninHash,
            bvnHash: enrollment.identityVerification.bvnHash,
          }
        : null,
      plan: enrollment.plan
        ? {
            id: enrollment.plan.id,
            name: enrollment.plan.name,
            externalId: enrollment.plan.externalId,
            scope: enrollment.plan.scope,
            coverage: enrollment.plan.coverage,
          }
        : null,
      provider: {
        id: enrollment.provider.id,
        slug: enrollment.provider.slug,
        displayName: enrollment.provider.displayName,
        organization: {
          id: org.id,
          name: org.name,
          type: org.type,
          slug: org.slug,
          state: org.state,
          country: org.country,
        },
      },
    };

    // 1. Sync Organization
    const orgMedplumId = await syncOrganizationToMedplum({
      id: org.id,
      name: org.name,
      type: org.type,
      slug: org.slug,
      state: org.state,
      country: org.country,
      contactEmail: enrollment.provider.contactEmail,
      contactPhone: enrollment.provider.contactPhone,
    });
    if (!orgMedplumId) return;

    // 2. Sync Patient
    const patientMedplumId = await syncPatientToMedplum(enrollmentForFhir);
    if (!patientMedplumId) return;

    // 3. Sync Coverage
    const coverageMedplumId = await syncCoverageToMedplum(
      enrollmentForFhir,
      patientMedplumId,
      orgMedplumId,
    );

    // 4. Update Pierflow refs
    await db.hmoEnrollment.update({
      where: { id: enrollmentId },
      data: {
        medplumPatientId: patientMedplumId,
        medplumCoverageId: coverageMedplumId,
      },
    });
  } catch (err) {
    console.error("[Cover] enrollment sync failed:", enrollmentId, err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Claim sync
// ─────────────────────────────────────────────────────────────────────

/**
 * Syncs a claim + response/EOB to Medplum. Requires the enrollment
 * to already have medplumPatientId set (from prior enrollment sync).
 */
export async function syncClaimToMedplumFull(
  claimId: string,
): Promise<void> {
  if (!process.env.MEDPLUM_CLIENT_ID) return;

  try {
    const claim = await db.hmoClaim.findUnique({
      where: { id: claimId },
      include: {
        enrollment: {
          include: {
            provider: { include: { organization: true } },
            plan: true,
            identityVerification: true,
          },
        },
      },
    });
    if (!claim || !claim.enrollment) return;

    const enrollment = claim.enrollment;
    const provider = enrollment.provider;
    if (!provider) return;

    // Ensure we have Medplum refs from the enrollment sync.
    const patientMedplumId = enrollment.medplumPatientId;
    if (!patientMedplumId) {
      // Try syncing the enrollment first.
      await syncEnrollmentToMedplum(enrollment.id);
      // Re-read.
      const refreshed = await db.hmoEnrollment.findUnique({
        where: { id: enrollment.id },
        select: { medplumPatientId: true },
      });
      if (!refreshed?.medplumPatientId) return;
    }

    const org = provider.organization;
    const orgMedplumId = await syncOrganizationToMedplum({
      id: org.id,
      name: org.name,
      type: org.type,
      slug: org.slug,
      state: org.state,
      country: org.country,
      contactEmail: provider.contactEmail,
      contactPhone: provider.contactPhone,
    });
    if (!orgMedplumId) return;

    const finalPatientId =
      enrollment.medplumPatientId ??
      (
        await db.hmoEnrollment.findUnique({
          where: { id: enrollment.id },
          select: { medplumPatientId: true },
        })
      )?.medplumPatientId;
    if (!finalPatientId) return;

    const claimForFhir: ClaimForFhir = {
      id: claim.id,
      enrollmentId: claim.enrollmentId,
      fintechUserRef: claim.fintechUserRef,
      hmoClaimId: claim.hmoClaimId,
      serviceDate: claim.serviceDate,
      serviceType: claim.serviceType,
      facilityName: claim.facilityName,
      amountNgn: claim.amountNgn,
      diagnosisCodes: claim.diagnosisCodes,
      procedureCodes: claim.procedureCodes,
      notes: claim.notes,
      status: claim.status,
      approvedAmountNgn: claim.approvedAmountNgn,
      paidAmountNgn: claim.paidAmountNgn,
      rejectionReason: claim.rejectionReason,
      createdAt: claim.createdAt,
    };

    // Sync Claim.
    const claimMedplumId = await syncClaimToMedplum(
      claimForFhir,
      finalPatientId,
      orgMedplumId,
    );
    if (!claimMedplumId) return;

    // Update Pierflow ref.
    await db.hmoClaim.update({
      where: { id: claimId },
      data: { medplumClaimId: claimMedplumId },
    });

    // If the claim is in a terminal state, also sync ClaimResponse + EOB.
    const terminal = ["APPROVED", "REJECTED", "PAID"];
    if (terminal.includes(claim.status)) {
      await syncClaimResponseToMedplum(
        claimForFhir,
        claimMedplumId,
        finalPatientId,
        orgMedplumId,
      );

      const enrollmentForFhir: EnrollmentForFhir = {
        id: enrollment.id,
        fullName: enrollment.fullName,
        email: enrollment.email,
        phone: enrollment.phone,
        effectiveFrom: enrollment.effectiveFrom,
        effectiveTo: enrollment.effectiveTo,
        status: enrollment.status,
        fintechUserRef: enrollment.fintechUserRef,
        hmoPolicyId: enrollment.hmoPolicyId,
        hmoMemberId: enrollment.hmoMemberId,
        wholesaleNgn: enrollment.wholesaleNgn,
        markupNgn: enrollment.markupNgn,
        memberPaysNgn: enrollment.memberPaysNgn,
        contractVersion: enrollment.contractVersion,
        plan: enrollment.plan
          ? {
              id: enrollment.plan.id,
              name: enrollment.plan.name,
              externalId: enrollment.plan.externalId,
              scope: enrollment.plan.scope,
              coverage: enrollment.plan.coverage,
            }
          : null,
      };

      await syncEobToMedplum(
        claimForFhir,
        enrollmentForFhir,
        claimMedplumId,
        finalPatientId,
        orgMedplumId,
      );
    }
  } catch (err) {
    console.error("[Cover] claim sync failed:", claimId, err);
  }
}
