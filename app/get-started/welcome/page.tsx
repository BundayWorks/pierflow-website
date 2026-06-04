import Link from "next/link";
import { Mail } from "lucide-react";

export const metadata = {
  title: "Check your inbox · Pierflow",
};

export default function WelcomePage({
  searchParams,
}: {
  searchParams?: { email?: string };
}) {
  const email = searchParams?.email ?? null;
  return (
    <div>
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent-emerald font-medium">
        <Mail size={14} />
        Check your inbox
      </span>
      <h1 className="mt-3 font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        We&apos;ve sent you an invitation.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-accent-ink/65">
        {email ? (
          <>
            An invitation email is on its way to{" "}
            <code className="text-[14px]">{email}</code>. Click the link in
            that email to set your password and finish creating your account.
          </>
        ) : (
          <>
            An invitation email is on its way. Click the link inside to set
            your password and finish creating your account.
          </>
        )}
      </p>
      <p className="mt-3 text-[13px] leading-[1.7] text-accent-ink/55">
        Once you&apos;re signed in you&apos;ll land in the partner console and
        see your onboarding checklist. Sandbox API keys are issued the
        moment our team approves your account — usually within one business
        day.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/docs/quickstart/introduction"
          className="text-[13px] font-medium px-5 py-2.5 rounded-md border border-black/[0.12] text-accent-ink hover:border-black/30"
        >
          Read the docs while you wait
        </Link>
      </div>
      <p className="mt-10 text-[12px] text-accent-ink/55 leading-[1.65]">
        Don&apos;t see the email after a couple of minutes? Check your spam
        folder, or email{" "}
        <a
          href="mailto:pierflowllc@gmail.com"
          className="text-accent-emerald hover:underline"
        >
          pierflowllc@gmail.com
        </a>{" "}
        and we&apos;ll re-send.
      </p>
    </div>
  );
}
