import Link from "next/link";
import {
  listReviewQueue,
  listReviewTargetOrgs,
  listMergeCandidates,
  countPendingMergeCandidates,
} from "./actions";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Building2,
  GitMerge,
} from "lucide-react";
import MergeQueue from "./MergeQueue";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  AUTO: "Auto-classified",
  OUTPATIENT_CARD: "Outpatient card",
  REGISTRATION: "Patient registration",
  LAB_RESULT: "Lab result",
  PRESCRIPTION: "Prescription",
  ANTENATAL: "Antenatal",
  IMMUNISATION: "Immunisation",
  DISCHARGE_SUMMARY: "Discharge summary",
  XRAY_REPORT: "X-ray report",
  ULTRASOUND_REPORT: "Ultrasound report",
  OPERATION_NOTE: "Operation note",
  REFERRAL_LETTER: "Referral letter",
  OTHER: "Other",
};

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams?: { orgId?: string; tab?: string };
}) {
  const orgs = await listReviewTargetOrgs();
  const tab = searchParams?.tab === "merge" ? "merge" : "extraction";

  if (orgs.length === 0) {
    return (
      <ReviewShell>
        <div className="mt-10 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            No active customer organizations yet.
          </p>
          <p className="mt-2 text-[12px] text-accent-ink/55 leading-[1.6] max-w-[420px] mx-auto">
            Review is scoped to the customer organization records belong to.
            Approve a pending organization request in the{" "}
            <Link
              href="/portal/customer-orgs"
              className="text-accent-emerald hover:underline"
            >
              customer orgs inbox
            </Link>
            , then come back here.
          </p>
        </div>
      </ReviewShell>
    );
  }

  // Resolve which org we're showing the queue for. Default to the one
  // with the largest awaiting-review count so the operator opens the
  // page on the busiest queue.
  const requested = searchParams?.orgId;
  const matched = requested ? orgs.find((o) => o.id === requested) : null;
  const activeOrg =
    matched ??
    orgs.slice().sort(
      (a, b) =>
        b._count.processingJobs - a._count.processingJobs,
    )[0];

  const [queue, mergePending] = await Promise.all([
    listReviewQueue(activeOrg.id),
    countPendingMergeCandidates(activeOrg.id),
  ]);

  if (tab === "merge") {
    const candidates = await listMergeCandidates(activeOrg.id);
    return (
      <ReviewShell>
        <OrgPicker orgs={orgs} activeOrgId={activeOrg.id} />
        <TabStrip
          activeOrgId={activeOrg.id}
          tab={tab}
          mergePending={mergePending}
        />
        <MergeQueue
          candidates={candidates.map((c) => ({
            id: c.id,
            score: c.score,
            reasons: c.reasons,
            detectedAt: c.detectedAt.toISOString(),
            primary: {
              id: c.primaryPatient.id,
              fullName: c.primaryPatient.fullName,
              dateOfBirth:
                c.primaryPatient.dateOfBirth?.toISOString() ?? null,
              sex: c.primaryPatient.sex,
              createdAt: c.primaryPatient.createdAt.toISOString(),
              identifiers: c.primaryPatient.identifiers,
              recordCount: c.primaryPatient._count.extractedRecords,
            },
            candidate: {
              id: c.candidatePatient.id,
              fullName: c.candidatePatient.fullName,
              dateOfBirth:
                c.candidatePatient.dateOfBirth?.toISOString() ?? null,
              sex: c.candidatePatient.sex,
              createdAt: c.candidatePatient.createdAt.toISOString(),
              identifiers: c.candidatePatient.identifiers,
              recordCount: c.candidatePatient._count.extractedRecords,
            },
          }))}
        />
      </ReviewShell>
    );
  }

  return (
    <ReviewShell>
      <OrgPicker orgs={orgs} activeOrgId={activeOrg.id} />
      <TabStrip
        activeOrgId={activeOrg.id}
        tab={tab}
        mergePending={mergePending}
      />

      {queue.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            Nothing awaiting review for{" "}
            <strong>{activeOrg.name}</strong>. Captured records that pass
            confidence checks land straight in Validated.
          </p>
          <Link
            href="/portal/capture"
            className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full bg-accent-ink text-white"
          >
            Capture records
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {queue.map((j) => {
            const record = j.extractedRecords[0];
            const tone =
              j.priority === "URGENT"
                ? "bg-[#fff4d4] text-[#7a4a00]"
                : "bg-bgl-alt text-accent-ink/65";
            const completeness = record?.completenessScore ?? null;
            const completenessTone =
              completeness == null
                ? "bg-bgl-alt text-accent-ink/55"
                : completeness >= 70
                  ? "bg-card-mint text-accent-emerald"
                  : completeness >= 50
                    ? "bg-[#fff4d4] text-[#7a4a00]"
                    : "bg-[#fde6e6] text-[#a83232]";

            return (
              <li key={j.id}>
                <Link
                  href={`/portal/review/${j.id}`}
                  className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                      <FileText size={16} />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-medium text-accent-ink truncate">
                          {DOC_LABELS[j.recordTypeHint] ?? j.recordTypeHint}
                        </p>
                        <span
                          className={`text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full ${tone}`}
                        >
                          {j.priority}
                        </span>
                        {completeness != null && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${completenessTone}`}
                            title="Completeness score"
                          >
                            {completeness}/100
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] text-accent-ink/55">
                        {j.batch.label ?? "Untitled batch"} ·{" "}
                        {new Date(j.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {completeness != null && completeness < 50 && (
                      <AlertTriangle
                        size={16}
                        className="text-[#a83232] shrink-0"
                      />
                    )}
                    <ArrowRight
                      size={16}
                      className="text-accent-ink/30 shrink-0"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ReviewShell>
  );
}

function ReviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Review
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Review queue
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Records the platform extracted but couldn&apos;t auto-approve. Open
        each one to check the original page, correct anything wrong, and
        approve it into the next Import Package.
      </p>
      {children}
    </div>
  );
}

function OrgPicker({
  orgs,
  activeOrgId,
}: {
  orgs: {
    id: string;
    name: string;
    type: string;
    country: string | null;
    state: string | null;
    lga: string | null;
    requestedByPartner: { id: string; name: string } | null;
    _count: { processingJobs: number };
  }[];
  activeOrgId: string;
}) {
  return (
    <div className="mt-8">
      <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium mb-3">
        Customer organization
      </p>
      <ul className="flex flex-wrap gap-2">
        {orgs.map((o) => {
          const active = o.id === activeOrgId;
          const count = o._count.processingJobs;
          return (
            <li key={o.id}>
              <Link
                href={`/portal/review?orgId=${o.id}`}
                className={`inline-flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-full transition-colors ${
                  active
                    ? "bg-accent-ink text-white"
                    : "border border-black/[0.1] text-accent-ink/75 hover:text-accent-ink hover:border-black/25"
                }`}
              >
                <Building2 size={12} />
                {o.name}
                <span
                  className={`text-[10px] font-mono ${
                    active ? "text-white/75" : "text-accent-ink/45"
                  }`}
                >
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TabStrip({
  activeOrgId,
  tab,
  mergePending,
}: {
  activeOrgId: string;
  tab: "extraction" | "merge";
  mergePending: number;
}) {
  const tabs: { value: "extraction" | "merge"; label: string; href: string; badge?: number }[] = [
    {
      value: "extraction",
      label: "Extraction queue",
      href: `/portal/review?orgId=${activeOrgId}`,
    },
    {
      value: "merge",
      label: "Merge queue",
      href: `/portal/review?orgId=${activeOrgId}&tab=merge`,
      badge: mergePending,
    },
  ];
  return (
    <div className="mt-6 flex items-center gap-2 text-[12px]">
      {tabs.map((t) => {
        const active = t.value === tab;
        return (
          <Link
            key={t.value}
            href={t.href}
            className={`px-3 py-1.5 rounded-full inline-flex items-center gap-2 ${
              active
                ? "bg-accent-ink text-white"
                : "border border-black/[0.1] text-accent-ink/65 hover:text-accent-ink"
            }`}
          >
            {t.value === "merge" ? <GitMerge size={11} /> : null}
            {t.label}
            {t.badge && t.badge > 0 ? (
              <span
                className={`text-[10px] font-medium leading-none px-1.5 py-0.5 rounded-full ${
                  active
                    ? "bg-white/15 text-white"
                    : "bg-[#fff4d4] text-[#7a4a00]"
                }`}
              >
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
