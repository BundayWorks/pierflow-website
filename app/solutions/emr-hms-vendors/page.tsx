import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Camera,
  Cpu,
  CheckCircle2,
  Bell,
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
        intro="Most hospital and clinic clients sit on decades of paper records. Your platform goes live empty until that history makes it in. Pierflow takes care of the digitisation and hands you clean, standards-aligned data your EMR can import — so the system is meaningful from the first appointment."
      />

      {/* At a glance */}
      <section className="bg-white">
        <div className="max-w-[1000px] mx-auto px-6 py-20">
          <SectionLabel variant="light">At a glance</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            From signed contract to live import in days.
          </h2>
          <div className="mt-10 grid sm:grid-cols-3 gap-4">
            <Glance
              icon={<Building2 size={16} />}
              n="1"
              title="Onboard the customer"
              body="Register the hospital from your partner console. Once approved, your account is linked to that organisation and can act on its records."
            />
            <Glance
              icon={<Camera size={16} />}
              n="2"
              title="Digitise their records"
              body="Pick the path that fits the customer — Pierflow operates the capture, or you do — using the same downstream pipeline either way."
            />
            <Glance
              icon={<CheckCircle2 size={16} />}
              n="3"
              title="Consume in your EMR"
              body="Pierflow delivers structured patient bundles your platform imports through a single API. Records arrive validated and reviewed."
            />
          </div>
        </div>
      </section>

      {/* Two paths */}
      <section className="bg-bgl-alt">
        <div className="max-w-[1000px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Two ways to digitise</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            Pick the path that matches each customer.
          </h2>
          <p className="mt-3 text-[15px] leading-[1.7] text-textl-secondary max-w-[640px]">
            Some customers have records clerks who can scan; some don&apos;t.
            You don&apos;t need to commit to one approach for your whole book —
            pick per customer. Both paths feed the same consumption surface
            on your side.
          </p>

          <div className="mt-10 grid md:grid-cols-2 gap-4">
            <PathCard
              tag="Path A"
              title="We handle the digitisation"
              body="Our operations team digitises the paper records, or trains your customer's records clerks to. They use the Pierflow capture app on any phone. You don't run scanning operations — you just consume what comes out."
              fit="Best for hospitals without an in-house scanning team, and for cohort migrations under deadline."
            />
            <PathCard
              tag="Path C"
              title="You handle the digitisation"
              body="Your team (or your customer's) captures records and pushes them to Pierflow through the API. Same digitisation pipeline, same validated output — you control the ingest cadence."
              fit="Best for EMR vendors with established field operations or customers running their own migration projects."
            />
          </div>
        </div>
      </section>

      {/* Why this works */}
      <section className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Why this works</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            Built for the messy, bursty work of paper migration.
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Capability
              icon={<Building2 size={16} />}
              title="One integration, every customer"
              body="Add a hospital, get a customer reference, point your importer at it. The shape doesn't change from one customer to the next."
            />
            <Capability
              icon={<CheckCircle2 size={16} />}
              title="Human-reviewed quality"
              body="Records that don't meet our confidence bar are reviewed by clinical operators before they reach your EMR. Your customers don't see half-extracted records or guessed dates."
            />
            <Capability
              icon={<Bell size={16} />}
              title="Realtime + batch delivery"
              body="Get notified the moment a customer's records are ready to import, and have a nightly bundle waiting for batch ingest. Use either or both."
            />
            <Capability
              icon={<Cpu size={16} />}
              title="Standards-aligned by default"
              body="Output is FHIR R4 — the standard your future integrations and government tenders will expect. No translation layer required on your side."
            />
            <Capability
              icon={<Camera size={16} />}
              title="Capture, your way"
              body="Self-serve programmatic ingest, fully managed by Pierflow, or anywhere in between — pick per customer and switch when it suits you."
            />
            <Capability
              icon={<CheckCircle2 size={16} />}
              title="Audit trail by design"
              body="Every customer onboarding, every batch, every delivery is durable and append-only. Pass compliance reviews without spreadsheets."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="max-w-[1000px] mx-auto px-6 pb-20 text-center">
          <SectionLabel variant="light">Get started</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            Spin up a sandbox in five minutes.
          </h2>
          <p className="mt-4 text-[15px] text-textl-secondary max-w-[560px] mx-auto leading-[1.7]">
            Sign up, register a test customer, and walk through a sample
            delivery. From there it&apos;s your real customer.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/get-started"
              className="text-[13px] font-medium px-5 py-2.5 rounded-md bg-accent-ink text-white hover:opacity-90 inline-flex items-center gap-2"
            >
              Get started <ArrowRight size={14} />
            </Link>
            <Link
              href="/company/contact"
              className="text-[13px] font-medium px-5 py-2.5 rounded-md border border-[#ddd] text-textl-primary hover:bg-[#f7f7f7]"
            >
              Talk to us first
            </Link>
          </div>
        </div>
      </section>

      <ContactBar />
    </>
  );
}

function Glance({
  icon,
  n,
  title,
  body,
}: {
  icon: React.ReactNode;
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-[#eaeaea] p-5 bg-white">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-accent-teal-light text-accent-emerald grid place-items-center text-[13px] font-medium font-display">
          {n}
        </span>
        <span className="w-7 h-7 rounded-md bg-accent-teal-light text-accent-emerald grid place-items-center">
          {icon}
        </span>
      </div>
      <h3 className="mt-4 text-[14px] font-medium text-textl-primary">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
        {body}
      </p>
    </div>
  );
}

function PathCard({
  tag,
  title,
  body,
  fit,
}: {
  tag: string;
  title: string;
  body: string;
  fit: string;
}) {
  return (
    <div className="rounded-lg border border-[#eaeaea] bg-white p-6">
      <p className="text-[11px] uppercase tracking-[0.14em] text-accent-emerald font-medium">
        {tag}
      </p>
      <h3 className="mt-2 text-[17px] font-medium text-textl-primary leading-[1.3]">
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.7] text-textl-secondary">
        {body}
      </p>
      <p className="mt-4 text-[12px] leading-[1.65] text-textl-secondary italic">
        {fit}
      </p>
    </div>
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
