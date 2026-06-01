import Link from "next/link";

export default function ApiKeysCta() {
  return (
    <section className="px-2 md:px-4 py-4 md:py-6">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-[#06251f] wave-bg">
        <div className="relative px-6 md:px-10 pt-24 pb-10 text-center">
          <h2 className="font-display font-medium text-white text-[36px] md:text-[56px] leading-[1.05] tracking-[-0.02em]">
            Want to connect every HMO, hospital,
            <br className="hidden md:block" />
            and partner in one place?
            <br />
            <span className="text-gradient">We&apos;ve got the API keys.</span>
          </h2>
          <p className="mt-5 text-white/75 text-[15px] md:text-[17px]">
            You build the experience. We move the data.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/developers/request-access"
              className="pill-btn-light gradient-ring"
            >
              Get the API keys
            </Link>
            <Link
              href="/docs"
              className="text-[14px] px-5 py-3 rounded-full border border-white/25 text-white hover:bg-white/5"
            >
              Read the docs
            </Link>
          </div>
        </div>

        <div className="relative mx-6 md:mx-12 mb-12 rounded-[20px] overflow-hidden border border-white/10 bg-[#0a1f1b]">
          <div className="px-5 py-3 border-b border-white/10 text-[12px] font-mono text-white/60">
            /v1/policies/verify
          </div>
          <pre className="p-6 text-[13px] leading-[1.7] font-mono overflow-x-auto text-white">
            <code>
              <span className="text-white/40">1</span>{"  "}
              <span className="text-accent-mint">request</span> ={" "}
              <span className="text-accent-cyan">VerifyRequest</span>(policy_id=
              <span className="text-white/80">policy_id</span>){"\n"}
              <span className="text-white/40">2</span>{"  "}
              <span className="text-accent-mint">response</span> = client.
              <span className="text-accent-cyan">policies.verify</span>(request)
              {"\n"}
              <span className="text-white/40">3</span>{"  "}
              <span className="text-accent-mint">eligibility</span> = response[
              <span className="text-[#F5A623]">&apos;coverage&apos;</span>][
              <span className="text-[#F5A623]">&apos;state&apos;</span>]{"\n"}
              <span className="text-white/40">4</span>{"  "}
              <span className="text-accent-mint">confidence</span> = response[
              <span className="text-[#F5A623]">&apos;eligibility_confidence&apos;</span>]
              {"\n"}
              <span className="text-white/40">5</span>{"  "}
              <span className="text-accent-mint">fraud_score</span> = response[
              <span className="text-[#F5A623]">&apos;fraud_score&apos;</span>]
              {"\n"}
              <span className="text-white/40">6</span>
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
