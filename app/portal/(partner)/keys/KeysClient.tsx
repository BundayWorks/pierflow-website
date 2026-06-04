"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, KeyRound, AlertCircle } from "lucide-react";
import { createApiKey, revokeApiKey } from "./actions";

type KeyRow = {
  id: string;
  last4: string;
  label: string | null;
  scopes: string[];
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
};

export default function KeysClient({ initialKeys }: { initialKeys: KeyRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{
    raw: string;
    last4: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createApiKey({ label: label.trim() || undefined });
        setCreatedKey({ raw: res.rawKey, last4: res.last4 });
        setLabel("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create key.");
      }
    });
  }

  function handleRevoke(id: string) {
    if (!confirm("Revoke this key? Any service using it will start failing.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await revokeApiKey({ keyId: id });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revoke key.");
      }
    });
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-8">
      {/* Create */}
      <div className="rounded-2xl border border-black/[0.08] p-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium">
          Issue a new key
        </p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. prod, staging, ci)"
            maxLength={60}
            disabled={pending}
            className="flex-1 min-w-[200px] text-[13px] rounded-md border border-black/[0.1] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60 disabled:opacity-50"
          />
          <button
            onClick={handleCreate}
            disabled={pending}
            className="px-4 py-2.5 rounded-md bg-accent-emerald text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Plus size={14} />
            {pending ? "Creating…" : "Create key"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {createdKey ? (
        <div className="rounded-2xl border border-accent-emerald/40 bg-card-mint p-5 space-y-3">
          <p className="text-[13px] font-medium text-accent-emerald">
            Key created — shown once
          </p>
          <div className="flex items-center gap-2 rounded-md border border-accent-emerald/30 bg-white px-3 py-2.5">
            <code className="flex-1 text-[12px] font-mono text-accent-ink break-all">
              {createdKey.raw}
            </code>
            <button
              onClick={copyKey}
              className="text-accent-emerald hover:opacity-70 shrink-0"
              title="Copy"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-accent-emerald/80 leading-[1.6]">
            Copy and store it somewhere safe — Pierflow will never show it
            again. If you lose it, revoke it and issue a new one.
          </p>
          <button
            onClick={() => setCreatedKey(null)}
            className="text-[11px] text-accent-emerald/80 hover:text-accent-emerald"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* List */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium">
          Your keys
        </p>
        {initialKeys.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
            <KeyRound
              size={20}
              className="mx-auto text-accent-ink/35"
            />
            <p className="mt-3 text-[13px] text-accent-ink/55">
              No keys yet. Create one above to start calling the Records API.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {initialKeys.map((k) => {
              const revoked = !!k.revokedAt;
              return (
                <li
                  key={k.id}
                  className={`rounded-xl border p-4 ${
                    revoked
                      ? "border-black/[0.06] bg-bgl-alt"
                      : "border-black/[0.08]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                        revoked
                          ? "bg-black/[0.04] text-accent-ink/35"
                          : "bg-accent-teal-light text-accent-emerald"
                      }`}
                    >
                      <KeyRound size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-medium text-accent-ink">
                          {k.label ?? "Unlabeled key"}
                        </p>
                        <code className="text-[12px] font-mono text-accent-ink/55">
                          pf_test_sk_…{k.last4}
                        </code>
                        {revoked ? (
                          <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
                            Revoked
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-accent-ink/55">
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt
                          ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                          : " · never used"}
                      </p>
                    </div>
                    {!revoked ? (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={pending}
                        className="text-[12px] text-[#a83232] hover:underline disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
