import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Camera,
  Terminal,
  CheckCircle2,
  Webhook,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import SectionLabel from "@/components/shared/SectionLabel";
import ContactBar from "@/components/shared/ContactBar";

export const metadata = {
  title: "EMR / HMS vendors · Pierflow",
};

export default function Page() {
  return (
    <>
      <PageHeader
        label="Solutions · EMR / HMS vendors"
        title="Activate hospital clients with their full paper history on day one."
        intro="Most hospital and clinic clients sit on decades of paper records. Your HMS goes live empty until that history makes it in. Pierflow turns paper into FHIR R4 bundles your platform can import — pick how the digitisation happens, we handle the rest."
      />

      {/* The HealthOS narrative */}
      <section className="bg-white">
        <div className="max-w-[1000px] mx-auto px-6 py-20">
          <SectionLabel variant="light">A typical flow</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            From signed contract to live import in days.
          </h2>
          <p className="mt-3 text-[15px] text-textl-secondary max-w-[640px] leading-[1.7]">
            Imagine you just signed a 200-bed hospital. They have 12 years of
            paper charts and want to go live on your HMS in 60 days. Here&apos;s
            how Pierflow plugs in.
          </p>

          <ol className="mt-12 space-y-10">
            <Step
              number="1"
              title="Sign up and get sandbox access"
              body="Three-step onboarding at /get-started captures your company, use case, and volume. Once Pierflow approves you (usually within one business day), you get a pf_test_sk_* key, an in-portal checklist, and access to the Records API."
            />
            <Step
              number="2"
              title="Register the customer organization"
              body="From the partner console, add the hospital as a new Organization — name, type, country, and your internal MRN system URI. Pierflow reviews each organization so the audit trail stays clean. Once approved, your API key can act on that org."
              code={`curl -X POST https://www.pierflow.com/v1/scan-batches \\
  -H "Authorization: Bearer pf_test_sk_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "org_lagoon_hospital",
    "label": "Migration cohort A — wards 1-3"
  }'`}
            />
            <Step
              number="3"
              title="Pick how digitisation happens"
              body="You have two paths. Use one or both — they share the same downstream pipeline."
              paths={[
                {
                  label: "Path A — Pierflow handles capture",
                  icon: <Camera size={14} />,
                  body: "Our operations team digitises the paper records, or trains your customer's records clerks to. They use the Pierflow capture app on any phone. You don't write a capture UI; you just consume packages.",
                },
                {
                  label: "Path C — programmatic ingest",
                  icon: <Terminal size={14} />,
                  body: "You upload images yourself. Sign a Cloudinary URL via /v1/uploads/sign with your partner token, upload direct-to-Cloudinary from your server, then POST the asset reference to /v1/ingest/documents. We send back a job_id you can poll or wait for a webhook.",
                },
              ]}
            />
            <Step
              number="4"
              title="Extraction runs automatically"
              body="Every uploaded page runs through Claude Haiku 4.5 for structured extraction, then a FHIR R4 mapper (Patient, Encounter, Observation with LOINC, Condition with ICD-10, MedicationRequest with ATC) and a validator. High-confidence records auto-validate; the rest land in a human review queue."
              code={`// Webhook payload — fired on extraction completion
{
  "event": "processing_job.completed",
  "emitted_at": "2026-06-04T08:14:33.512Z",
  "partner_id": "ptn_healthos",
  "data": {
    "job_id": "job_3xMA…",
    "organization_id": "org_lagoon_hospital",
    "completeness_score": 0.94,
    "avg_confidence": 0.91,
    "validation_status": "AUTO_APPROVED",
    "job_status": "VALIDATED"
  }
}`}
            />
            <Step
              number="5"
              title="Import Packages drop nightly"
              body="A cron bundles every validated record per org into a ZIP — manifest.json, per-patient FHIR Bundles, and a SHA-256 checksum file. The package is uploaded to private Cloudinary storage and a presigned download URL is generated."
              code={`// Webhook payload — package ready
{
  "event": "import_package.ready",
  "emitted_at": "2026-06-05T02:00:11.118Z",
  "partner_id": "ptn_healthos",
  "data": {
    "package_id": "pkg_4HD…",
    "organization_id": "org_lagoon_hospital",
    "patient_count": 312,
    "record_count": 728,
    "download_endpoint": "/v1/import-packages/pkg_4HD…/download"
  }
}`}
            />
            <Step
              number="6"
              title="Download, import, acknowledge"
              body="Hit /v1/import-packages/{id}/download to get a signed Cloudinary URL, ingest the ZIP into your EMR, then POST /v1/import-packages/{id}/acknowledge with per-record success/failure counts. Anything that failed re-rolls into the next package automatically."
              code={`curl -X POST https://www.pierflow.com/v1/import-packages/pkg_4HD…/acknowledge \\
  -H "Authorization: Bearer pf_test_sk_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "imported_count": 726,
    "failed_count": 2,
    "failures": [
      { "patient_id": "pat_3aB…", "reason": "duplicate_mrn" }
    ]
  }'`}
            />
          </ol>
        </div>
      </section>

      {/* Why this works */}
      <section className="bg-bgl-alt">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Why this works</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            Built for the messy, bursty work of paper migration.
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Capability
              icon={<Building2 size={16} />}
              title="One API, every customer"
              body="A single PartnerOrganizationLink per (you, hospital) means your importer code is identical across customers. Add a hospital, get a new orgId, point at it."
            />
            <Capability
              icon={<CheckCircle2 size={16} />}
              title="Human review when it matters"
              body="Low-confidence records go to a Pierflow reviewer before they ever reach your EMR. Your customers never see half-extracted records or guessed dates."
            />
            <Capability
              icon={<Webhook size={16} />}
              title="Realtime + batch"
              body="Webhooks for status; nightly Import Packages for bulk consumption. Use both: webhooks update your job queue, packages keep your nightly cron simple."
            />
            <Capability
              icon={<Terminal size={16} />}
              title="FHIR R4 from end to end"
              body="Patient, Encounter, Observation (LOINC), Condition (ICD-10), MedicationRequest (ATC), Practitioner, AllergyIntolerance, DiagnosticReport. Standards-compliant, not just JSON-shaped."
            />
            <Capability
              icon={<Camera size={16} />}
              title="Capture, your way"
              body="Run your own scanning ops via programmatic ingest, or let Pierflow operate the capture flow with your customer's records clerks. Pick per-customer."
            />
            <Capability
              icon={<CheckCircle2 size={16} />}
              title="Audit trail by design"
              body="Every organization request, every approval, every package, every acknowledgement is durable and append-only. Pass compliance reviews without spreadsheets."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="max-w-[1000px] mx-auto px-6 py-20 text-center">
          <SectionLabel variant="light">Get started</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            Spin up a sandbox in five minutes.
          </h2>
          <p className="mt-4 text-[15px] text-textl-secondary max-w-[560px] mx-auto leading-[1.7]">
            Sign up, register a test organization, and pull a sample Import
            Package. From there it&apos;s your real customer.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/get-started"
              className="text-[13px] font-medium px-5 py-2.5 rounded-md bg-accent-ink text-white hover:opacity-90 inline-flex items-center gap-2"
            >
              Get started <ArrowRight size={14} />
            </Link>
            <Link
              href="/docs/quickstart/introduction"
              className="text-[13px] font-medium px-5 py-2.5 rounded-md border border-[#ddd] text-textl-primary hover:bg-[#f7f7f7]"
            >
              Read the quick start
            </Link>
          </div>
        </div>
      </section>

      <ContactBar />
    </>
  );
}

