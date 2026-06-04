"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Sparkles,
  CircleDashed,
  ArrowRight,
  Building2,
  ShieldCheck,
  FileSignature,
  AlertCircle,
} from "lucide-react";
import type { ChecklistState } from "@/lib/partnerChecklist";
import {
  signDpa,
  saveSecurityAssessment,
  requestProductionAccess,
} from "./actions";

type PartnerInfo = {
  id: string;
  name: string;
  accessStatus:
    | "PENDING_SANDBOX"
    | "SANDBOX"
    | "PRODUCTION_REQUESTED"
    | "PRODUCTION"
    | "SUSPENDED";
  sandboxApprovedAt: string | null;
  productionRequestedAt: string | null;
  reviewerNotes: string | null;
  primaryUseCase: string | null;
  expectedVolume: string | null;
  timeline: string | null;
};

type ProfileInfo = {
  legalName: string | null;
  registeredAddress: string | null;
  contactPhone: string | null;
  completedAt: string | null;
} | null;

type SecurityInfo = {
  dataResidency: string | null;
  retentionDays: number | null;
  accessControlNotes: string | null;
  encryptsAtRest: boolean;
  encryptsInTransit: boolean;
  hasIncidentResponse: boolean;
  hasNda: boolean;
  completedAt: string | null;
} | null;

type SandboxKey = {
  id: string;
  last4: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
} | null;

export default function OverviewClient({
  partner,
  security,
  checklist,
  sandboxKey,
}: {
  partner: PartnerInfo;
  // profile is wired through in the page component for future use (a
  // "Complete profile" form lives here next), but the current checklist
  // doesn't surface it yet — keep the page reading it so we don't have
  // to plumb it twice when we add the form.
  profile: ProfileInfo;
  security: SecurityInfo;
  checklist: ChecklistState;
  sandboxKey: SandboxKey;
}) {
  return (
    <div className="space-y-10">
      <StatusBanner partner={partner} />

      <Checklist
        partner={partner}
        security={security}
        sandboxKey={sandboxKey}
        checklist={checklist}
      />

      <ProductionAction partner={partner} checklist={checklist} />

      <Resources />
    </div>
  );
}

/* ─── Status banner ──────────────────────────────────────────── */

function StatusBanner({ partner }: { partner: PartnerInfo }) {
  const status = partner.accessStatus;
  const tone: Record<string, { bg: string; chip: string; chipText: string; label: string }> =
    {
      PENDING_SANDBOX: {
        bg: "bg-[#fffaee] border-[#fff4d4]",
        chip: "bg-[#fff4d4]",
        chipText: "text-[#7a4a00]",
        label: "Awaiting sandbox approval",
      },
      SANDBOX: {
        bg: "bg-card-mint border-accent-emerald/30",
        chip: "bg-accent-emerald/15",
        chipText: "text-accent-emerald",
        label: "Sandbox active",
      },
      PRODUCTION_REQUESTED: {
        bg: "bg-[#eef3ff] border-[#cfdcff]",
        chip: "bg-[#cfdcff]",
        chipText: "text-[#1b3a8e]",
        label: "Production access requested",
      },
      PRODUCTION: {
        bg: "bg-card-mint border-accent-emerald/30",
        chip: "bg-accent-emerald/15",
        chipText: "text-accent-emerald",
        label: "Live access",
      },
      SUSPENDED: {
        bg: "bg-[#fde6e6] border-[#a83232]/30",
        chip: "bg-[#fde6e6]",
        chipText: "text-[#7a2222]",
        label: "Account suspended",
      },
    };
  const t = tone[status];

  return (
    <div className={`rounded-2xl border ${t.bg} p-6`}>
      <div className="flex items-start gap-4">
        <span
          className={`text-[11px] uppercase tracking-[0.14em] font-medium px-2.5 py-1 rounded-full ${t.chip} ${t.chipText}`}
        >
          {t.label}
        </span>
      </div>
      <h1 className="mt-4 font-display text-[28px] md:text-[32px] leading-[1.1] tracking-[-0.02em] text-accent-ink font-medium">
        {welcomeHeadline(status, partner.name)}
      </h1>
      <p className="mt-3 text-[14px] leading-[1.65] text-accent-ink/65 max-w-[640px]">
        {welcomeBody(status, partner)}
      </p>
      {status === "SUSPENDED" && partner.reviewerNotes ? (
        <p className="mt-3 text-[13px] text-[#7a2222] flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {partner.reviewerNotes}
        </p>
      ) : null}
    </div>
  );
}

function welcomeHeadline(status: string, name: string): string {
  switch (status) {
    case "PENDING_SANDBOX":
      return `Welcome to Pierflow, ${name}.`;
    case "SANDBOX":
      return "You're ready to start integrating.";
    case "PRODUCTION_REQUESTED":
      return "We're reviewing your production request.";
    case "PRODUCTION":
      return "You're live on Pierflow.";
    case "SUSPENDED":
      return "Your account is paused.";
    default:
      return name;
  }
}

