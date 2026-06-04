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
} from "lucide-react";
import {
  approveAccessRequest,
  rejectAccessRequest,
  saveAccessRequestNotes,
} from "../actions";

type RequestRow = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  email: string;
  company: string;
  websiteUrl: string | null;
  useCase: string;
  expectedVolume: string | null;
  partnerType: string;
  ipAddress: string | null;
  userAgent: string | null;
  reviewedAt: Date | null;
  reviewerNotes: string | null;
  reviewerExternalId: string | null;
  approvedApiKeyLast4: string | null;
  approvedPartner: { id: string; name: string; slug: string } | null;
};

type ApproveResult = {
  partnerId: string;
  rawKey: string;
  last4: string;
  emailSent: boolean;
  emailError?: string;
};

export default function AccessRequestDetail({
  request,
}: {
  request: RequestRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(request.reviewerNotes ?? "");
  const [rejectMode, setRejectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApproveResult | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const isPending = request.status === "PENDING";

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await approveAccessRequest({
          requestId: request.id,
          reviewerNotes: notes.trim() || undefined,
        });
        setApproval({
          partnerId: res.partnerId,
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

  function handleReject() {
    if (notes.trim().length < 1) {
      setError("Add a reason in the note so the requester gets context.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await rejectAccessRequest({
          requestId: request.id,
          reviewerNotes: notes.trim(),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject.");
      }
    });
  }

  function handleSaveNotes() {
    setError(null);
    startTransition(async () => {
      try {
        await saveAccessRequestNotes({
          requestId: request.id,
          reviewerNotes: notes,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save notes.");
      }
    });
  }

  async function copyKey() {
    if (!approval) return;
    await navigator.clipboard.writeText(approval.rawKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1500);
  }

  return (
    <div className="grid lg:grid-cols-[1fr,360px] gap-8">
      {/* Left — request body */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-[28px] md:text-[32px] leading-[1.1] tracking-[-0.02em] text-accent-ink font-medium">
            {request.company}
          </h1>
          <StatusChip status={request.status} />
        </div>
        <p className="mt-2 text-[13px] text-accent-ink/55">
          Submitted {new Date(request.createdAt).toLocaleString()}
        </p>

        <dl className="mt-8 divide-y divide-black/[0.06] border-y border-black/[0.06]">
          <Row label="Requester">
            {request.name}{" "}
            <span className="text-accent-ink/55">&lt;{request.email}&gt;</span>
          </Row>
          <Row label="Partner type">
            <span className="capitalize">
              {request.partnerType.replace(/_/g, " ").toLowerCase()}
            </span>
          </Row>
          <Row label="Website">
            {request.websiteUrl ? (
              <a
                href={normalizeUrl(request.websiteUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-accent-emerald hover:underline break-all"
              >
                {request.websiteUrl}
              </a>
            ) : (
              <span className="text-accent-ink/45">—</span>
            )}
          </Row>
          <Row label="Expected volume">
            {request.expectedVolume ?? (
              <span className="text-accent-ink/45">—</span>
            )}
          </Row>
          <Row label="Use case">
            <p className="whitespace-pre-wrap leading-[1.65]">
              {request.useCase}
            </p>
          </Row>
          <Row label="Origin">
            <span className="text-[12px] font-mono text-accent-ink/65">
              {request.ipAddress ?? "unknown"}
            </span>
            {request.userAgent ? (
              <p className="mt-1 text-[11px] font-mono text-accent-ink/45 break-all">
                {request.userAgent}
              </p>
            ) : null}
          </Row>
          {request.reviewedAt ? (
            <Row label="Reviewed">
              {new Date(request.reviewedAt).toLocaleString()}
              {request.reviewerExternalId ? (
                <span className="ml-2 text-[11px] text-accent-ink/45">
                  by {request.reviewerExternalId}
                </span>
              ) : null}
            </Row>
          ) : null}
          {request.approvedPartner ? (
            <Row label="Approved partner">
              <a
                href={`/portal/settings`}
                className="text-accent-emerald hover:underline"
              >
                {request.approvedPartner.name}
              </a>
              {request.approvedApiKeyLast4 ? (
                <span className="ml-2 text-[12px] font-mono text-accent-ink/55">
                  key …{request.approvedApiKeyLast4}
                </span>
              ) : null}
            </Row>
          ) : null}
        </dl>
      </div>

      {/* Right — review actions */}
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
                ? "Optional on approve. Required on reject — explain so the requester gets context."
                : "Note is read-only on closed requests."
            }
            disabled={!isPending || pending}
            rows={6}
            className="mt-3 w-full text-[13px] leading-[1.6] rounded-md border border-black/[0.1] bg-white p-3 focus:outline-none focus:border-accent-emerald/60 disabled:bg-bgl-alt disabled:cursor-not-allowed"
          />
          {isPending && (
            <button
              onClick={handleSaveNotes}
              disabled={pending}
              className="mt-2 text-[11px] text-accent-ink/55 hover:text-accent-ink"
            >
              Save note without deciding →
            </button>
          )}
        </div>

        {error ? (
          <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        {approval ? (
          <ApprovalResultCard
            approval={approval}
            copied={keyCopied}
            onCopy={copyKey}
            email={request.email}
          />
        ) : isPending ? (
          <div className="space-y-2">
            {!rejectMode ? (
              <>
                <button
                  onClick={handleApprove}
                  disabled={pending}
                  className="w-full px-4 py-3 rounded-md bg-accent-emerald text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={14} />
                  {pending ? "Approving…" : "Approve & issue API key"}
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
                  On approve we create a Partner under the Pierflow Platform
                  org, generate a test API key, and email it to {request.email}.
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
                  The note above is sent to {request.email} as the rejection
                  reason. Make sure it&apos;s appropriate to share.
                </p>
              </>
            )}
          </div>
        ) : null}
      </aside>
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
    <div className="py-3 grid grid-cols-[140px,1fr] gap-4">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium pt-0.5">
        {label}
      </dt>
      <dd className="text-[14px] text-accent-ink">{children}</dd>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} />
        Pending
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} />
        Approved
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <XCircle size={10} />
        Rejected
      </span>
    );
  }
  return null;
}

function ApprovalResultCard({
  approval,
  copied,
  onCopy,
  email,
}: {
  approval: ApproveResult;
  copied: boolean;
  onCopy: () => void;
  email: string;
}) {
  return (
    <div className="rounded-2xl border border-accent-emerald/40 bg-card-mint p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-accent-emerald" />
        <p className="text-[13px] font-medium text-accent-emerald">
          Partner provisioned
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
        <p className="mt-2 text-[11px] text-accent-emerald/80 leading-[1.6]">
          This key is never shown again. Copy it now if you need to share it
          out-of-band.
        </p>
      </div>
      <div className="text-[12px] text-accent-ink/75 leading-[1.65]">
        {approval.emailSent ? (
          <>Approval email with the key has been sent to {email}.</>
        ) : (
          <span className="text-[#7a2222]">
            Email send failed: {approval.emailError ?? "unknown"}. Share the
            key with {email} manually.
          </span>
        )}
      </div>
    </div>
  );
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
