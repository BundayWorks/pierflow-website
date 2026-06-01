import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import SectionLabel from "@/components/shared/SectionLabel";
import ContactBar from "@/components/shared/ContactBar";

const MODULES = [
  {
    slug: "data-exchange",
    title: "Data exchange",
    body: "Canonical resources mapped to FHIR R4. Bidirectional with every connected HMO and provider.",
  },
  {
    slug: "connectivity",
    title: "Connectivity",
    body: "Pre-built integrations for HMOs, hospitals, and partners. Webhooks, idempotency, retries — handled.",
  },
  {
    slug: "insurance-distribution",
    title: "Insurance distribution",
    body: "Plans, quotes, enrollment, policies, collections — across every HMO in the network.",
  },
  {
    slug: "identity",
    title: "Identity",
    body: "BVN, NIN, biometric, and historical signal fused into identity_confidence.",
  },
  {
    slug: "payments",
    title: "Payments",
    body: "Premium collection, claim payouts, and partner reconciliation flows.",
  },
  {
    slug: "intelligence",
    title: "Intelligence",
    body: "Fraud, lapse, value, and population_signal scoring inline on every response.",
  },
  {
    slug: "security",
    title: "Security",
    body: "NDPR-aligned, end-to-end encrypted, full audit trails, per-endpoint signing keys.",
  },
];

export default function PlatformPage() {
  return (
    <>
      <PageHeader
        label="Platform"
        title="The full health connectivity layer."
        intro="Seven modules. One canonical surface. AI-native by default."
      />
      <section className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Modules</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            Build with everything, or just the part you need.
          </h2>
          <div
            className="mt-10 grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {MODULES.map((m) => (
              <Link
                key={m.slug}
                href={`/platform/${m.slug}`}
                className="block border border-[#eaeaea] rounded-lg p-5 hover:border-[#bbb] transition-colors"
              >
                <h3 className="text-[15px] font-medium text-textl-primary">
                  {m.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {m.body}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <ContactBar />
    </>
  );
}
