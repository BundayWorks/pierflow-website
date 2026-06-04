import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { resolveSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  // Layout guarantees this is an unlinked session, but we re-read it
  // here so we can show the user's email and surface any in-flight
  // access request they already submitted.
  const session = await resolveSession();
  const email = session.kind === "unlinked" ? session.email : null;

  const pendingRequest = email
    ? await db.accessRequest.findFirst({
        where: { email, status: "PENDING" },
        select: { id: true, company: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <div>
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent-emerald font-medium">
        <Clock size={12} />
        Account pending
      </span>
      <h1 className="mt-3 font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Your account isn&apos;t linked to a Pierflow workspace yet.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Access to the Pierflow portal is granted on a per-partner basis. If you
        represent an EMR, HMS, insurer, or analytics platform that wants to
        consume health records via our API, request access below and our team
        will review and provision your credentials.
      </p>

      {pendingRequest ? (
        <div className="mt-8 rounded-2xl border border-[#fff4d4] bg-[#fffaee] p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a4a00] font-medium">
            Request received
          </p>
          <p className="mt-2 text-[14px] text-accent-ink leading-[1.6]">
            We have a pending access request on file from{" "}
            <strong>{pendingRequest.company}</strong>, submitted{" "}
            {new Date(pendingRequest.createdAt).toLocaleDateString()}. You&apos;ll
            get an email at <code className="text-[12px]">{email}</code> as soon
            as it&apos;s reviewed.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/developers/request-access"
            className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-ink text-white hover:opacity-90 inline-flex items-center gap-2"
          >
            Request access
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/docs/quickstart/introduction"
            className="text-[13px] font-medium px-4 py-2.5 rounded-md border border-black/[0.12] text-accent-ink hover:border-black/30"
          >
            Read the docs
          </Link>
        </div>
      )}

      <p className="mt-10 text-[12px] text-accent-ink/55 leading-[1.65]">
        Already approved but still seeing this page? The portal links accounts
        by the email you signed up with. Make sure you&apos;re signed in with{" "}
        {email ? (
          <code className="text-[12px]">{email}</code>
        ) : (
          "the same email you used on the access request"
        )}
        , or contact us at{" "}
        <a
          href="mailto:pierflowllc@gmail.com"
          className="text-accent-emerald hover:underline"
        >
          pierflowllc@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
