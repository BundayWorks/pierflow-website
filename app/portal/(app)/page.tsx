import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { ArrowRight, Camera, FileCheck2, Users } from "lucide-react";
import { getOrCreateSessionContext } from "@/lib/auth";

export default async function PortalDashboard() {
  const user = await currentUser();
  const ctx = await getOrCreateSessionContext();
  const greet = user?.firstName ?? user?.username ?? "there";
  const orgName = ctx?.organization.name ?? null;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        {orgName ?? "Portal"}
      </p>
      <h1 className="mt-2 font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Welcome back, {greet}.
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[560px]">
        Capture, review, and ship paper records as FHIR R4 bundles. Pick a
        starting point below or use the side nav to jump in.
      </p>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionCard
          href="/portal/capture"
          icon={<Camera size={18} />}
          title="Capture records"
          body="Photograph patient cards, prescriptions, lab slips, and antenatal pages from any phone."
        />
        <ActionCard
          href="/portal/review"
          icon={<FileCheck2 size={18} />}
          title="Review queue"
          body="Confirm or correct low-confidence extractions before they ship to your partner system."
        />
        <ActionCard
          href="/portal/patients"
          icon={<Users size={18} />}
          title="Patients"
          body="Search and inspect every patient whose records have been processed."
        />
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-black/[0.08] p-5 hover:border-black/25 transition-colors bg-white"
    >
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center">
          {icon}
        </span>
        <ArrowRight
          size={16}
          className="text-accent-ink/30 group-hover:text-accent-ink transition-colors"
        />
      </div>
      <h3 className="mt-4 text-[15px] font-medium text-accent-ink">{title}</h3>
      <p className="mt-2 text-[13px] leading-[1.6] text-accent-ink/65">
        {body}
      </p>
    </Link>
  );
}
