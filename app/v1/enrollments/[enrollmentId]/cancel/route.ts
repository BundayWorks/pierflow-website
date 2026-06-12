import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { cancelEnrollment } from "@/lib/insurance/enrollments";

/**
 * POST /v1/enrollments/:enrollmentId/cancel
 *
 * Cancel an active or pending enrollment. Calls the HMO connector
 * to terminate (if a policy was issued) and emits CANCELLED events.
 *
 * Scope: insurance:write.
 */

const Body = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(
  req: Request,
  { params }: { params: { enrollmentId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:write");
  if (scopeFail) return scopeFail;

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

  const result = await cancelEnrollment(
    params.enrollmentId,
    session.partnerId,
    body.reason,
  );
  if (!result.ok) {
    const status =
      result.reason === "ENROLLMENT_NOT_FOUND"
        ? 404
        : result.reason === "INTERNAL"
          ? 500
          : 422;
    return NextResponse.json(
      { error: result.reason, detail: result.detail },
      { status },
    );
  }
  return NextResponse.json({ enrollment: result.enrollment });
}
