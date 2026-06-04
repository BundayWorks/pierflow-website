"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
} from "lucide-react";
import { approveOrganization, rejectOrganization } from "../actions";

type Org = {
  id: string;
  name: string;
  type: string;
  country: string | null;
  state: string | null;
  lga: string | null;
  mrnSystem: string | null;
  accessStatus: string;
  rejectionReason: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  approvedAt: string | null;
  requestedByPartner: {
    id: string;
    name: string;
    accessStatus: string;
  } | null;
};

export default function OrganizationDetail({
  org,
  linkedPartners,
  history,
}: {
  org: Org;
  linkedPartners: { id: string; name: string; accessStatus: string }[];
  history: {
    id: string;
    action: string;
    actor: string | null;
    notes: string | null;
    occurredAt: string;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(org.reviewerNotes ?? "");
  const [rejectMode, setRejectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = org.accessStatus === "PENDING";

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveOrganization({
          organizationId: org.id,
          reviewerNotes: notes.trim() || undefined,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve.");
      }
    });
  }

  function handleReject() {
    if (notes.trim().length < 1) {
      setError("Add a reason so the partner gets context.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await rejectOrganization({
          organizationId: org.id,
          rejectionReason: notes.trim(),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject.");
      }
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr,360px] gap-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-[28px] md:text-[32px] leading-[1.1] tracking-[-0.02em] text-accent-ink font-medium">
            {org.name}
          </h1>
          <Chip status={org.accessStatus} />
        </div>
        <p className="mt-2 text-[13px] text-accent-ink/55">
          Submitted {new Date(org.createdAt).toLocaleString()} ·{" "}
          {org.type.replace(/_/g, " ").toLowerCase()}
        </p>

        <Section title="Requested by">
          {org.requestedByPartner ? (
            <Link
              href={`/portal/partners/${org.requestedByPartner.id}`}
              className="text-[14px] text-accent-emerald hover:underline inline-flex items-center gap-2"
            >
              <Building2 size={14} />
              {org.requestedByPartner.name}
              <span className="text-[11px] text-accent-ink/45">
                ({org.requestedByPartner.accessStatus.toLowerCase()})
              </span>
            </Link>
          ) : (
            <span className="text-[13px] text-accent-ink/55">
              Pierflow staff
            </span>
          )}
        </Section>

        <Section title="Details">
          <Row label="Country">{org.country ?? "—"}</Row>
          <Row label="State">{org.state ?? "—"}</Row>
          <Row label="LGA">{org.lga ?? "—"}</Row>
          <Row label="MRN system">
            {org.mrnSystem ? (
              <code className="text-[12px] font-mono">{org.mrnSystem}</code>
            ) : (
              <span className="text-accent-ink/45">—</span>
            )}
          </Row>
          <Row label="Org id">
            <code className="text-[12px] font-mono">{org.id}</code>
          </Row>
        </Section>

        <Section title="Linked partners">
          {linkedPartners.length === 0 ? (
            <p className="text-[13px] text-accent-ink/55">
              No partners linked yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {linkedPartners.map((p) => (
                <li
                  key={p.id}
                  className="text-[13px] text-accent-ink flex items-center justify-between gap-3"
                >
                  <Link
                    href={`/portal/partners/${p.id}`}
                    className="text-accent-emerald hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="text-[11px] text-accent-ink/45">
                    {p.accessStatus.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="History">
          {history.length === 0 ? (
            <p className="text-[13px] text-accent-ink/55">No events yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="text-[12px] text-accent-ink leading-[1.5]"
                >
                  <span className="font-medium">{h.action}</span>{" "}
                  <span className="text-accent-ink/55">
                    · {new Date(h.occurredAt).toLocaleString()}
                  </span>
                  {h.actor ? (
                    <span className="text-[11px] text-accent-ink/45 ml-1">
                      by {h.actor}
                    </span>
                  ) : null}
                  {h.notes ? (
                    <p className="mt-1 text-accent-ink/65">{h.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <aside className="space-y-5">
        <div className="rounded-2xl border border-black/[0.08] p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent-ink/55 font-medium">
            Reviewer note
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isPending
                ? "Optional on approve. Required on reject."
                : "Read-only for closed records."
            }
            disabled={!isPending || pending}
            rows={6}
            className="mt-3 w-full text-[13px] leading-[1.6] rounded-md border border-black/[0.1] bg-white p-3 focus:outline-none focus:border-accent-emerald/60 disabled:bg-bgl-alt disabled:cursor-not-allowed"
          />
        </div>

        {error ? (
          <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        {isPending ? (
          <div className="space-y-2">
            {!rejectMode ? (
              <>
                <button
                  onClick={handleApprove}
                  disabled={pending}
                  className="w-full px-4 py-3 rounded-md bg-accent-emerald text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={14} />
                  {pending ? "Approving…" : "Approve organization"}
                </button>
                <button
                  onClick={() => setRejectMode(true)}
                  disabled={pending}
                  className="w-full px-4 py-3 rounded-md border border-black/[0.12] text-[13px] text-accent-ink hover:border-black/30 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <XCircle size={14} />
                  Reject
                </button>
                <p className="text-[11px] text-accent-ink/55 leading-[1.6] pt-1">
                  Approving grants the requesting partner an organizationLink
                  and unlocks ingest into this org.
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={handleReject}
                  disabled={pending}
                  className="w-full px-4 py-3 rounded-md bg-[#a83232] text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <XCircle size={14} />
                  {pending ? "Rejecting…" : "Confirm reject"}
                </button>
                <button
                  onClick={() => setRejectMode(false)}
                  disabled={pending}
                  className="w-full px-4 py-3 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:text-accent-ink"
                >
                  Cancel
                </button>
                <p className="text-[11px] text-accent-ink/55 leading-[1.6] pt-1">
                  The note above is shown to the partner verbatim.
                </p>
              </>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 pt-6 border-t border-black/[0.06]">
      <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium mb-3">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px,1fr] gap-4">
      <dt className="text-[12px] text-accent-ink/55">{label}</dt>
      <dd className="text-[13px] text-accent-ink">{children}</dd>
    </div>
  );
}

function Chip({ status }: { status: string }) {
  const tone: Record<
    string,
    { bg: string; text: string; label: string; icon: React.ReactNode }
  > = {
    PENDING: {
      bg: "bg-[#fff4d4]",
      text: "text-[#7a4a00]",
      label: "Pending",
      icon: <Clock size={10} />,
    },
    ACTIVE: {
      bg: "bg-card-mint",
      text: "text-accent-emerald",
      label: "Active",
      icon: <CheckCircle2 size={10} />,
    },
    REJECTED: {
      bg: "bg-[#fde6e6]",
      text: "text-[#a83232]",
      label: "Rejected",
      icon: <XCircle size={10} />,
    },
    SUSPENDED: {
      bg: "bg-[#fde6e6]",
      text: "text-[#a83232]",
      label: "Suspended",
      icon: <AlertCircle size={10} />,
    },
  };
  const t = tone[status];
  if (!t) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full ${t.bg} ${t.text}`}
    >
      {t.icon}
      {t.label}
    </span>
  );
}
