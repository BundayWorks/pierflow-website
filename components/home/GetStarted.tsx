export default function GetStarted() {
  return (
    <section className="px-2 md:px-4 py-4 md:py-6 pb-12">
      <div
        className="relative mx-auto max-w-[1200px] rounded-[28px] overflow-hidden wave-bg"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #0A7C6E 0%, #0DCE9A 40%, #7AE7C7 75%, #A8F2A1 100%)",
        }}
      >
        <div className="relative grid lg:grid-cols-2 gap-10 items-center px-6 md:px-12 py-20">
          <div>
            <h2 className="font-display font-medium text-[40px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-[#042520]">
              Start building
              <br />
              <span className="text-white">better health products</span>
            </h2>
            <p className="mt-6 text-[15px] md:text-[16px] leading-[1.6] text-[#042520]/80 max-w-[420px]">
              Connect to the health data layer and ship in days. Sandbox
              credentials in your inbox the same business day.
            </p>
          </div>

          <form
            action="mailto:research@pierflow.com"
            method="post"
            encType="text/plain"
            className="bg-white rounded-[20px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.3)] p-6 md:p-7"
          >
            <p className="font-display text-[24px] font-medium text-accent-ink">
              Let&apos;s get started
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Input name="first" placeholder="First name" />
              <Input name="last" placeholder="Last name" />
              <Input name="email" placeholder="Company email" type="email" />
              <Input name="company" placeholder="Company name" />
              <Input name="country" placeholder="Country" />
              <Input name="phone" placeholder="Phone (optional)" />
            </div>
            <p className="mt-3 text-[11px] text-accent-ink/55">
              By submitting this form, I confirm I&apos;ve read{" "}
              <a
                href="/legal/privacy"
                className="underline text-accent-emerald"
              >
                Pierflow&apos;s Privacy Statement
              </a>
              .
            </p>
            <button
              type="submit"
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-cta-gradient text-accent-ink font-medium text-[14px] gradient-ring"
            >
              Talk with our team
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-black/[0.08] px-3 py-2.5 text-[13px] text-accent-ink placeholder:text-accent-ink/40 focus:outline-none focus:border-accent-emerald"
    />
  );
}
