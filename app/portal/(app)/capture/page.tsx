import Link from "next/link";
import { listCaptureTargetOrgs } from "./actions";
import CaptureClient from "./CaptureClient";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const orgs = await listCaptureTargetOrgs();
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Records
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Capture records
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Pick the customer organization you&apos;re capturing for, then
        photograph each page of a patient record. Pages upload directly to
        Pierflow as you take them — leave the queue running while you keep
        capturing.
      </p>

      {orgs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/65">
            No active customer organizations to capture for yet.
          </p>
          <p className="mt-2 text-[12px] text-accent-ink/55 leading-[1.6] max-w-[420px] mx-auto">
            Capture targets the customer org that records belong to. Approve
            a pending organization request in the{" "}
            <Link
              href="/portal/customer-orgs"
              className="text-accent-emerald hover:underline"
            >
              customer orgs inbox
            </Link>
            , then come back here.
          </p>
        </div>
      ) : (
        <CaptureClient
          orgs={orgs.map((o) => ({
            id: o.id,
            name: o.name,
            type: o.type,
            location: [o.lga, o.state, o.country].filter(Boolean).join(", "),
            requestedByPartner: o.requestedByPartner
              ? { id: o.requestedByPartner.id, name: o.requestedByPartner.name }
              : null,
          }))}
        />
      )}
    </div>
  );
}
