"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Key,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  createPartner,
  issuePartnerApiKey,
  revokePartnerApiKey,
} from "./actions";

type PartnerView = {
  id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  keys: {
    id: string;
    label: string | null;
    last4: string;
    createdAt: string;
    lastUsedAt: string | null;
  }[];
};

const PARTNER_TYPES = [
  { value: "EMR_VENDOR", label: "EMR vendor" },
  { value: "HMS_VENDOR", label: "HMS vendor" },
  { value: "EHR_VENDOR", label: "EHR vendor" },
  { value: "INSURER", label: "Insurer / HMO" },
  { value: "GOVERNMENT", label: "Government programme" },
  { value: "ANALYTICS", label: "Analytics" },
  { value: "OTHER", label: "Other" },
];

export default function SettingsClient({
  partners,
}: {
  partners: PartnerView[];
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState(PARTNER_TYPES[0].value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The raw key is shown ONCE after creation. We keep it in component
  // state so a page reload safely loses it.
  const [revealedKey, setRevealedKey] = useState<{
    partnerName: string;
    raw: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreatePartner = () =>
    startTransition(async () => {
      setError(null);
      if (name.trim().length < 2) {
        setError("Partner name must be at least 2 characters.");
        return;
      }
      try {
        await createPartner({ name: name.trim(), type: type as never });
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create partner.");
      }
    });

  const handleIssueKey = (partner: PartnerView, label?: string) =>
    startTransition(async () => {
      setError(null);
      try {
        const { rawKey } = await issuePartnerApiKey({
          partnerId: partner.id,
          label,
        });
        setRevealedKey({ partnerName: partner.name, raw: rawKey });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to issue key.");
      }
    });

  const handleRevoke = (apiKeyId: string) =>
    startTransition(async () => {
      setError(null);
      try {
        await revokePartnerApiKey(apiKeyId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revoke key.");
      }
    });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-10 space-y-10">
      {/* Reveal modal */}
      {revealedKey && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-[520px] bg-white rounded-2xl border border-black/[0.08] shadow-[0_20px_60px_-20px_rgba(10,31,27,0.25)] p-6">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                <Key size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-[18px] text-accent-ink font-medium">
                  API key issued for {revealedKey.partnerName}
                </h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-accent-ink/65">
                  Copy this now. It will not be shown again — Pierflow only
                  stores the hash.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-black/[0.08] bg-bgl-alt p-3 flex items-center gap-2">
              <code className="font-mono text-[13px] break-all flex-1 text-accent-ink">
                {revealedKey.raw}
              </code>
              <button
                type="button"
                onClick={() => copy(revealedKey.raw)}
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border border-black/[0.1] hover:bg-white"
              >
                {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRevealedKey(null);
                  setCopied(false);
                }}
                className="text-[13px] font-medium px-4 py-2 rounded-full bg-accent-ink text-white"
              >
                I&apos;ve copied it — close
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#a83232]/30 bg-[#fde6e6] p-3 text-[13px] text-[#a83232] flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Create partner */}
      <div className="rounded-2xl border border-black/[0.08] p-6">
        <h2 className="font-display text-[20px] text-accent-ink font-medium">
          Add a partner
        </h2>
        <p className="mt-1 text-[13px] text-accent-ink/65">
          Each partner can hold one or more API keys.
        </p>
        <div className="mt-5 grid sm:grid-cols-[1fr_180px_auto] gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme EMR"
            className="rounded-lg border border-black/[0.1] px-3 py-2 text-[14px] focus:outline-none focus:border-accent-emerald"
            maxLength={120}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-black/[0.1] px-3 py-2 text-[14px] bg-white focus:outline-none focus:border-accent-emerald"
          >
            {PARTNER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreatePartner}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full bg-accent-ink text-white hover:opacity-95 disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Partner list */}
      <div>
        <h2 className="font-display text-[20px] text-accent-ink font-medium mb-3">
          Linked partners
        </h2>
        {partners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[0.12] p-8 text-center text-[13px] text-accent-ink/55">
            No partners yet. Add one above to issue an API key.
          </div>
        ) : (
          <ul className="space-y-4">
            {partners.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-black/[0.08] p-5"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[15px] font-medium text-accent-ink">
                      {p.name}
                    </p>
                    <p className="text-[12px] text-accent-ink/55">
                      {p.type.replace(/_/g, " ").toLowerCase()} · {p.slug}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleIssueKey(p)}
                    disabled={pending}
                    className="inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-full border border-black/[0.1] text-accent-ink hover:bg-bgl-alt disabled:opacity-50"
                  >
                    <Key size={13} />
                    Issue API key
                  </button>
                </div>
                {p.keys.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {p.keys.map((k) => (
                      <li
                        key={k.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.06] bg-bgl-alt/40 px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-accent-ink font-mono truncate">
                            pf_test_sk_…{k.last4}
                          </p>
                          <p className="text-[10px] text-accent-ink/55">
                            {k.label ? `${k.label} · ` : ""}
                            issued {new Date(k.createdAt).toLocaleDateString()}
                            {k.lastUsedAt
                              ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevoke(k.id)}
                          disabled={pending}
                          className="text-accent-ink/40 hover:text-[#a83232] disabled:opacity-50"
                          aria-label="Revoke"
                          title="Revoke"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer hint */}
      <div className="rounded-xl border border-black/[0.08] bg-bgl-alt/40 p-4 text-[12px] text-accent-ink/65 leading-[1.6]">
        Test the API with curl:
        <pre className="mt-2 font-mono text-[11px] bg-white border border-black/[0.06] rounded p-2 overflow-x-auto">
          curl -H &quot;Authorization: Bearer pf_test_sk_…&quot;
          http://localhost:3000/v1/organizations
        </pre>
      </div>
    </div>
  );
}
