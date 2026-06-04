import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/partnerAuth";

/**
 * POST /v1/import-packages/:packageId/acknowledge
 *
 * The partner calls this once they've successfully imported the
 * package. We record the count + failures and flip the package +
 * contained records to IMPORTED status. Failed records remain
 * unpackaged (importPackageId nulled out) so the next cron rebuild
 * picks them up again.
 */

const Body = z.object({
  imported_patient_count: z.number().int().nonnegative(),
  failed_patient_ids: z.array(z.string()).default([]),
  failure_reasons: z.record(z.string(), z.string()).optional(),
  imported_at: z.string().datetime().optional(),
  partner_import_reference: z.string().max(120).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { packageId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 422 },
    );
  }

  const pkg = await db.importPackage.findUnique({
    where: { id: params.packageId },
    select: {
      id: true,
      partnerId: true,
      organizationId: true,
      status: true,
    },
  });
  if (!pkg) return notFound("PACKAGE_NOT_FOUND");
  if (pkg.partnerId !== session.partnerId) return forbidden();
  if (!session.organizationIds.has(pkg.organizationId)) return forbidden();

  await db.$transaction(async (tx) => {
    await tx.importPackage.update({
      where: { id: pkg.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        ackImportedCount: body.imported_patient_count,
        ackFailedCount: body.failed_patient_ids.length,
        ackPayload: {
          failed_patient_ids: body.failed_patient_ids,
          failure_reasons: body.failure_reasons ?? {},
          imported_at: body.imported_at,
          partner_import_reference: body.partner_import_reference,
        },
      },
    });

    // Successfully imported records: mark IMPORTED so they don't ship
    // again. Failed patient bundles get their records detached so the
    // next cron picks them up.
    if (body.failed_patient_ids.length > 0) {
      await tx.extractedRecord.updateMany({
        where: {
          importPackageId: pkg.id,
          patientId: { in: body.failed_patient_ids },
        },
        data: { importPackageId: null },
      });
    }

    await tx.extractedRecord.updateMany({
      where: { importPackageId: pkg.id },
      data: { importedAt: new Date() },
    });

    await tx.processingJob.updateMany({
      where: {
        extractedRecords: {
          some: {
            importPackageId: pkg.id,
            importedAt: { not: null },
          },
        },
      },
      data: { status: "IMPORTED" },
    });
  });

  return NextResponse.json({ status: "acknowledged", package_id: pkg.id });
}
