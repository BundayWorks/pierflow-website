"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { registerOrganization } from "./actions";

type Org = {
  id: string;
  name: string;
  type: string;
  country: string | null;
  lga: string | null;
  state: string | null;
  mrnSystem: string | null;
  accessStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
};

type AccessStatus =
  | "PENDING_SANDBOX"
  | "SANDBOX"
  | "PRODUCTION_REQUESTED"
  | "PRODUCTION"
  | "SUSPENDED";

const ORG_TYPES = [
  { value: "HOSPITAL", label: "Hospital" },
  { value: "CLINIC", label: "Clinic" },
  { value: "LAB", label: "Laboratory" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "INSURER", label: "Insurer / HMO" },
  { value: "GOVERNMENT", label: "Government / NGO" },
  { value: "COOPERATIVE", label: "Cooperative" },
  { value: "OTHER", label: "Other" },
];

export default function OrganizationsClient({
  initialOrgs,
  canRegister,
  accessStatus,
}: {
  initialOrgs: Org[];
  canRegister: boolean;
  accessStatus: AccessStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("HOSPITAL");
  const [country] = useState("NG");
  const [stateField, setStateField] = useState("");
  const [lga, setLga] = useState("");
  const [mrnSystem, setMrnSystem] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setType("HOSPITAL");
    setStateField("");
    setLga("");
    setMrnSystem("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await registerOrganization({
          name: name.trim(),
          type: type as Parameters<typeof registerOrganization>[0]["type"],
          country,
          state: stateField.trim() || undefined,
          lga: lga.trim() || undefined,
          mrnSystem: mrnSystem.trim() || undefined,
        });
        reset();
        setShowForm(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to register.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {canRegister ? (
        showForm ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-black/[0.08] p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-[13px] font-medium text-accent-ink">
              <Plus size={14} className="text-accent-emerald" />
              Register a new organization
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-[12px] text-accent-ink">
                Organization name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lagoon Hospital"
                  maxLength={160}
                  className="mt-1 w-full text-[13px] rounded-md border border-black/[0.12] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60"
                />
              </label>
              <label className="text-[12px] text-accent-ink">
                Type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full text-[13px] rounded-md border border-black/[0.12] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60"
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-accent-ink">
                State
                <input
                  value={stateField}
                  onChange={(e) => setStateField(e.target.value)}
                  placeholder="e.g. Lagos"
                  maxLength={120}
                  className="mt-1 w-full text-[13px] rounded-md border border-black/[0.12] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60"
                />
              </label>
              <label className="text-[12px] text-accent-ink">
                LGA
                <input
                  value={lga}
                  onChange={(e) => setLga(e.target.value)}
                  placeholder="e.g. Lagos Mainland"
                  maxLength={120}
                  className="mt-1 w-full text-[13px] rounded-md border border-black/[0.12] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60"
                />
              </label>
            </div>

            <label className="block text-[12px] text-accent-ink">
              MRN system URI (optional)
              <input
                value={mrnSystem}
                onChange={(e) => setMrnSystem(e.target.value)}
                placeholder="https://yourdomain.com/mrn/"
                maxLength={300}
                className="mt-1 w-full text-[13px] font-mono rounded-md border border-black/[0.12] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60"
              />
              <span className="mt-1 block text-[11px] text-accent-ink/55 leading-[1.55]">
                Patient identifier system this organization uses internally —
                we&apos;ll namespace MRN identifiers under this prefix when we
                emit FHIR. Leave blank if you don&apos;t have one yet; you can
                add it later.
              </span>
            </label>

            {error ? (
              <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
              >
                {pending ? "Submitting…" : "Submit for review"}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setShowForm(false);
                }}
                disabled={pending}
                className="text-[12px] text-accent-ink/55 hover:text-accent-ink px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-2xl border-2 border-dashed border-black/[0.12] hover:border-accent-emerald/40 hover:bg-card-mint/40 transition-colors p-5 text-left"
          >
            <p className="text-[13px] font-medium text-accent-ink inline-flex items-center gap-2">
              <Plus size={14} className="text-accent-emerald" />
              Register a new organization
            </p>
            <p className="mt-1 text-[12px] text-accent-ink/55 leading-[1.55]">
              Add a hospital, clinic, lab, or program you want to ingest
              records for. Pierflow reviews each one before enabling capture
              + ingest.
            </p>
          </button>
        )
      ) : (
        <LockedNotice accessStatus={accessStatus} />
      )}

      {initialOrgs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <Building2 size={20} className="mx-auto text-accent-ink/35" />
          <p className="mt-3 text-[13px] text-accent-ink/55">
            No organizations yet. Register one above to start.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initialOrgs.map((o) => (
            <li
              key={o.id}
              className="rounded-xl border border-black/[0.08] p-4"
            >
              <div className="flex items-center gap-4">
                <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                  <Building2 size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-medium text-accent-ink truncate">
                      {o.name}
                    </p>
                    <OrgChip status={o.accessStatus} />
                    <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium">
                      {o.type.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-accent-ink/55">
                    {[o.lga, o.state, o.country].filter(Boolean).join(", ") ||
                      "—"}{" "}
                    · added{" "}
                    {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                  {o.mrnSystem ? (
                    <p className="mt-1 text-[11px] font-mono text-accent-ink/55 truncate">
                      MRN: {o.mrnSystem}
                    </p>
                  ) : null}
                  {o.accessStatus === "REJECTED" && o.rejectionReason ? (
                    <p className="mt-2 text-[12px] text-[#7a2222] leading-[1.6]">
                      Reviewer note: {o.rejectionReason}
                    </p>
                  ) : null}
                </div>
                <code className="text-[11px] font-mono text-accent-ink/45 shrink-0">
                  {o.id}
                </code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrgChip({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} /> Active
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} /> Pending review
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <XCircle size={10} /> Rejected
      </span>
    );
  }
  if (status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <AlertCircle size={10} /> Suspended
      </span>
    );
  }
  return null;
}

function LockedNotice({ accessStatus }: { accessStatus: AccessStatus }) {
  const message =
    accessStatus === "SUSPENDED"
      ? "Your account is suspended, so new organizations can't be registered. Reach out to pierflowllc@gmail.com if you think this is in error."
      : "You can register customer organizations once Pierflow approves your sandbox access — usually within one business day of sign-up.";
  return (
    <div className="rounded-2xl border border-[#fff4d4] bg-[#fffaee] p-5 flex items-start gap-3">
      <Clock size={18} className="mt-0.5 text-[#7a4a00]" />
      <p className="text-[13px] text-accent-ink/75 leading-[1.6]">{message}</p>
    </div>
  );
}
