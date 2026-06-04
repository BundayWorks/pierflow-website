import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getReviewJob } from "../actions";
import ReviewClient from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: {
  params: { jobId: string };
}) {
  const job = await getReviewJob(params.jobId);
  if (!job) notFound();

  const record = job.extractedRecords[0];
  if (!record) {
    return (
      <div>
        <BackLink />
        <div className="mt-6 rounded-xl border border-black/[0.08] p-6 text-[14px] text-accent-ink/70">
          This job has no extracted record yet. It may still be processing —
          come back in a moment.
        </div>
      </div>
    );
  }

  const src = (job.sourceAsset ?? {}) as {
    publicId?: string;
    secureUrl?: string;
  };

  // lowConfidenceFields used to be a flat array. We now write an object
  // shape; accept either for backward compat with rows created before
  // step 9 shipped.
  const lcf = (record.lowConfidenceFields ?? {}) as
    | string[]
    | {
        confidence?: string[];
        validation?: { code: string; severity: string; message: string; path?: string }[];
        disposition?: string;
      };
  const confidenceList = Array.isArray(lcf) ? lcf : lcf.confidence ?? [];
  const validationIssues = Array.isArray(lcf) ? [] : lcf.validation ?? [];

  return (
    <div>
      <BackLink />
      <ReviewClient
        recordId={record.id}
        jobId={job.id}
        documentType={job.recordTypeHint}
        imageUrl={src.secureUrl ?? null}
        extractedJson={record.extractedJson}
        avgConfidence={record.avgConfidence ?? 0}
        completenessScore={record.completenessScore ?? 0}
        confidenceList={confidenceList}
        validationIssues={validationIssues}
        initialNotes={record.reviewerNotes ?? ""}
        batchLabel={job.batch.label ?? "Untitled batch"}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/portal/review"
      className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
    >
      <ArrowLeft size={14} />
      Review queue
    </Link>
  );
}
