"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Plus,
  KeyRound,
  AlertCircle,
  Clock,
} from "lucide-react";
import { createApiKey, revokeApiKey } from "./actions";

type KeyRow = {
  id: string;
  last4: string;
  label: string | null;
  scopes: string[];
  env: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
};

type AccessStatus =
  | "PENDING_SANDBOX"
  | "SANDBOX"
  | "PRODUCTION_REQUESTED"
  | "PRODUCTION"
  | "SUSPENDED";

/**
 * Human-friendly label + tone for a scope value. Falls back to the
 * raw value if the scope isn't one we know about — better to render
 * a literal "foo:bar" than to silently drop it.
 */
function scopeMeta(scope: string): { label: string; tone: ScopeTone } {
  switch (scope) {
    case "records:read":
      return { label: "Records read", tone: "records" };
    case "records:write":
      return { label: "Records write", tone: "records" };
    case "insurance:read":
      return { label: "Insurance read", tone: "insurance" };
    case "insurance:write":
      return { label: "Insurance write", tone: "insurance" };
    default:
      return { label: scope, tone: "neutral" };
  }
}

type ScopeTone = "records" | "insurance" | "neutral";

function ScopeChip({ scope }: { scope: string }) {
  const { label, tone } = scopeMeta(scope);
  const classes =
    tone === "insurance"
      ? "bg-card-mint text-accent-emerald"
      : tone === "records"
        ? "bg-[#eef2ff] text-[#3949ab]"
        : "bg-black/[0.05] text-accent-ink/65";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full ${classes}`}
      title={scope}
    >
      <code className="font-mono normal-case tracking-normal">{scope}</code>
      <span className="opacity-70">— {label}</span>
    </span>
  );
}

function EnvChip({ env }: { env: string }) {
  const isLive = env === "live";
  const classes = isLive
    ? "bg-[#fde6e6] text-[#a83232]"
    : "bg-[#fff4d4] text-[#7a4a00]";
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full ${classes}`}
      title={
        isLive
          ? "Live key — production access approved"
          : "Sandbox / test key"
      }
    >
      {isLive ? "Live" : "Sandbox"}
    </span>
  );
}

/** Formats a relative recency string for "last used" timestamps. */
function formatLastUsed(d: Date | null): string {
  if (!d) return "never used";
  const date = new Date(d);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "last used just now";
  if (diffMin < 60) return `last used ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `last used ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `last used ${diffDay}d ago`;
  return `last used ${date.toLocaleDateString()}`;
}

export default function KeysClient({
  initialKeys,
  canCreate,
  accessStatus,
}: {
  initialKeys: KeyRow[];
  canCreate: boolean;
  accessStatus: AccessStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{
    raw: string;
    last4: string;
    scopes: string[];
    env: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createApiKey({ label: label.trim() || undefined });
        setCreatedKey({
          raw: res.rawKey,
          last4: res.last4,
          scopes: res.scopes,
          env: res.env,
        });
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
      {/* Create or locked notice */}
      {canCreate ? (
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
      ) : (
        <LockedNotice accessStatus={accessStatus} />
      )}

      {error ? (
        <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {createdKey ? (
        <div className="rounded-2xl border border-accent-emerald/40 bg-card-mint p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium text-accent-emerald">
              Key created — shown once
            </p>
            <EnvChip env={createdKey.env} />
          </div>
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
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-emerald/80 font-medium mb-1.5">
              Scopes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {createdKey.scopes.length === 0 ? (
                <span className="text-[11px] text-accent-emerald/70">
                  No explicit scopes (legacy — treated as all scopes).
                </span>
              ) : (
                createdKey.scopes.map((s) => <ScopeChip key={s} scope={s} />)
              )}
            </div>
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
                  <div className="flex items-start gap-4">
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
                          pf_{k.env}_sk_…{k.last4}
                        </code>
                        <EnvChip env={k.env} />
                        {revoked ? (
                          <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
                            Revoked
                          </span>
                        ) : null}
                      </div>
                      {k.scopes.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {k.scopes.map((s) => (
                            <ScopeChip key={s} scope={s} />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.05] text-accent-ink/55">
                            Legacy — all scopes
                          </span>
                        </div>
                      )}
                      <p className="mt-1.5 text-[11px] text-accent-ink/55">
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {" · "}
                        {formatLastUsed(k.lastUsedAt)}
                        {k.revokedAt
                          ? ` · revoked ${new Date(k.revokedAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    {!revoked ? (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={pending}
                        className="text-[12px] text-[#a83232] hover:underline disabled:opacity-50 shrink-0 mt-1"
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

function LockedNotice({ accessStatus }: { accessStatus: AccessStatus }) {
  if (accessStatus === "SUSPENDED") {
    return (
      <div className="rounded-2xl border border-[#a83232]/30 bg-[#fde6e6] p-5 flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 text-[#a83232]" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[#7a2222]">
            Account suspended
          </p>
          <p className="mt-1 text-[12px] text-[#7a2222]/85 leading-[1.6]">
            Your account is currently paused, so no new keys can be issued.
            See your{" "}
            <Link href="/portal/overview" className="underline">
              overview
            </Link>{" "}
            for details, or reach out to{" "}
            <a
              href="mailto:pierflowllc@gmail.com"
              className="underline"
            >
              pierflowllc@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[#fff4d4] bg-[#fffaee] p-5 flex items-start gap-3">
      <Clock size={18} className="mt-0.5 text-[#7a4a00]" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-accent-ink">
          API keys unlock once your sandbox is approved
        </p>
        <p className="mt-1 text-[12px] text-accent-ink/65 leading-[1.6]">
          Our team is reviewing your account — usually within one business
          day. Once we approve you for sandbox access, your first key will
          appear here automatically and you&apos;ll be able to issue more
          from this page. In the meantime, you can finish the rest of your{" "}
          <Link
            href="/portal/overview"
            className="text-accent-emerald hover:underline"
          >
            onboarding checklist
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
