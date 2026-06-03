import { listRecentBatches } from "./actions";
import CaptureClient from "./CaptureClient";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const recent = await listRecentBatches();
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Records
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Capture records
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Photograph each page of a patient record from your phone. Pages
        upload directly to Pierflow as you take them — leave the queue
        running while you keep capturing.
      </p>

      <CaptureClient
        recentBatches={recent.map((b) => ({
          id: b.id,
          label: b.label,
          createdAt: b.createdAt.toISOString(),
          priority: b.priority,
          pageCount: b._count.jobs,
        }))}
      />
    </div>
  );
}
