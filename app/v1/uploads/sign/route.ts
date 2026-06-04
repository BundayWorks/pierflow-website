import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { resolveSession } from "@/lib/auth";
import { buildSignedUpload } from "@/lib/cloudinary";
import { db } from "@/lib/db";

/**
 * POST /v1/uploads/sign
 *
 * Returns a Cloudinary upload signature for a single asset. The caller
 * (the mobile capture page) then uploads the file directly to Cloudinary
 * with that signature — the server never proxies the file body.
 *
 * Request body:
 *   { batchId?: string }
 *
 * If batchId is omitted the caller wants signatures for ad-hoc captures
 * that will be assigned to a batch later; we still scope the folder by
 * organization so nothing escapes the tenant boundary.
 */
const Body = z.object({
  batchId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

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

  const session = await resolveSession();
  if (session.kind === "anonymous") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (session.kind !== "staff") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const ctx = session;

  // If a batch was supplied, validate it belongs to this org so the
  // folder structure can't be coerced into another tenant's prefix.
  if (body.batchId) {
    const batch = await db.scanBatch.findUnique({
      where: { id: body.batchId },
      select: { organizationId: true },
    });
    if (!batch || batch.organizationId !== ctx.organization.id) {
      return NextResponse.json(
        { error: "BATCH_NOT_FOUND" },
        { status: 404 },
      );
    }
  }

  const folder = body.batchId
    ? `pierflow/${ctx.organization.id}/${body.batchId}`
    : `pierflow/${ctx.organization.id}/unassigned`;

  const signed = buildSignedUpload({ folder });
  return NextResponse.json(signed, { status: 200 });
}
