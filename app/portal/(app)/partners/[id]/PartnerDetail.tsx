"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  approveSandbox,
  rejectSandbox,
  approveProduction,
  rejectProduction,
} from "../actions";

type PartnerInfo = {
  id: string;
  name: string;
  slug: string;
  type: string;
  websiteUrl: string | null;
  country: string | null;
  accessStatus: string;
  primaryUseCase: string | null;
  expectedVolume: string | null;
  timeline: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  sandboxApprovedAt: string | null;
  productionRequestedAt: string | null;
  productionApprovedAt: string | null;
};

type ApiKeyRow = {
  id: string;
  last4: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

type UserRow = {
  id: string;
  email: string;
  role: string;
  joinedAt: string | null;
  externalId: string | null;
};

type ApprovalResult = {
  rawKey: string;
  last4: string;
  emailSent: boolean;
  emailError?: string;
} | null;

export default function PartnerDetail({
  partner,
  users,
  keys,
  profile,
  security,
  agreements,
}: {
  partner: PartnerInfo;
  users: UserRow[];
  keys: ApiKeyRow[];
  profile: {
    legalName: string | null;
    registeredAddress: string | null;
    contactPhone: string | null;
    completedAt: string | null;
  } | null;
  security: {
    dataResidency: string | null;
    retentionDays: number | null;
    encryptsAtRest: boolean;
    encryptsInTransit: boolean;
    hasIncidentResponse: boolean;
    hasNda: boolean;
    accessControlNotes: string | null;
    completedAt: string | null;
  } | null;
  agreements: {
    id: string;
    kind: string;
    signedAt: string;
    signedByEmail: string;
    signedByName: string | null;
    documentVersion: string;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(partner.reviewerNotes ?? "");
  const [rejectMode, setRejectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalResult>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  function handleApproveSandbox() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await approveSandbox({
          partnerId: partner.id,
          reviewerNotes: notes.trim() || undefined,
        });
        setApproval({
          rawKey: res.rawKey,
          last4: res.last4,
          emailSent: res.emailSent,
          emailError: res.emailError,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve.");
      }
    });
  }

  function handleRejectSandbox() {
    if (notes.trim().length < 1) {
      setError("Add a reason in the note so the requester gets context.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await rejectSandbox({
          partnerId: partner.id,
          reviewerNotes: notes.trim(),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject.");
      }
    });
  }

  function handleApproveProduction() {
    setError(null);
    startTransition(async () => {
      try {
        await approveProduction({
          partnerId: partner.id,
          reviewerNotes: notes.trim() || undefined,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve.");
      }
    });
  }

  function handleRejectProduction() {
    if (notes.trim().length < 1) {
      setError("Add a reason in the note so the partner gets context.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await rejectProduction({
          partnerId: partner.id,
          reviewerNotes: notes.trim(),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject.");
      }
    });
  }

  async function copyKey() {
    if (!approval) return;
    await navigator.clipboard.writeText(approval.rawKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1500);
  }

  const isPendingSandbox = partner.accessStatus === "PENDING_SANDBOX";
  const isProductionRequested = partner.accessStatus === "PRODUCTION_REQUESTED";

  return (
    <div className="grid lg:grid-cols-[1fr,360px] gap-8">
      {/* Left */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-[28px] md:text-[32px] leading-[1.1] tracking-[-0.02em] text-accent-ink font-medium">
            {partner.name}
          </h1>
          <StatusChip status={partner.accessStatus} />
        </div>
        <p className="mt-2 text-[13px] text-accent-ink/55">
          Signed up {new Date(partner.createdAt).toLocaleString()} ·{" "}
          {partner.type.replace(/_/g, " ").toLowerCase()}
        </p>

        <Section title="Onboarding context">
          <Row label="Use case">{partner.primaryUseCase ?? "—"}</Row>
          <Row label="Volume">{partner.expectedVolume ?? "—"}</Row>
          <Row label="Timeline">{partner.timeline ?? "—"}</Row>
          <Row label="Website">
            {partner.websiteUrl ? (
              <a
                href={normalizeUrl(partner.websiteUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-accent-emerald hover:underline break-all"
              >
                {partner.websiteUrl}
              </a>
            ) : (
              <span className="text-accent-ink/45">—</span>
            )}
          </Row>
          <Row label="Country">{partner.country ?? "—"}</Row>
        </Section>

        <Section title="People">
          {users.length === 0 ? (
            <p className="text-[13px] text-accent-ink/55">No users yet.</p>
          ) : (
            <ul className="space-y-1">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="text-[13px] text-accent-ink flex items-center justify-between gap-3"
                >
                  <span>
                    {u.email}{" "}
                    <span className="text-[11px] text-accent-ink/45">
                      {u.role.toLowerCase()}
                    </span>
                  </span>
                  <span className="text-[11px] text-accent-ink/45">
                    {u.joinedAt
                      ? "joined " +
                        new Date(u.joinedAt).toLocaleDateString()
                      : "invited"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="API keys">
          {keys.length === 0 ? (
            <p className="text-[13px] text-accent-ink/55">
              No keys issued yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="text-[13px] flex items-center justify-between gap-3"
                >
                  <span className="font-mono text-[12px] text-accent-ink">
                    pf_test_sk_…{k.last4}{" "}
                    <span className="text-[11px] text-accent-ink/55 font-sans">
                      {k.label ?? "no label"}
                    </span>
                  </span>
                  <span className="text-[11px] text-accent-ink/45">
                    {k.revokedAt ? "revoked" : k.lastUsedAt ? "used" : "unused"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Partner profile">
          {profile?.completedAt ? (
            <>
              <Row label="Legal name">{profile.legalName ?? "—"}</Row>
              <Row label="Address">{profile.registeredAddress ?? "—"}</Row>
              <Row label="Phone">{profile.contactPhone ?? "—"}</Row>
            </>
          ) : (
            <p className="text-[13px] text-accent-ink/55">
              Not completed yet.
            </p>
          )}
        </Section>

        <Section title="Security assessment">
          {security?.completedAt ? (
            <>
              <Row label="Data residency">
                {security.dataResidency?.toUpperCase() ?? "—"}
              </Row>
              <Row label="Retention">
                {security.retentionDays
                  ? `${security.retentionDays} days`
                  : "—"}
              </Row>
              <Row label="Encryption at rest">
                {security.encryptsAtRest ? "Yes" : "No"}
              </Row>
              <Row label="Encryption in transit">
                {security.encryptsInTransit ? "Yes" : "No"}
              </Row>
              <Row label="Incident response plan">
                {security.hasIncidentResponse ? "Yes" : "No"}
              </Row>
              <Row label="NDA in place">
                {security.hasNda ? "Yes" : "No"}
              </Row>
              {security.accessControlNotes ? (
                <Row label="Access controls">
                  <p className="whitespace-pre-wrap leading-[1.6]">
                    {security.accessControlNotes}
                  </p>
                </Row>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-accent-ink/55">
              Not completed yet.
            </p>
          )}
        </Section>

        <Section title="Agreements">
          {agreements.length === 0 ? (
            <p className="text-[13px] text-accent-ink/55">
              No agreements on file.
            </p>
          ) : (
            <ul className="space-y-1">
              {agreements.map((a) => (
                <li
                  key={a.id}
                  className="text-[12px] text-accent-ink flex items-center gap-2 flex-wrap"
                >
                  <span className="font-medium">{a.kind}</span>
                  <span className="text-accent-ink/55">
                    signed by {a.signedByName ?? a.signedByEmail} on{" "}
                    {new Date(a.signedAt).toLocaleDateString()}
                  </span>
                  <span className="text-[11px] text-accent-ink/35">
                    ({a.documentVersion})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Right */}
      <aside className="space-y-5">
        <div className="rounded-2xl border border-black/[0.08] p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent-ink/55 font-medium">
            Reviewer note
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isPendingSandbox || isProductionRequested
                ? "Required on reject. Optional on approve."
                : "Read-only for closed records."
            }
            disabled={!isPendingSandbox && !isProductionRequested || pending}
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

        {approval ? (
          <ApprovalCard approval={approval} copied={keyCopied} onCopy={copyKey} />
        ) : null}

        {/* Sandbox actions */}
        {isPendingSandbox && !approval ? (
          <ActionPanel
            primaryLabel={pending ? "Approving…" : "Approve sandbox access"}
            primaryIcon={<CheckCircle2 size={14} />}
            secondaryLabel={rejectMode ? "Confirm reject" : "Reject"}
            secondaryIcon={<XCircle size={14} />}
            primaryTone="emerald"
            rejectMode={rejectMode}
            pending={pending}
            onPrimary={
              rejectMode ? handleRejectSandbox : handleApproveSandbox
            }
            onSecondary={() => {
              if (rejectMode) handleRejectSandbox();
              else setRejectMode(true);
            }}
            onCancel={() => setRejectMode(false)}
            hint={
              rejectMode
                ? "Note above is sent to the partner as the rejection reason."
                : "Issues a sandbox API key, links to the platform org, and emails the partner."
            }
          />
        ) : null}

        {/* Production actions */}
        {isProductionRequested && !approval ? (
          <ActionPanel
            primaryLabel={pending ? "Approving…" : "Approve production"}
            primaryIcon={<Sparkles size={14} />}
            secondaryLabel={
              rejectMode ? "Send back with notes" : "Reject / send back"
            }
            secondaryIcon={<XCircle size={14} />}
            primaryTone="ink"
            rejectMode={rejectMode}
            pending={pending}
            onPrimary={
              rejectMode ? handleRejectProduction : handleApproveProduction
            }
            onSecondary={() => {
              if (rejectMode) handleRejectProduction();
              else setRejectMode(true);
            }}
            onCancel={() => setRejectMode(false)}
            hint={
              rejectMode
                ? "Note above is sent to the partner. They drop back to sandbox and can re-request."
                : "Flips status to PRODUCTION and unlocks live key issuance for this partner."
            }
          />
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

function StatusChip({ status }: { status: string }) {
  const tone: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> =
    {
      PENDING_SANDBOX: {
        bg: "bg-[#fff4d4]",
        text: "text-[#7a4a00]",
        label: "Awaiting sandbox",
        icon: <Clock size={10} />,
      },
      SANDBOX: {
        bg: "bg-card-mint",
        text: "text-accent-emerald",
        label: "Sandbox",
        icon: <CheckCircle2 size={10} />,
      },
      PRODUCTION_REQUESTED: {
        bg: "bg-[#cfdcff]",
        text: "text-[#1b3a8e]",
        label: "Prod requested",
        icon: <Sparkles size={10} />,
      },
      PRODUCTION: {
        bg: "bg-accent-emerald",
        text: "text-white",
        label: "Production",
        icon: <CheckCircle2 size={10} />,
      },
      SUSPENDED: {
        bg: "bg-[#fde6e6]",
        text: "text-[#a83232]",
        label: "Suspended",
        icon: <XCircle size={10} />,
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

function ApprovalCard({
  approval,
  copied,
  onCopy,
}: {
  approval: NonNullable<ApprovalResult>;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-accent-emerald/40 bg-card-mint p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-accent-emerald" />
        <p className="text-[13px] font-medium text-accent-emerald">
          Sandbox key issued
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent-emerald font-medium">
          API key — shown once
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-md border border-accent-emerald/30 bg-white px-3 py-2.5">
          <code className="flex-1 text-[12px] font-mono text-accent-ink break-all">
            {approval.rawKey}
          </code>
          <button
            onClick={onCopy}
            className="text-accent-emerald hover:opacity-70 shrink-0"
            title="Copy"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <p className="text-[12px] text-accent-ink/75 leading-[1.65]">
        {approval.emailSent
          ? "Email with the key has been sent to the partner."
          : `Email send failed: ${approval.emailError ?? "unknown"}. Share the key with them manually.`}
      </p>
    </div>
  );
}

function ActionPanel({
  primaryLabel,
  primaryIcon,
  secondaryLabel,
  secondaryIcon,
  primaryTone,
  rejectMode,
  pending,
  onPrimary,
  onSecondary,
  onCancel,
  hint,
}: {
  primaryLabel: string;
  primaryIcon: React.ReactNode;
  secondaryLabel: string;
  secondaryIcon: React.ReactNode;
  primaryTone: "emerald" | "ink";
  rejectMode: boolean;
  pending: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onCancel: () => void;
  hint: string;
}) {
  const primaryClass =
    primaryTone === "emerald"
      ? "bg-accent-emerald text-white"
      : "bg-accent-ink text-white";

  return (
    <div className="space-y-2">
      {!rejectMode ? (
        <>
          <button
            onClick={onPrimary}
            disabled={pending}
            className={`w-full px-4 py-3 rounded-md ${primaryClass} text-[13px] font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2`}
          >
            {primaryIcon}
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            disabled={pending}
            className="w-full px-4 py-3 rounded-md border border-black/[0.12] text-[13px] text-accent-ink hover:border-black/30 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {secondaryIcon}
            {secondaryLabel}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onSecondary}
            disabled={pending}
            className="w-full px-4 py-3 rounded-md bg-[#a83232] text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {secondaryIcon}
            {secondaryLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={pending}
            className="w-full px-4 py-3 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:text-accent-ink"
          >
            Cancel
          </button>
        </>
      )}
      <p className="text-[11px] text-accent-ink/55 leading-[1.6] pt-1">
        {hint}
      </p>
    </div>
  );
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
