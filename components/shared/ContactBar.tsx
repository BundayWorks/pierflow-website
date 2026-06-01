import Link from "next/link";

export default function ContactBar() {
  return (
    <section className="px-2 md:px-4 pb-4">
      <div
        className="mx-auto max-w-[1200px] rounded-[28px] wave-bg overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #042520 0%, #063A33 25%, #0A7C6E 60%, #0DCE9A 90%, #7AE7C7 100%)",
        }}
      >
        <div className="px-6 md:px-12 py-16 md:py-20 text-center">
          <h2 className="font-display font-medium text-[32px] md:text-[44px] leading-[1.1] tracking-[-0.02em]">
            <span className="text-white/95">Build with us.</span>
          </h2>
          <p className="mt-4 text-[15px] md:text-[16px] text-white/85">
            Connect your product to the health data layer. Talk to the team or
            request API access.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/developers/request-access"
              className="pill-btn-dark gradient-ring"
            >
              Get API access
            </Link>
            <Link
              href="/company/contact"
              className="pill-btn-light gradient-ring"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
