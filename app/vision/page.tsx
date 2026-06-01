import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import SectionLabel from "@/components/shared/SectionLabel";
import ContactBar from "@/components/shared/ContactBar";

export default function VisionPage() {
  return (
    <>
      <PageHeader
        label="Vision"
        title="Health data should move the way money does."
        intro="The internet learned to move information. Fintech learned to move money. Healthcare in Africa hasn't yet learned to move its own data — coverage, records, payments, referrals — between HMOs, providers, and the platforms that serve members. Pierflow is the missing layer."
      />

      <section className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20 space-y-6 text-[15px] leading-[1.8] text-textl-secondary">
          <p>
            Every consequential moment in healthcare depends on data moving
            between organisations. A claim is approved when a hospital and an
            HMO agree on what happened. A patient is treated correctly when the
            record from the last clinic finds the next one. A member keeps
            coverage when a fintech, a payroll system, and an insurer reconcile.
          </p>
          <p>
            Today, in most of Africa, those moments fail. They fail not because
            the people are absent, the funding is absent, or the will is absent
            — they fail because the infrastructure between systems is absent.
          </p>
          <p>
            We are building that infrastructure. Neutral, standards-aligned,
            AI-native by default. A single connectivity layer that every
            participant in healthcare can build on.
          </p>
        </div>
      </section>

      <section className="bg-bgl-alt">
        <div className="max-w-content mx-auto px-6 py-20">
          <SectionLabel variant="light">Where we go</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            A continent where health data flows the way it should.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.7] text-textl-secondary max-w-[680px]">
            We start in Nigeria, with insurance distribution. We move outward to
            clinical records, governments, and cross-border exchange. The
            destination is a continent where a person&apos;s health follows them
            — and a developer can build for that person in an afternoon.
          </p>
          <div className="mt-8">
            <Link
              href="/company/manifesto"
              className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-teal text-white hover:opacity-90"
            >
              Read the manifesto
            </Link>
          </div>
        </div>
      </section>

      <ContactBar />
    </>
  );
}
