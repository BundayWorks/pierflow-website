import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  notFound,
  requireScope,
} from "@/lib/partnerAuth";
import { getEnrollment } from "@/lib/insurance/enrollments";

/**
 * GET /v1/enrollments/:enrollmentId — retrieve a single enrollment.
 *
 * Scope: insurance:read. Auto-scoped to the calling partner.
 */
export async function GET(
  req: Request,
  { params }: { params: { enrollmentId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const enrollment = await getEnrollment(
    params.enrollmentId,
    session.partnerId,
  );
  if (!enrollment) return notFound("ENROLLMENT_NOT_FOUND");
  return NextResponse.json(enrollment);
}
