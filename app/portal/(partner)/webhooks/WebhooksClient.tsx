"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Webhook,
  Plus,
  Trash2,
  PlayCircle,
  Copy,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  registerEndpoint,
  setEndpointActive,
  deleteEndpoint,
  sendTestPing,
} from "./actions";

type Endpoint = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
};

const ALL_EVENTS = [
  { value: "processing_job.completed", label: "Job completed" },
  { value: "processing_job.failed", label: "Job failed" },
  { value: "import_package.ready", label: "Package ready" },
];

export default function WebhooksClient({
  initialEndpoints,
  canRegister,
}: {
  initialEndpoints: Endpoint[];
  canRegister: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    ALL_EVENTS.map((e) => e.value),
  );
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<{
    url: string;
    secret: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pingResult, setPingResult] = useState<
    { url: string; ok: boolean; status: number | null; error: string | null }[]
    | null
  >(null);

  function toggleEvent(e: string) {
    setSelectedEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  function handleRegister(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await registerEndpoint({
          url: url.trim(),
          events: selectedEvents,
        });
        setCreatedSecret({ url: res.endpoint.url, secret: res.secret });
        setUrl("");
        setShowForm(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to register.");
      }
    });
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      try {
        await setEndpointActive({ endpointId: id, active });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this endpoint? Any in-flight deliveries to it will stop.")) return;
    startTransition(async () => {
      try {
        await deleteEndpoint({ endpointId: id });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  }

  function handlePing() {
    setPingResult(null);
    startTransition(async () => {
      try {
        const res = await sendTestPing();
        setPingResult(res.deliveries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send ping.");
      }
    });
  }

  async function copySecret() {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      {!canRegister ? (
        <div className="rounded-2xl border border-[#fff4d4] bg-[#fffaee] p-5 flex items-start gap-3">
          <Clock size={18} className="mt-0.5 text-[#7a4a00]" />
          <p className="text-[13px] text-accent-ink/75 leading-[1.6]">
            Webhooks unlock once Pierflow approves your sandbox access.
          </p>
        </div>
      ) : showForm ? (
        <form
          onSubmit={handleRegister}
          className="rounded-2xl border border-black/[0.08] p-5 space-y-4"
        >
          <p className="text-[13px] font-medium text-accent-ink inline-flex items-center gap-2">
            <Plus size={14} className="text-accent-emerald" />
            Register a new endpoint
          </p>
          <label className="block text-[12px] text-accent-ink">
            Endpoint URL
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.yourcompany.com/pierflow/webhooks"
              className="mt-1 w-full text-[13px] font-mono rounded-md border border-black/[0.12] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60"
            />
            <span className="mt-1 block text-[11px] text-accent-ink/55 leading-[1.55]">
              Must be HTTPS. We&apos;ll POST signed JSON payloads here.
            </span>
          </label>
          <div>
            <p className="text-[12px] text-accent-ink mb-2">Events to receive</p>
            <div className="space-y-1.5">
              {ALL_EVENTS.map((e) => (
                <label
                  key={e.value}
                  className="flex items-center gap-2 text-[12px] text-accent-ink cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(e.value)}
                    onChange={() => toggleEvent(e.value)}
                  />
                  <code className="text-[12px] font-mono text-accent-ink">
                    {e.value}
                  </code>
                  <span className="text-accent-ink/55">— {e.label}</span>
                </label>
              ))}
            </div>
          </div>
          {error ? (
            <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          ) : null}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending || selectedEvents.length === 0}
              className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white disabled:opacity-40 hover:opacity-90"
            >
              {pending ? "Creating…" : "Register endpoint"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
            Register a new endpoint
          </p>
          <p className="mt-1 text-[12px] text-accent-ink/55 leading-[1.55]">
            Receive realtime events at an HTTPS endpoint on your servers.
          </p>
        </button>
      )}

      {/* Reveal the new signing secret once */}
      {createdSecret ? (
        <div className="rounded-2xl border border-accent-emerald/40 bg-card-mint p-5 space-y-3">
          <p className="text-[13px] font-medium text-accent-emerald">
            Endpoint registered
          </p>
          <p className="text-[12px] text-accent-ink/75">
            Signing secret — shown once. Store this in your environment, then
            verify the <code>X-Pierflow-Signature</code> header on every
            inbound request.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-accent-emerald/30 bg-white px-3 py-2.5">
            <code className="flex-1 text-[12px] font-mono text-accent-ink break-all">
              {createdSecret.secret}
            </code>
            <button
              onClick={copySecret}
              className="text-accent-emerald hover:opacity-70 shrink-0"
              title="Copy"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <button
            onClick={() => setCreatedSecret(null)}
            className="text-[11px] text-accent-emerald/80 hover:text-accent-emerald"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Endpoints list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium">
            Your endpoints
          </p>
          {canRegister && initialEndpoints.some((e) => e.isActive) ? (
            <button
              onClick={handlePing}
              disabled={pending}
              className="text-[11px] text-accent-emerald hover:underline disabled:opacity-50 inline-flex items-center gap-1"
            >
              <PlayCircle size={12} />
              {pending ? "Sending…" : "Send test ping"}
            </button>
          ) : null}
        </div>
        {initialEndpoints.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
            <Webhook size={20} className="mx-auto text-accent-ink/35" />
            <p className="mt-3 text-[13px] text-accent-ink/55">
              No endpoints yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {initialEndpoints.map((ep) => (
              <li
                key={ep.id}
                className={`rounded-xl border p-4 ${
                  ep.isActive
                    ? "border-black/[0.08]"
                    : "border-black/[0.06] bg-bgl-alt"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                      ep.isActive
                        ? "bg-accent-teal-light text-accent-emerald"
                        : "bg-black/[0.04] text-accent-ink/35"
                    }`}
                  >
                    <Webhook size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <code className="text-[12px] font-mono text-accent-ink break-all">
                      {ep.url}
                    </code>
                    <p className="mt-1 text-[11px] text-accent-ink/55">
                      {ep.events.join(", ")} · added{" "}
                      {new Date(ep.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(ep.id, !ep.isActive)}
                      disabled={pending}
                      className="text-[11px] text-accent-ink/55 hover:text-accent-ink"
                    >
                      {ep.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDelete(ep.id)}
                      disabled={pending}
                      className="text-[#a83232] hover:opacity-70"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Last ping result */}
      {pingResult ? (
        <div className="rounded-2xl border border-black/[0.08] p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium mb-3">
            Last test result
          </p>
          {pingResult.length === 0 ? (
            <p className="text-[12px] text-accent-ink/55">
              No active endpoints to ping.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {pingResult.map((r, i) => (
                <li
                  key={i}
                  className="text-[12px] flex items-center justify-between gap-3"
                >
                  <code className="font-mono text-accent-ink truncate">
                    {r.url}
                  </code>
                  <span
                    className={
                      r.ok
                        ? "text-accent-emerald"
                        : "text-[#7a2222] inline-flex items-center gap-1"
                    }
                  >
                    {r.ok ? `${r.status} OK` : `${r.status ?? "ERR"} ${r.error ?? ""}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}
    </div>
  );
}