function Step({
  number,
  title,
  body,
  code,
  paths,
}: {
  number: string;
  title: string;
  body: string;
  code?: string;
  paths?: { label: string; icon: React.ReactNode; body: string }[];
}) {
  return (
    <li className="flex gap-6">
      <span className="w-9 h-9 rounded-full bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0 text-[14px] font-medium font-display">
        {number}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-[17px] font-medium text-textl-primary">{title}</h3>
        <p className="mt-2 text-[14px] leading-[1.7] text-textl-secondary">
          {body}
        </p>
        {paths ? (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {paths.map((p) => (
              <div
                key={p.label}
                className="rounded-lg border border-[#eaeaea] p-4 bg-white"
              >
                <p className="text-[12px] uppercase tracking-[0.12em] text-accent-emerald font-medium inline-flex items-center gap-1.5">
                  {p.icon}
                  {p.label}
                </p>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {code ? (
          <pre className="mt-4 text-[12px] leading-[1.65] font-mono bg-dark-bg text-white rounded-md p-4 overflow-x-auto">
            {code}
          </pre>
        ) : null}
      </div>
    </li>
  );
}

function Capability({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-[#eaeaea] bg-white p-5">
      <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center">
        {icon}
      </span>
      <h3 className="mt-3 text-[14px] font-medium text-textl-primary">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
        {body}
      </p>
    </div>
  );
}
