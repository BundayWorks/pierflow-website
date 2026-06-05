"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Trash2,
  Plus,
  Building2,
  ChevronDown,
} from "lucide-react";
import {
  createBatch,
  deleteJob,
  getBatchForCapture,
  listRecentBatches,
} from "./actions";

/* ── Domain types ────────────────────────────────────────────── */

type DocumentType =
  | "AUTO"
  | "OUTPATIENT_CARD"
  | "REGISTRATION"
  | "LAB_RESULT"
  | "PRESCRIPTION"
  | "ANTENATAL"
  | "IMMUNISATION"
  | "DISCHARGE_SUMMARY";

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "AUTO", label: "Auto-detect" },
  { value: "OUTPATIENT_CARD", label: "Outpatient card" },
  { value: "REGISTRATION", label: "Patient registration" },
  { value: "LAB_RESULT", label: "Lab result" },
  { value: "PRESCRIPTION", label: "Prescription" },
  { value: "ANTENATAL", label: "Antenatal" },
  { value: "IMMUNISATION", label: "Immunisation" },
  { value: "DISCHARGE_SUMMARY", label: "Discharge summary" },
];

type CaptureOrg = {
  id: string;
  name: string;
  type: string;
  location: string;
  requestedByPartner: { id: string; name: string } | null;
};

type RecentBatch = {
  id: string;
  label: string | null;
  createdAt: string;
  priority: "NORMAL" | "URGENT";
  pageCount: number;
};

type QueueItem = {
  id: string;
  file?: File;
  previewUrl: string;
  documentType: DocumentType;
  status:
    | "pending"
    | "uploading"
    | "registering"
    | "uploaded"
    | "failed";
  progress: number;
  cloudinaryPublicId?: string;
  jobId?: string;
  errorMessage?: string;
  fromServer?: boolean;
};

const ORG_SELECTION_KEY = "pf:capture:orgId";

/* ── Sign + upload ───────────────────────────────────────────── */

type SignResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
  maxBytes: number;
};

async function fetchSignature(
  organizationId: string,
  batchId: string,
): Promise<SignResponse> {
  const res = await fetch("/v1/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, batchId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sign endpoint failed: ${res.status} ${detail}`);
  }
  return res.json();
}

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  version?: number | string;
};

