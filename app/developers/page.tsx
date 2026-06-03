import Link from "next/link";
import DevCta from "@/components/home/DevCta";
import PageHeader from "@/components/shared/PageHeader";
import SectionLabel from "@/components/shared/SectionLabel";

const STEPS = [
  {
    n: "01",
    title: "Request API access",
    body: "Tell us what you are building. We provision sandbox keys within one business day.",
  },
  {
    n: "02",
    title: "Pull the SDK",
    body: "Install @pierflow/node or hit the REST API directly. Auth is a single bearer token.",
  },
  {
    n: "03",
    title: "Make your first call",
    body: "GET /v1/plans returns a list of HMO products ranked by value_score — AI inline.",
  },
  {
    n: "04",
    title: "Enroll a member",
    body: "POST /v1/enrollments creates a policy. The response includes fraud_score and identity_confidence.",
  },
  {
    n: "05",
    title: "Go live",
    body: "Switch your bearer token to the production environment. Same surface, same shapes.",
  },
];

const FEATURES = [
  {
    title: "Embedded insurance",
    body: "Sell HMO products inside your fintech, payroll, or super-app — with collection and reconciliation handled.",
  },
  {
    title: "Provider directories",
    body: "Look up hospitals, clinics, pharmacies with capabilities, geolocation, and accepted plans.",
  },
  {
    title: "Clinical data exchange",
    body: "Move FHIR-canonical records between providers, insurers, and care teams.",
  },
  {
    title: "Benefits verification",
    body: "Verify a member's coverage in milliseconds at point of care.",
  },
  {
    title: "Paper-to-FHIR migration",
    body: "Pull historical paper patient records into your EMR or HMS as validated FHIR R4 bundles through the Records API.",
  },
];

export default function DevelopersPage() {
  return (
    <>
      <PageHeader
        label="Developers"
        title="Build on the health connectivity layer for Africa."
        intro="One API across HMOs, providers, pharmacies, and the platforms that serve them. AI-native — every endpoint returns validated, normalised, and scored data."
      />

      <section className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Quick start</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            From request to production in five steps.
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="border border-[#eaeaea] rounded-lg p-5 bg-white"
              >
                <span className="font-mono text-[11px] text-accent-teal">
                  {s.n}
                </span>
                <h3 className="mt-3 text-[15px] font-medium text-textl-primary">
                  {s.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/developers/request-access"
              className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-teal text-white hover:opacity-90"
            >
              Request API access
            </Link>
            <Link
              href="/docs/getting-started"
              className="text-[13px] font-medium px-4 py-2.5 rounded-md border border-[#ddd] text-textl-primary hover:bg-[#f7f7f7]"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-bgl-alt">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">What you can build</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            One platform, every health-data workflow.
          </h2>
          <div
            className="mt-10 grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white border border-[#eaeaea] rounded-lg p-5"
              >
                <h3 className="text-[14px] font-medium text-textl-primary">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DevCta />
    </>
  );
}
