import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Account created · Pierflow",
};

export default function WelcomePage() {
  return (
    <div>
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent-emerald font-medium">
        <CheckCircle2 size={14} />
        Account created
      </span>
      <h1 className="mt-3 font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        You&apos;re in. Welcome to Pierflow.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-accent-ink/65">
        We&apos;ve sent you a welcome email. Log in to the partner console to
        see your onboarding checklist. Sandbox API keys are issued once our
        team approves your account — usually within one business day.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/portal"
          className="text-[13px] font-medium px-5 py-2.5 rounded-md bg-accent-ink text-white hover:opacity-90"
        >
          Open the partner console
        </Link>
        <Link
          href="/docs/quickstart/introduction"
          className="text-[13px] font-medium px-5 py-2.5 rounded-md border border-black/[0.12] text-accent-ink hover:border-black/30"
        >
          Read the docs
        </Link>
      </div>
    </div>
  );
}