async function registerIngest(input: {
  organizationId: string;
  batchId: string;
  source: CloudinaryUploadResult;
  filename?: string;
  documentType: DocumentType;
}) {
  const res = await fetch("/v1/ingest/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: input.organizationId,
      batchId: input.batchId,
      filename: input.filename,
      documentType: input.documentType,
      source: {
        publicId: input.source.public_id,
        secureUrl: input.source.secure_url,
        format: input.source.format,
        bytes: input.source.bytes,
        width: input.source.width,
        height: input.source.height,
        version: input.source.version,
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Ingest endpoint failed: ${res.status} ${detail}`);
  }
  return res.json() as Promise<{ job_id: string }>;
}

function uploadToCloudinary(
  file: File,
  sig: SignResponse,
  onProgress: (pct: number) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("folder", sig.folder);
    form.append("type", "upload");
    form.append("signature", sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as CloudinaryUploadResult);
        } else {
          reject(new Error(body?.error?.message ?? `HTTP ${xhr.status}`));
        }
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

/* ── Component ───────────────────────────────────────────────── */

export default function CaptureClient({ orgs }: { orgs: CaptureOrg[] }) {
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [recentBatches, setRecentBatches] = useState<RecentBatch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchLabel, setBatchLabel] = useState("");
  const [defaultDocType, setDefaultDocType] = useState<DocumentType>("AUTO");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  // Hydrate the previously-selected org from localStorage so an
  // operator who reloads the page keeps their context. Validate against
  // the server-supplied org list so a deleted/deactivated org doesn't
  // get auto-selected.
  useEffect(() => {
    if (orgs.length === 0) return;
    let chosen: string | null = null;
    try {
      const saved = localStorage.getItem(ORG_SELECTION_KEY);
      if (saved && orgs.some((o) => o.id === saved)) chosen = saved;
    } catch {}
    setActiveOrgId(chosen ?? orgs[0].id);
  }, [orgs]);

  const activeOrg = useMemo(
    () => orgs.find((o) => o.id === activeOrgId) ?? null,
    [orgs, activeOrgId],
  );

  // Refresh the recent-batches list every time we switch org.
  useEffect(() => {
    if (!activeOrgId) {
      setRecentBatches([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await listRecentBatches(activeOrgId);
      if (cancelled) return;
      setRecentBatches(
        rows.map((r) => ({
          id: r.id,
          label: r.label,
          createdAt: r.createdAt.toISOString(),
          priority: r.priority,
          pageCount: r._count.jobs,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId]);

  function selectOrg(orgId: string) {
    setActiveOrgId(orgId);
    setOrgPickerOpen(false);
    setActiveBatchId(null);
    setQueue([]);
    try {
      localStorage.setItem(ORG_SELECTION_KEY, orgId);
    } catch {}
  }

  const activeBatch = useMemo(
    () => recentBatches.find((b) => b.id === activeBatchId) ?? null,
    [recentBatches, activeBatchId],
  );

  // Hydrate the queue with the jobs already registered against this batch
  // so the operator sees existing pages after a refresh / resume.
  useEffect(() => {
    if (!activeBatchId) return;
    let cancelled = false;
    void (async () => {
      const batch = await getBatchForCapture(activeBatchId);
      if (cancelled || !batch) return;
      const hydrated: QueueItem[] = batch.jobs.map((j) => {
        const src = (j.sourceAsset ?? {}) as {
          publicId?: string;
          secureUrl?: string;
        };
        return {
          id: j.id,
          previewUrl: src.secureUrl ?? "",
          documentType: (j.recordTypeHint ?? "AUTO") as DocumentType,
          status: "uploaded",
          progress: 100,
          cloudinaryPublicId: src.publicId,
          jobId: j.id,
          fromServer: true,
        };
      });
      setQueue((q) => {
        const seenJobIds = new Set(q.map((x) => x.jobId).filter(Boolean));
        const fresh = hydrated.filter((h) => !seenJobIds.has(h.jobId));
        return [...q, ...fresh];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBatchId]);

  const uploadedCount = queue.filter((q) => q.status === "uploaded").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;
  const inflightCount = queue.filter(
    (q) => q.status === "uploading" || q.status === "registering",
  ).length;

  const startBatch = () => {
    if (!activeOrgId) return;
    startTransition(async () => {
      const { batchId } = await createBatch({
        organizationId: activeOrgId,
        label: batchLabel.trim() || undefined,
      });
      setActiveBatchId(batchId);
    });
  };

  const uploadOne = useCallback(
    async (item: QueueItem) => {
      if (!activeOrgId || !activeBatchId || !item.file) return;
      const file = item.file;

      setQueue((q) =>
        q.map((x) =>
          x.id === item.id ? { ...x, status: "uploading", progress: 0 } : x,
        ),
      );

      try {
        const sig = await fetchSignature(activeOrgId, activeBatchId);
        const out = await uploadToCloudinary(file, sig, (pct) => {
          setQueue((q) =>
            q.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)),
          );
        });

        setQueue((q) =>
          q.map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  status: "registering",
                  progress: 100,
                  cloudinaryPublicId: out.public_id,
                }
              : x,
          ),
        );

        const reg = await registerIngest({
          organizationId: activeOrgId,
          batchId: activeBatchId,
          source: out,
          filename: file.name,
          documentType: item.documentType,
        });

        setQueue((q) =>
          q.map((x) =>
            x.id === item.id
              ? { ...x, status: "uploaded", jobId: reg.job_id }
              : x,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setQueue((q) =>
          q.map((x) =>
            x.id === item.id
              ? { ...x, status: "failed", errorMessage: message }
              : x,
          ),
        );
      }
    },
    [activeOrgId, activeBatchId],
  );

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || !activeBatchId) return;

      const newItems: QueueItem[] = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        documentType: defaultDocType,
        status: "pending",
        progress: 0,
      }));

      setQueue((q) => [...newItems.reverse(), ...q]);

      newItems.forEach((item) => {
        void uploadOne(item);
      });
    },
    [activeBatchId, defaultDocType, uploadOne],
  );

  const retry = (item: QueueItem) => void uploadOne(item);

  const remove = useCallback(async (id: string) => {
    let dropped: QueueItem | undefined;
    setQueue((q) => {
      dropped = q.find((x) => x.id === id);
      if (dropped?.file && dropped.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(dropped.previewUrl);
      }
      return q.filter((x) => x.id !== id);
    });

    if (dropped?.jobId) {
      try {
        await deleteJob(dropped.jobId);
      } catch {
        if (dropped) {
          const restored = dropped;
          setQueue((q) => [restored, ...q]);
          window.alert(
            "Couldn't remove this page right now. Please try again.",
          );
        }
      }
    }
  }, []);

  /* ── Render ─────────────────────────────────────────────────── */

  // Whatever step we're on, the org picker is always the top thing.
  const OrgPicker = (
    <div className="mt-10">
      <div className="rounded-2xl border border-black/[0.08] p-4">
        <button
          type="button"
          onClick={() => setOrgPickerOpen((v) => !v)}
          className="w-full flex items-center gap-3 text-left"
        >
          <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
            <Building2 size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium">
              Capturing for
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-accent-ink truncate">
              {activeOrg?.name ?? "—"}
            </p>
            {activeOrg ? (
              <p className="text-[12px] text-accent-ink/55 truncate">
                {activeOrg.type.replace(/_/g, " ").toLowerCase()}
                {activeOrg.location ? ` · ${activeOrg.location}` : ""}
                {activeOrg.requestedByPartner
                  ? ` · for ${activeOrg.requestedByPartner.name}`
                  : ""}
              </p>
            ) : null}
          </div>
          <ChevronDown
            size={16}
            className={`text-accent-ink/45 transition-transform ${orgPickerOpen ? "rotate-180" : ""}`}
          />
        </button>

        {orgPickerOpen ? (
          <ul className="mt-4 -mx-1 max-h-[280px] overflow-y-auto">
            {orgs.map((o) => {
              const selected = o.id === activeOrgId;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => selectOrg(o.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 hover:bg-black/[0.03] flex items-start gap-3 ${
                      selected ? "bg-bgl-alt" : ""
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-accent-emerald mt-2 shrink-0 opacity-0 group-data-[selected]:opacity-100" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-accent-ink truncate">
                        {o.name}
                      </p>
                      <p className="text-[11px] text-accent-ink/55 truncate">
                        {o.type.replace(/_/g, " ").toLowerCase()}
                        {o.location ? ` · ${o.location}` : ""}
                        {o.requestedByPartner
                          ? ` · for ${o.requestedByPartner.name}`
                          : ""}
                      </p>
                    </div>
                    {selected ? (
                      <CheckCircle2
                        size={14}
                        className="text-accent-emerald mt-0.5 shrink-0"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );

  // Step 1: pick or create a batch (within the selected org)
  if (!activeBatchId) {
    return (
      <div>
        {OrgPicker}
        <div className="mt-8 max-w-[640px]">
          <div className="rounded-2xl border border-black/[0.08] p-6">
            <h2 className="font-display text-[20px] text-accent-ink font-medium">
              Start a capture batch
            </h2>
            <p className="mt-2 text-[14px] text-accent-ink/65">
              A batch groups a set of pages from one operator session — e.g.
              &quot;Ward A — June&quot;. You can resume an existing batch below.
            </p>
            <div className="mt-5 space-y-3">
              <label className="block text-[12px] font-medium text-accent-ink/65">
                Batch label (optional)
              </label>
              <input
                type="text"
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                placeholder="e.g. Ward A — June"
                className="w-full rounded-lg border border-black/[0.1] px-3 py-2.5 text-[14px] focus:outline-none focus:border-accent-emerald"
                maxLength={120}
              />
              <button
                type="button"
                onClick={startBatch}
                disabled={isPending || !activeOrgId}
                className="inline-flex items-center gap-2 text-[14px] font-medium px-4 py-2.5 rounded-full bg-accent-ink text-white hover:opacity-95 disabled:opacity-50"
              >
                <Plus size={14} />
                {isPending ? "Creating…" : "Start new batch"}
              </button>
            </div>
          </div>

          {recentBatches.length > 0 && (
            <div className="mt-8">
              <p className="text-[12px] uppercase tracking-[0.16em] text-accent-ink/55 font-medium mb-3">
                Recent batches for {activeOrg?.name}
              </p>
              <ul className="space-y-2">
                {recentBatches.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setActiveBatchId(b.id)}
                      className="w-full text-left rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-[14px] font-medium text-accent-ink">
                          {b.label ?? "Untitled batch"}
                        </p>
                        <p className="text-[12px] text-accent-ink/55 mt-0.5">
                          {new Date(b.createdAt).toLocaleString()} ·{" "}
                          {b.pageCount} page{b.pageCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="text-[12px] text-accent-emerald">
                        Resume →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: capture loop
  return (
    <div>
      {OrgPicker}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
              Active batch
            </p>
            <h2 className="mt-1 font-display text-[20px] text-accent-ink font-medium">
              {activeBatch?.label ?? batchLabel.trim() ?? "Untitled batch"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveBatchId(null)}
            className="text-[13px] text-accent-ink/55 hover:text-accent-ink"
          >
            ← Change batch
          </button>
        </div>

        {/* Capture trigger card */}
        <div className="rounded-2xl border border-black/[0.08] p-6 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[12px] font-medium text-accent-ink/65 mb-1.5">
                Document type for next captures
              </label>
              <select
                value={defaultDocType}
                onChange={(e) =>
                  setDefaultDocType(e.target.value as DocumentType)
                }
                className="w-full rounded-lg border border-black/[0.1] px-3 py-2.5 text-[14px] bg-white focus:outline-none focus:border-accent-emerald"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 text-[14px] font-medium px-5 py-3 rounded-full bg-accent-ink text-white hover:opacity-95"
            >
              <Camera size={16} />
              Capture page
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Uploaded" value={uploadedCount} tone="ok" />
          <Stat label="In flight" value={inflightCount} tone="active" />
          <Stat label="Failed" value={failedCount} tone="warn" />
        </div>

        {/* Queue */}
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/[0.12] p-10 text-center text-accent-ink/55 text-[14px]">
            No pages captured yet. Tap <strong>Capture page</strong> to begin.
          </div>
        ) : (
          <ul className="space-y-3">
            {queue.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-black/[0.08] p-3 flex items-center gap-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt="capture preview"
                  className="w-16 h-16 rounded-md object-cover bg-bgl-alt shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <p className="text-[13px] text-accent-ink truncate">
                      {item.documentType === "AUTO"
                        ? "Auto-classified"
                        : DOCUMENT_TYPES.find(
                            (t) => t.value === item.documentType,
                          )?.label}
                    </p>
                  </div>
                  {item.status === "uploading" && (
                    <div className="mt-2 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-accent-emerald transition-[width]"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === "failed" && item.errorMessage && (
                    <p className="mt-1 text-[12px] text-[#a83232]">
                      {item.errorMessage}
                    </p>
                  )}
                  {item.status === "uploaded" && item.cloudinaryPublicId && (
                    <p className="mt-1 text-[11px] font-mono text-accent-ink/45 truncate">
                      {item.cloudinaryPublicId}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => retry(item)}
                      className="text-[12px] text-accent-emerald hover:underline"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(item.id)}
                    disabled={
                      item.status === "uploading" ||
                      item.status === "registering"
                    }
                    className="text-accent-ink/40 hover:text-accent-ink disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remove"
                    title="Remove from batch"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── Bits ────────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "active" | "warn";
}) {
  const palette = {
    ok: "text-accent-emerald bg-accent-teal-light",
    active: "text-[#1f6f99] bg-card-sky",
    warn: "text-[#a83232] bg-[#fde6e6]",
  }[tone];
  return (
    <div className={`rounded-xl ${palette} px-4 py-3`}>
      <p className="text-[11px] uppercase tracking-[0.14em] opacity-80">
        {label}
      </p>
      <p className="mt-1 font-display text-[22px] font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: QueueItem["status"] }) {
  if (status === "uploaded")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-accent-emerald font-medium">
        <CheckCircle2 size={12} />
        Uploaded
      </span>
    );
  if (status === "uploading")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#1f6f99] font-medium">
        <Loader2 size={12} className="animate-spin" />
        Uploading
      </span>
    );
  if (status === "registering")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#1f6f99] font-medium">
        <Loader2 size={12} className="animate-spin" />
        Registering
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#a83232] font-medium">
        <AlertCircle size={12} />
        Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-accent-ink/55">
      Queued
    </span>
  );
}
