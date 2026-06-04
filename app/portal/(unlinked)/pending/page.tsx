import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { resolveSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  // The layout guarantees this is an unlinked session. We still need
  // the email so we can show it and check for an existing Partner the
  // user might be entitled to but isn't linked to.
  const session = await resolveSession();
  const email = session.kind === "unlinked" ? session.email : null;

  // Hand-curated edge case: if there's a PartnerUser row with this
  // email but the externalId is null, resolveSession() would have
  // bound it already. So if we're still here with this email matching,
  // it usually means the user signed up with a slightly different
  // email than the one they used in /get-started.
  const partnerByEmail = email
    ? await db.partnerUser.findFirst({
        where: { email },
        select: {
          partner: { select: { name: true, accessStatus: true } },
        },
      })
    : null;

  return (
    <div>
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent-emerald font-medium">
        <Clock size={12} />
        Account not linked
      </span>
      <h1 className="mt-3 font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        We can&apos;t find a partner account linked to this email.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        The portal links accounts by the email you used at sign-up. If you
        already created a Pierflow partner account, sign in with the same
        email you used then. Otherwise, get started below.
      </p>

      {partnerByEmail ? (
        <div className="mt-8 rounded-2xl border border-card-mint bg-card-mint p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-accent-emerald font-medium">
            Existing partner account
          </p>
          <p className="mt-2 text-[14px] text-accent-ink leading-[1.6]">
            We have a partner account on file for{" "}
            <strong>{partnerByEmail.partner.name}</strong> tied to{" "}
            <code className="text-[12px]">{email}</code>. Sign out and back in
            with that email to access it.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/get-started"
            className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-ink text-white hover:opacity-90 inline-flex items-center gap-2"
          >
            Get started
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
        Still stuck? Contact us at{" "}
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
