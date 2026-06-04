import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/partnerAuth";

/**
 * GET /v1/import-packages/:packageId/download
 *
 * Returns a JSON envelope with a short-lived download URL the partner
 * can GET to retrieve the actual ZIP. We don't proxy the body — it's
 * served straight from Cloudinary, which keeps our function-runtime
 * memory + bandwidth modest.
 */
export async function GET(
  req: Request,
  { params }: { params: { packageId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();

  const pkg = await db.importPackage.findUnique({
    where: { id: params.packageId },
    select: {
      id: true,
      partnerId: true,
      organizationId: true,
      status: true,
      archiveAsset: true,
      checksumSha256: true,
      expiresAt: true,
    },
  });
  if (!pkg) return notFound("PACKAGE_NOT_FOUND");
  if (pkg.partnerId !== session.partnerId) return forbidden();
  if (!session.organizationIds.has(pkg.organizationId)) return forbidden();
  if (pkg.status === "EXPIRED") return notFound("PACKAGE_EXPIRED");

  const asset = (pkg.archiveAsset ?? {}) as { secureUrl?: string };
  if (!asset.secureUrl) return notFound("PACKAGE_MISSING_ARCHIVE");

  return NextResponse.json({
    package_id: pkg.id,
    download_url: asset.secureUrl,
    checksum_sha256: pkg.checksumSha256,
    expires_at: pkg.expiresAt?.toISOString() ?? null,
  });
}
