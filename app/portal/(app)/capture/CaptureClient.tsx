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
  Folder,
  FolderOpen,
  UserPlus,
  RotateCcw,
} from "lucide-react";
import {
  createBatch,
  deleteJob,
  getBatchForCapture,
  listRecentBatches,
  startChartFolder,
  closeChartFolder,
  reopenChartFolder,
  resolveChartFolderNow,
  listBatchChartFolders,
  searchPatientsForChart,
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
  chartFolderId?: string;
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
      chartFolderId: input.chartFolderId,
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

type PatientHit = {
  id: string;
  fullName: string;
  dateOfBirth: Date | null;
  identifiers: { system: string; value: string }[];
};

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

  // ── Chart folder state ───────────────────────────────────────
  // activeChartFolderId is set while an operator is photographing a
  // chart. When null, captured pages go straight into the batch with
  // no folder (legacy single-page behaviour).
  const [activeChartFolderId, setActiveChartFolderId] = useState<string | null>(
    null,
  );
  const [chartLabel, setChartLabel] = useState("");
  const [chartMrn, setChartMrn] = useState("");
  const [pickedPatient, setPickedPatient] = useState<PatientHit | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientHits, setPatientHits] = useState<PatientHit[]>([]);
  const [chartPageCount, setChartPageCount] = useState(0);
  const [batchCharts, setBatchCharts] = useState<
    Awaited<ReturnType<typeof listBatchChartFolders>>
  >([]);

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
    setActiveChartFolderId(null);
    resetChartInputs();
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

  // ── Chart folder handlers ────────────────────────────────────
  // Debounced patient search runs while the operator types in the
  // "Pick existing patient" search box.
  useEffect(() => {
    if (!activeOrgId) return;
    const q = patientSearch.trim();
    if (q.length < 2) {
      setPatientHits([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const rows = await searchPatientsForChart({
          organizationId: activeOrgId,
          query: q,
        });
        setPatientHits(rows);
      } catch {
        setPatientHits([]);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [patientSearch, activeOrgId]);

  function resetChartInputs() {
    setChartLabel("");
    setChartMrn("");
    setPickedPatient(null);
    setPatientSearch("");
    setPatientHits([]);
    setChartPageCount(0);
  }

  // Reload the batch's charts (open + closed) when the batch changes
  // and after every chart action so the list of "previous charts" stays
  // fresh without a full page refresh.
  const refreshBatchCharts = useCallback(async () => {
    if (!activeBatchId) {
      setBatchCharts([]);
      return;
    }
    try {
      const rows = await listBatchChartFolders(activeBatchId);
      setBatchCharts(rows);
    } catch {
      setBatchCharts([]);
    }
  }, [activeBatchId]);

  useEffect(() => {
    void refreshBatchCharts();
  }, [refreshBatchCharts]);

  const startChart = () => {
    if (!activeBatchId) return;
    startTransition(async () => {
      try {
        const { chartFolderId } = await startChartFolder({
          batchId: activeBatchId,
          declaredPatientId: pickedPatient?.id,
          declaredMrn: chartMrn.trim() || undefined,
          label:
            chartLabel.trim() ||
            pickedPatient?.fullName ||
            (chartMrn.trim() ? `MRN ${chartMrn.trim()}` : undefined) ||
            undefined,
        });
        setActiveChartFolderId(chartFolderId);
        setChartPageCount(0);
        await refreshBatchCharts();
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Couldn't start chart.",
        );
      }
    });
  };

  const finishChart = () => {
    const id = activeChartFolderId;
    if (!id) return;
    setActiveChartFolderId(null);
    resetChartInputs();
    void closeChartFolder(id)
      .then(() => refreshBatchCharts())
      .catch(() => {});
  };

  const reopenChart = (id: string, hint: { label?: string | null; pageCount: number }) => {
    startTransition(async () => {
      try {
        await reopenChartFolder(id);
        setActiveChartFolderId(id);
        setChartPageCount(hint.pageCount);
        setChartLabel(hint.label ?? "");
        await refreshBatchCharts();
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Couldn't reopen chart.",
        );
      }
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
          chartFolderId: activeChartFolderId ?? undefined,
          source: out,
          filename: file.name,
          documentType: item.documentType,
        });
        if (activeChartFolderId) setChartPageCount((n) => n + 1);

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
    [activeOrgId, activeBatchId, activeChartFolderId],
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
            onClick={() => {
              setActiveBatchId(null);
              setActiveChartFolderId(null);
              resetChartInputs();
            }}
            className="text-[13px] text-accent-ink/55 hover:text-accent-ink"
          >
            ← Change batch
          </button>
        </div>

        {/* Chart folder panel — declare whose chart we're on so all
            pages photographed from this point land on the same Patient
            after extraction. */}
        {activeChartFolderId ? (
          <div className="rounded-2xl border border-accent-emerald/40 bg-card-mint p-5 mb-6">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-accent-emerald/15 text-accent-emerald grid place-items-center shrink-0">
                <FolderOpen size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] uppercase tracking-[0.14em] text-accent-emerald font-medium">
                  Active chart
                </p>
                <p className="mt-1 text-[15px] font-medium text-accent-ink truncate">
                  {pickedPatient?.fullName ??
                    chartLabel.trim() ??
                    (chartMrn.trim() ? `MRN ${chartMrn.trim()}` : "Unnamed chart")}
                </p>
                <p className="mt-1 text-[12px] text-accent-ink/65">
                  {chartPageCount} page{chartPageCount === 1 ? "" : "s"} captured so far. New
                  captures will be attached to this chart.
                </p>
              </div>
              <button
                type="button"
                onClick={finishChart}
                disabled={isPending}
                className="text-[12px] font-medium px-3 py-2 rounded-md border border-black/[0.12] text-accent-ink hover:border-black/30 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                Finish chart
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/[0.08] p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl bg-bgl-alt text-accent-ink/55 grid place-items-center shrink-0">
                <Folder size={16} />
              </span>
              <div>
                <p className="text-[13px] font-medium text-accent-ink">
                  Start a new chart
                </p>
                <p className="text-[11.5px] text-accent-ink/55 leading-[1.45]">
                  Group every page from one patient&apos;s chart together. Pick
                  an existing patient, type their MRN, or just start — we&apos;ll
                  match identity after extraction.
                </p>
              </div>
            </div>

            {pickedPatient ? (
              <div className="flex items-center gap-2 rounded-md border border-accent-emerald/30 bg-card-mint px-3 py-2 mb-3">
                <UserPlus size={13} className="text-accent-emerald" />
                <span className="flex-1 text-[12.5px] text-accent-ink truncate">
                  {pickedPatient.fullName}
                  {pickedPatient.identifiers[0] ? (
                    <span className="text-[11px] text-accent-ink/55 ml-1.5">
                      · {pickedPatient.identifiers[0].value}
                    </span>
                  ) : null}
                </span>
                <button
                  onClick={() => setPickedPatient(null)}
                  className="text-[11px] text-accent-ink/55 hover:text-accent-ink"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search existing patient by name or MRN…"
                  className="w-full rounded-lg border border-black/[0.1] px-3 py-2 text-[13px] focus:outline-none focus:border-accent-emerald"
                />
                {patientHits.length > 0 ? (
                  <ul className="rounded-lg border border-black/[0.08] divide-y divide-black/[0.05] bg-white max-h-40 overflow-y-auto">
                    {patientHits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPickedPatient(h);
                            setPatientHits([]);
                            setPatientSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-bgl-alt"
                        >
                          <p className="text-[13px] font-medium text-accent-ink">
                            {h.fullName}
                          </p>
                          <p className="text-[11px] text-accent-ink/55">
                            {h.identifiers
                              .map((i) => i.value)
                              .filter(Boolean)
                              .join(" · ") || "no identifiers on file"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              <input
                type="text"
                value={chartMrn}
                onChange={(e) => setChartMrn(e.target.value)}
                placeholder="Or type MRN if patient is new"
                disabled={!!pickedPatient}
                className="w-full rounded-lg border border-black/[0.1] px-3 py-2 text-[13px] focus:outline-none focus:border-accent-emerald disabled:opacity-50"
              />
              <input
                type="text"
                value={chartLabel}
                onChange={(e) => setChartLabel(e.target.value)}
                placeholder="Optional internal label"
                className="w-full rounded-lg border border-black/[0.1] px-3 py-2 text-[13px] focus:outline-none focus:border-accent-emerald"
              />
            </div>

            <button
              type="button"
              onClick={startChart}
              disabled={isPending}
              className="inline-flex items-center gap-2 text-[12px] font-medium px-4 py-2 rounded-full bg-accent-ink text-white hover:opacity-95 disabled:opacity-50"
            >
              <Folder size={13} />
              {isPending ? "Starting…" : "Start chart"}
            </button>
          </div>
        )}

        {/* Previous charts in this batch — re-openable so an operator
            can add a forgotten page to a chart they already closed. */}
        {batchCharts.length > 0 && !activeChartFolderId ? (
          <div className="rounded-2xl border border-black/[0.08] p-4 mb-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium mb-2">
              Previous charts in this batch
            </p>
            <ul className="space-y-1.5">
              {batchCharts.map((c) => {
                const name =
                  c.resolvedPatient?.fullName ??
                  c.declaredPatient?.fullName ??
                  c.label ??
                  (c.declaredMrn ? `MRN ${c.declaredMrn}` : "Unnamed chart");
                const status = describeChartStatus(c);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-md hover:bg-bgl-alt px-2.5 py-2"
                  >
                    <span className="w-6 h-6 rounded-md bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                      <Folder size={12} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-accent-ink truncate">
                        {name}
                      </p>
                      <p className="text-[11px] text-accent-ink/55 truncate">
                        {c.pageCount} page{c.pageCount === 1 ? "" : "s"} ·{" "}
                        {status}
                      </p>
                    </div>
                    {c.displayStatus === "FAILED_NO_RESOLUTION" ||
                    c.displayStatus === "UNRESOLVED_NO_EVIDENCE" ? (
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await resolveChartFolderNow(c.id);
                              await refreshBatchCharts();
                            } catch (err) {
                              window.alert(
                                err instanceof Error
                                  ? err.message
                                  : "Couldn't resolve.",
                              );
                            }
                          });
                        }}
                        disabled={isPending}
                        className="text-[11px] text-accent-emerald hover:underline inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        Resolve now
                      </button>
                    ) : null}
                    {c.closedAt ? (
                      <button
                        type="button"
                        onClick={() =>
                          reopenChart(c.id, {
                            label: c.label,
                            pageCount: c.pageCount,
                          })
                        }
                        disabled={isPending}
                        className="text-[11px] text-accent-emerald hover:underline inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        <RotateCcw size={11} />
                        Reopen
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChartFolderId(c.id);
                          setChartPageCount(c.pageCount);
                          setChartLabel(c.label ?? "");
                        }}
                        className="text-[11px] text-accent-emerald hover:underline shrink-0"
                      >
                        Resume
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

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

function describeChartStatus(c: {
  displayStatus?:
    | "OPEN"
    | "EXTRACTING"
    | "RESOLVED"
    | "UNRESOLVED_NO_EVIDENCE"
    | "FAILED_NO_RESOLUTION";
  closedAt: Date | null;
  resolvedSource: string;
  resolvedPatient: { fullName: string } | null;
}): string {
  switch (c.displayStatus) {
    case "OPEN":
      return "Open";
    case "EXTRACTING":
      return "Closed — extracting";
    case "RESOLVED":
      return `Resolved · ${c.resolvedSource.replace(/_/g, " ").toLowerCase()}`;
    case "UNRESOLVED_NO_EVIDENCE":
      return "Closed — no usable evidence yet";
    case "FAILED_NO_RESOLUTION":
      return "Closed — extraction failed";
  }
  // Defensive fallback for legacy rows missing displayStatus.
  if (!c.closedAt) return "Open";
  return c.resolvedSource === "UNRESOLVED"
    ? "Closed"
    : `Resolved · ${c.resolvedSource.replace(/_/g, " ").toLowerCase()}`;
}