function welcomeBody(status: string, partner: PartnerInfo): string {
  switch (status) {
    case "PENDING_SANDBOX":
      return "We're reviewing your account and will issue your sandbox API key shortly — usually within one business day. While you wait, you can complete your profile, sign the DPA, and read through the docs.";
    case "SANDBOX":
      return "Your sandbox API key is below. Use it to wire up your integration against test data, then complete the production access checklist to unlock live keys.";
    case "PRODUCTION_REQUESTED":
      return "Thanks for submitting. Our team will review your production access request within one business day and email you with the outcome.";
    case "PRODUCTION":
      return "You can now issue live API keys from the keys page. Welcome to production.";
    case "SUSPENDED":
      return "Your access is currently paused. See the reviewer note below, or reach out to pierflowllc@gmail.com.";
    default:
      return `Use case: ${partner.primaryUseCase ?? "—"}. Timeline: ${
        partner.timeline ?? "—"
      }.`;
  }
}

/* ─── Checklist ──────────────────────────────────────────────── */

function Checklist({
  partner,
  security,
  sandboxKey,
  checklist,
}: {
  partner: PartnerInfo;
  security: SecurityInfo;
  sandboxKey: SandboxKey;
  checklist: ChecklistState;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-[20px] md:text-[22px] tracking-[-0.01em] text-accent-ink font-medium">
          Production access checklist
        </h2>
        <p className="text-[12px] text-accent-ink/55">
          {checklist.doneCount} of {checklist.requiredCount} complete
        </p>
      </div>
      <div className="rounded-2xl border border-black/[0.08] overflow-hidden">
        {checklist.items.map((item, idx) => {
          const blocked = item.blockedBy
            ? !checklist.items.find((i) => i.key === item.blockedBy)?.done
            : false;
          const isOpen = open === item.key;
          return (
            <div
              key={item.key}
              className={`border-b border-black/[0.06] last:border-b-0 ${
                isOpen ? "bg-bgl-alt/50" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : item.key)}
                disabled={blocked}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-bgl-alt/30 transition-colors disabled:hover:bg-transparent"
              >
                <ChecklistIcon done={item.done} blocked={blocked} index={idx} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[14px] font-medium ${
                      item.done
                        ? "text-accent-ink/55 line-through decoration-accent-emerald/40"
                        : "text-accent-ink"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[12px] text-accent-ink/55">
                    {item.owner === "pierflow"
                      ? "Pierflow team"
                      : blocked
                        ? "Unlocks after Pierflow approves your sandbox"
                        : "You"}
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/35 font-medium">
                  {isOpen ? "Hide" : "Open"}
                </span>
              </button>
              {isOpen ? (
                <div className="px-5 pb-5 -mt-1 pl-[68px]">
                  <p className="text-[13px] text-accent-ink/75 leading-[1.65]">
                    {item.description}
                  </p>
                  <ChecklistDetail
                    item={item.key}
                    partner={partner}
                    security={security}
                    sandboxKey={sandboxKey}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistIcon({
  done,
  blocked,
  index,
}: {
  done: boolean;
  blocked: boolean;
  index: number;
}) {
  if (done) {
    return (
      <span className="w-7 h-7 rounded-full bg-accent-emerald text-white grid place-items-center shrink-0">
        <Check size={14} />
      </span>
    );
  }
  if (blocked) {
    return (
      <span className="w-7 h-7 rounded-full bg-black/[0.05] text-accent-ink/30 grid place-items-center shrink-0">
        <Clock size={13} />
      </span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-full border-2 border-accent-ink/15 text-accent-ink/45 grid place-items-center shrink-0 text-[12px] font-medium">
      {index + 1}
    </span>
  );
}

/* ─── Checklist detail panes ─────────────────────────────────── */

function ChecklistDetail({
  item,
  partner,
  security,
  sandboxKey,
}: {
  item: string;
  partner: PartnerInfo;
  security: SecurityInfo;
  sandboxKey: SandboxKey;
}) {
  if (item === "sandboxApproved") {
    return (
      <div className="mt-4">
        {partner.accessStatus === "PENDING_SANDBOX" ? (
          <p className="text-[12px] text-accent-ink/55 leading-[1.65]">
            Nothing to do here yet — we&apos;ll email you the moment your
            sandbox key is ready.
          </p>
        ) : (
          <p className="text-[12px] text-accent-ink/55 leading-[1.65]">
            Approved on{" "}
            {partner.sandboxApprovedAt
              ? new Date(partner.sandboxApprovedAt).toLocaleDateString()
              : "—"}
            .{" "}
            {sandboxKey ? (
              <>
                Your sandbox key is{" "}
                <code className="text-[12px] font-mono text-accent-ink">
                  pf_test_sk_…{sandboxKey.last4}
                </code>{" "}
                — manage it on the{" "}
                <Link
                  href="/portal/keys"
                  className="text-accent-emerald hover:underline"
                >
                  API keys page
                </Link>
                .
              </>
            ) : null}
          </p>
        )}
      </div>
    );
  }

  if (item === "emailVerified") {
    return (
      <p className="mt-4 text-[12px] text-accent-ink/55 leading-[1.65]">
        Email ownership was confirmed when you accepted your Pierflow
        invitation. Nothing more to do here.
      </p>
    );
  }

  if (item === "firstApiCall") {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-[12px] text-accent-ink/55 leading-[1.65]">
          Once your sandbox key is issued, run this from your terminal:
        </p>
        <pre className="text-[12px] font-mono bg-dark-bg text-white rounded-md p-3 overflow-x-auto">
{`curl -H "Authorization: Bearer pf_test_sk_…" \\
  https://www.pierflow.com/v1/organizations`}
        </pre>
        <p className="text-[12px] text-accent-ink/55 leading-[1.65]">
          We&apos;ll automatically tick this item the next time you hit any
          /v1/* endpoint.
        </p>
      </div>
    );
  }

  if (item === "dpaSigned") {
    return <DpaSigner />;
  }

  if (item === "securityAssessment") {
    return <SecurityForm initial={security} />;
  }

  return null;
}

/* ─── DPA signer ─────────────────────────────────────────────── */

function DpaSigner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSign() {
    setError(null);
    startTransition(async () => {
      try {
        await signDpa();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sign.");
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-black/[0.08] bg-white p-4 text-[12px] leading-[1.65] text-accent-ink/75">
        <p className="font-medium text-accent-ink mb-2">
          <FileSignature
            size={13}
            className="inline -mt-0.5 mr-1 text-accent-emerald"
          />
          Data Processing Agreement (excerpt)
        </p>
        <p>
          You agree to process patient records on behalf of organisations
          using the Pierflow API solely to provide your stated service. You
          will not retain raw records longer than necessary, will encrypt all
          data at rest and in transit, and will notify Pierflow within 72
          hours of any suspected security incident affecting Pierflow-sourced
          data. The full agreement will be added here as a downloadable PDF
          before live access. Signing now binds you to these terms.
        </p>
      </div>
      <label className="flex items-start gap-2 text-[12px] text-accent-ink/75 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        I have read and agree to the data processing agreement on behalf of my
        organisation.
      </label>
      <button
        type="button"
        onClick={handleSign}
        disabled={!acknowledged || pending}
        className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
      >
        {pending ? "Recording signature…" : "Sign DPA"}
      </button>
      {error ? (
        <p className="text-[12px] text-[#7a2222]">{error}</p>
      ) : null}
    </div>
  );
}

/* ─── Security questionnaire ─────────────────────────────────── */

function SecurityForm({ initial }: { initial: SecurityInfo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dataResidency, setDataResidency] = useState<string>(
    initial?.dataResidency ?? "",
  );
  const [retentionDays, setRetentionDays] = useState<number | "">(
    initial?.retentionDays ?? "",
  );
  const [encryptsAtRest, setEncryptsAtRest] = useState(
    initial?.encryptsAtRest ?? false,
  );
  const [encryptsInTransit, setEncryptsInTransit] = useState(
    initial?.encryptsInTransit ?? false,
  );
  const [hasIncidentResponse, setHasIncidentResponse] = useState(
    initial?.hasIncidentResponse ?? false,
  );
  const [hasNda, setHasNda] = useState(initial?.hasNda ?? false);
  const [accessControlNotes, setAccessControlNotes] = useState(
    initial?.accessControlNotes ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveSecurityAssessment({
          dataResidency:
            dataResidency === ""
              ? undefined
              : (dataResidency as "ng" | "eu" | "us" | "other"),
          retentionDays:
            retentionDays === "" ? undefined : Number(retentionDays),
          accessControlNotes: accessControlNotes || undefined,
          encryptsAtRest,
          encryptsInTransit,
          hasIncidentResponse,
          hasNda,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-[12px] text-accent-ink">
          Where will Pierflow data be stored?
          <select
            value={dataResidency}
            onChange={(e) => setDataResidency(e.target.value)}
            className="mt-1 w-full text-[13px] rounded-md border border-black/[0.12] bg-white px-3 py-2 focus:outline-none focus:border-accent-emerald/60"
          >
            <option value="">Select region</option>
            <option value="ng">Nigeria</option>
            <option value="eu">EU</option>
            <option value="us">US</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-[12px] text-accent-ink">
          Retention period (days)
          <input
            type="number"
            min={1}
            max={3650}
            value={retentionDays}
            onChange={(e) =>
              setRetentionDays(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="mt-1 w-full text-[13px] rounded-md border border-black/[0.12] bg-white px-3 py-2 focus:outline-none focus:border-accent-emerald/60"
          />
        </label>
      </div>
      <div className="space-y-2">
        <CheckboxField
          checked={encryptsAtRest}
          onChange={setEncryptsAtRest}
          label="Data is encrypted at rest"
        />
        <CheckboxField
          checked={encryptsInTransit}
          onChange={setEncryptsInTransit}
          label="All API traffic uses TLS"
        />
        <CheckboxField
          checked={hasIncidentResponse}
          onChange={setHasIncidentResponse}
          label="We have a documented incident response plan"
        />
        <CheckboxField
          checked={hasNda}
          onChange={setHasNda}
          label="All employees with data access are under NDA (optional)"
        />
      </div>
      <label className="block text-[12px] text-accent-ink">
        How is internal access to data controlled? (optional)
        <textarea
          rows={3}
          value={accessControlNotes}
          onChange={(e) => setAccessControlNotes(e.target.value)}
          placeholder="e.g. SSO + scoped roles, audit log, no production access for engineers without on-call duty…"
          className="mt-1 w-full text-[13px] leading-[1.6] rounded-md border border-black/[0.12] bg-white px-3 py-2 focus:outline-none focus:border-accent-emerald/60"
        />
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white disabled:opacity-40 hover:opacity-90"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error ? (
        <p className="text-[12px] text-[#7a2222]">{error}</p>
      ) : null}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2 text-[13px] text-accent-ink/85 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      {label}
    </label>
  );
}

/* ─── Request production button ──────────────────────────────── */

function ProductionAction({
  partner,
  checklist,
}: {
  partner: PartnerInfo;
  checklist: ChecklistState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (partner.accessStatus === "PRODUCTION") return null;
  if (partner.accessStatus === "SUSPENDED") return null;

  if (partner.accessStatus === "PRODUCTION_REQUESTED") {
    return (
      <div className="rounded-2xl border border-black/[0.08] p-5 flex items-start gap-3">
        <CircleDashed size={18} className="mt-0.5 text-accent-ink/45" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-accent-ink">
            Production access requested
          </p>
          <p className="mt-1 text-[12px] text-accent-ink/65 leading-[1.6]">
            Submitted{" "}
            {partner.productionRequestedAt
              ? new Date(partner.productionRequestedAt).toLocaleString()
              : "recently"}
            . We&apos;ll email you with the outcome — usually within one
            business day.
          </p>
        </div>
      </div>
    );
  }

  const ready = checklist.allRequiredDone && partner.accessStatus === "SANDBOX";

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      try {
        await requestProductionAccess();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-black/[0.08] p-5">
      <div className="flex items-start gap-3">
        <Sparkles
          size={18}
          className={`mt-0.5 ${
            ready ? "text-accent-emerald" : "text-accent-ink/35"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-accent-ink">
            Request production access
          </p>
          <p className="mt-1 text-[12px] text-accent-ink/65 leading-[1.6]">
            {ready
              ? "Everything's checked off. Submit your request and we'll review and unlock live keys, usually within one business day."
              : "Once every checklist item is green, this button activates so you can request live keys."}
          </p>
        </div>
        <button
          type="button"
          disabled={!ready || pending}
          onClick={handleRequest}
          className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-ink text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {pending ? "Submitting…" : "Request access"}
          {!pending && <ArrowRight size={13} />}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-[12px] text-[#7a2222]">{error}</p>
      ) : null}
    </div>
  );
}

/* ─── Resources strip ────────────────────────────────────────── */

function Resources() {
  return (
    <div>
      <h2 className="font-display text-[20px] md:text-[22px] tracking-[-0.01em] text-accent-ink font-medium mb-4">
        Resources
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ResourceCard
          href="/docs/quickstart/introduction"
          icon={<Building2 size={16} />}
          title="Quick start"
          body="Wire up your integration end-to-end in 15 minutes."
          external
        />
        <ResourceCard
          href="/docs"
          icon={<ShieldCheck size={16} />}
          title="API reference"
          body="Endpoint contracts, error codes, scopes."
          external
        />
        <ResourceCard
          href="mailto:pierflowllc@gmail.com"
          icon={<FileSignature size={16} />}
          title="Talk to an engineer"
          body="Stuck on something? Email us — we reply within a business day."
        />
      </div>
    </div>
  );
}

function ResourceCard({
  href,
  icon,
  title,
  body,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="group rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors bg-white"
    >
      <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center">
        {icon}
      </span>
      <p className="mt-3 text-[14px] font-medium text-accent-ink">{title}</p>
      <p className="mt-1 text-[12px] text-accent-ink/65 leading-[1.55]">
        {body}
      </p>
    </Link>
  );
}
