import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
} from "@/lib/partnerAuth";

/**
 * GET /v1/organizations/:orgId/import-packages
 *
 * Lists the import packages built for this (partner, organization) pair.
 *
 * Query params:
 *   status — READY | ACKNOWLEDGED | EXPIRED | ALL (default: READY)
 */
export async function GET(
  req: Request,
  { params }: { params: { orgId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  if (!session.organizationIds.has(params.orgId)) return forbidden();

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "READY";
  const statusFilter =
    statusParam === "ALL"
      ? undefined
      : { in: [statusParam] };

  const packages = await db.importPackage.findMany({
    where: {
      organizationId: params.orgId,
      partnerId: session.partnerId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      patientCount: true,
      recordCount: true,
      fileSizeBytes: true,
      checksumSha256: true,
    },
  });

  return NextResponse.json({
    packages: packages.map((p) => ({
      package_id: p.id,
      status: p.status,
      created_at: p.createdAt.toISOString(),
      expires_at: p.expiresAt?.toISOString() ?? null,
      patient_count: p.patientCount,
      record_count: p.recordCount,
      file_size_bytes:
        p.fileSizeBytes != null ? Number(p.fileSizeBytes) : null,
      checksum_sha256: p.checksumSha256,
      download_url: `/v1/import-packages/${p.id}/download`,
    })),
  });
}
