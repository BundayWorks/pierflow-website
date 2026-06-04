import { requirePartnerUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PartnerUsagePage() {
  const { partner } = await requirePartnerUser();

  const [orgLinkCount, packageCounts] = await Promise.all([
    db.partnerOrganizationLink.count({ where: { partnerId: partner.id } }),
    db.importPackage.groupBy({
      by: ["status"],
      where: { partnerId: partner.id },
      _count: { _all: true },
    }),
  ]);

  const counts = Object.fromEntries(
    packageCounts.map((row) => [row.status, row._count._all]),
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Activity
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Usage
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        A snapshot of your activity on the Records API.
      </p>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Connected organizations"
          value={orgLinkCount}
          hint="Orgs whose records you can fetch"
        />
        <Stat
          label="Packages ready"
          value={counts.READY ?? 0}
          hint="Available to download"
        />
        <Stat
          label="Packages acknowledged"
          value={counts.ACKNOWLEDGED ?? 0}
          hint="Confirmed imported on your side"
        />
        <Stat
          label="Packages building"
          value={counts.BUILDING ?? 0}
          hint="Being assembled by the next cron"
        />
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
        <BarChart3 size={22} className="mx-auto text-accent-ink/35" />
        <p className="mt-3 text-[13px] text-accent-ink/55">
          Detailed call-level analytics are coming soon. Reach out at{" "}
          <a
            href="mailto:pierflowllc@gmail.com"
            className="text-accent-emerald hover:underline"
          >
            pierflowllc@gmail.com
          </a>{" "}
          if you need a usage report in the meantime.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.08] p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium">
        {label}
      </p>
      <p className="mt-2 font-display text-[28px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] text-accent-ink/55 leading-[1.5]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
