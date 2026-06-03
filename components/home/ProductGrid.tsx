import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const LARGE = [
  {
    href: "/platform/insurance-distribution",
    eyebrow: "Insurance distribution",
    title: "Distribution rails",
    sub: "designed to extend every HMO product beyond health.",
    body: "Bring HMO plans, savings products, and wellness benefits into fintechs, payroll, banks, and super-apps through one canonical API.",
    bg: "bg-card-mint",
    art: <DistributionArt />,
  },
  {
    href: "/platform/records-api",
    eyebrow: "Records API",
    title: "Paper records to FHIR R4",
    sub: "for any EMR, HMS, or partner system.",
    body: "Turn decades of paper patient files into validated, FHIR R4-compliant bundles your downstream system can import in one call.",
    bg: "bg-card-sky",
    art: <RecordsArt />,
  },
];

const SMALL = [
  {
    href: "/platform/connectivity",
    eyebrow: "Connectivity",
    title: "One pipe across HMOs, providers, and partners",
    sub: "Pre-built integrations to every connected player. Webhooks, idempotency, retries — handled.",
    art: <ConnectivityArt />,
  },
  {
    href: "/platform/data-exchange",
    eyebrow: "Data exchange",
    title: "Canonical records, mapped to FHIR R4",
    sub: "Universal Health Schema across every system you touch. Write once.",
    art: <DataExchangeArt />,
  },
  {
    href: "/platform/intelligence",
    eyebrow: "Intelligence",
    title: "AI scoring inline on every response",
    sub: "Fraud, identity, lapse, eligibility — scored at the boundary, auditable end-to-end.",
    art: <ScoreArt />,
  },
  {
    href: "/platform/identity",
    eyebrow: "Identity",
    title: "Verified members in milliseconds",
    sub: "BVN, NIN, biometric, and historical signal fused into identity_confidence.",
    art: <IdentityArt />,
  },
];

export default function ProductGrid() {
  return (
    <section className="bg-white">
      <div className="max-w-[1200px] mx-auto px-6 pt-24 pb-10">
        <h2 className="font-display font-medium text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.02em] text-accent-ink max-w-[820px]">
          Powered by the connectivity layer for healthcare.
          <br className="hidden md:block" />
          <span className="text-accent-ink/55">
            Built for every player it touches.
          </span>
        </h2>
        <div className="mt-8">
          <Link
            href="/platform"
            className="pill-btn-dark gradient-ring inline-flex items-center gap-2"
          >
            See the full platform
          </Link>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 pb-24 space-y-5">
        {/* two large cards */}
        <div className="grid md:grid-cols-2 gap-5">
          {LARGE.map((c) => (
            <LargeCard key={c.href} {...c} />
          ))}
        </div>

        {/* four small cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SMALL.map((c) => (
            <SmallCard key={c.href} {...c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LargeCard({
  href,
  eyebrow,
  title,
  sub,
  body,
  bg,
  art,
}: (typeof LARGE)[number]) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-[20px] border border-black/[0.06] p-7 lg:p-9 min-h-[460px] flex flex-col ${bg}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
            {eyebrow}
          </p>
          <h3 className="mt-3 font-display text-[26px] md:text-[30px] leading-[1.15] tracking-[-0.01em] text-accent-ink font-medium">
            <span>{title}</span>{" "}
            <span className="text-accent-ink/55">{sub}</span>
          </h3>
        </div>
        <span className="shrink-0 w-10 h-10 rounded-full bg-accent-ink text-white grid place-items-center group-hover:scale-105 transition-transform">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <p className="mt-4 text-[14px] leading-[1.6] text-accent-ink/70 max-w-[420px]">
        {body}
      </p>
      <div className="mt-auto pt-8 relative">{art}</div>
    </Link>
  );
}

function SmallCard({
  href,
  eyebrow,
  title,
  sub,
  art,
}: (typeof SMALL)[number]) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[20px] border border-black/[0.06] bg-card-mint p-7 min-h-[320px] flex flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
          {eyebrow}
        </p>
        <span className="shrink-0 w-9 h-9 rounded-full bg-accent-ink text-white grid place-items-center group-hover:scale-105 transition-transform">
          <ArrowUpRight size={16} />
        </span>
      </div>
      <h3 className="mt-4 font-display text-[20px] leading-[1.25] tracking-[-0.01em] text-accent-ink font-medium">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-[1.6] text-accent-ink/65">{sub}</p>
      <div className="mt-auto pt-6">{art}</div>
    </Link>
  );
}

/* ----- inline SVG illustrations (Plaid-style "device mock" feel) ----- */

function DistributionArt() {
  return (
    <div className="relative h-[180px]">
      <div className="absolute inset-x-6 bottom-0 rounded-2xl bg-white border border-black/5 shadow-[0_20px_50px_-20px_rgba(10,31,27,0.25)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-accent-ink">
            Activate health benefits
          </p>
          <span className="text-[10px] font-mono text-accent-emerald bg-accent-teal-light px-2 py-0.5 rounded-full">
            value_score 88
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Plan A", "Plan B", "Plan C"].map((p, i) => (
            <div
              key={p}
              className={`rounded-lg border border-black/5 p-2 ${i === 0 ? "bg-card-mint" : "bg-white"}`}
            >
              <div className="h-1.5 w-6 rounded-full bg-accent-green/70" />
              <p className="mt-1.5 text-[10px] font-medium text-accent-ink">
                {p}
              </p>
              <p className="text-[9px] text-accent-ink/50">from ₦8k/mo</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreArt() {
  return (
    <div className="relative h-[180px] flex items-end justify-center">
      <div className="w-[160px] h-[160px] rounded-full bg-white border border-black/5 shadow-[0_20px_50px_-20px_rgba(10,31,27,0.25)] flex flex-col items-center justify-center">
        <p className="text-[10px] tracking-[0.18em] text-accent-emerald uppercase">
          Pierflow score
        </p>
        <p className="font-display text-[44px] leading-none mt-1 text-accent-ink font-medium">
          92
        </p>
        <p className="text-[10px] text-accent-ink/50 mt-1">out of 99</p>
      </div>
    </div>
  );
}

function RecordsArt() {
  return (
    <div className="relative h-[180px]">
      {/* stacked paper sheets, left */}
      <div className="absolute left-2 bottom-4 w-[120px]">
        <div className="absolute -left-1 -top-1 w-full h-[140px] rounded-md bg-white/70 border border-black/5 rotate-[-6deg]" />
        <div className="absolute left-1 top-1 w-full h-[140px] rounded-md bg-white/85 border border-black/5 rotate-[-3deg]" />
        <div className="relative w-full h-[140px] rounded-md bg-white border border-black/[0.06] shadow-[0_12px_30px_-12px_rgba(10,31,27,0.25)] p-3">
          <div className="h-1.5 w-2/3 rounded-full bg-accent-ink/70" />
          <div className="mt-2 space-y-1.5">
            <div className="h-1 w-full rounded-full bg-accent-ink/15" />
            <div className="h-1 w-5/6 rounded-full bg-accent-ink/15" />
            <div className="h-1 w-3/4 rounded-full bg-accent-ink/15" />
            <div className="h-1 w-4/5 rounded-full bg-accent-ink/15" />
            <div className="h-1 w-2/3 rounded-full bg-accent-ink/15" />
          </div>
          <div className="mt-3 h-1 w-1/2 rounded-full bg-accent-ink/25" />
        </div>
      </div>

      {/* arrow */}
      <svg
        className="absolute left-[135px] top-[80px]"
        width="36"
        height="20"
        viewBox="0 0 36 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 10 H30 M22 3 L30 10 L22 17"
          stroke="#0DCE9A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* FHIR bundle card, right */}
      <div className="absolute right-2 bottom-4 w-[120px] rounded-md bg-white border border-black/[0.06] shadow-[0_12px_30px_-12px_rgba(10,31,27,0.25)] p-3 font-mono text-[10px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-accent-emerald">FHIR R4</span>
          <span className="text-accent-ink/40">Bundle</span>
        </div>
        <p className="text-accent-ink/70 leading-[1.4]">
          {"{ resourceType:"}
        </p>
        <p className="text-accent-ink/70 leading-[1.4]">
          {"  \"Patient\","}
        </p>
        <p className="text-accent-ink/70 leading-[1.4]">
          {"  conf: 0.97 }"}
        </p>
      </div>
    </div>
  );
}

function ConnectivityArt() {
  return (
    <div className="relative h-[100px]">
      <svg viewBox="0 0 280 100" className="w-full h-full">
        <defs>
          <linearGradient id="connLine" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#0DCE9A" />
            <stop offset="100%" stopColor="#7AE7C7" />
          </linearGradient>
        </defs>
        <line
          x1="20"
          y1="50"
          x2="260"
          y2="50"
          stroke="url(#connLine)"
          strokeWidth="2"
          strokeDasharray="2 4"
        />
        {[20, 90, 160, 230].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy={50} r="14" fill="#ffffff" stroke="#0a1f1b" strokeOpacity="0.1" />
            <circle cx={x} cy={50} r="5" fill={i === 1 ? "#0DCE9A" : "#0A1F1B"} />
          </g>
        ))}
      </svg>
    </div>
  );
}

function DataExchangeArt() {
  return (
    <div className="rounded-xl bg-white border border-black/5 shadow-[0_20px_40px_-20px_rgba(10,31,27,0.2)] p-3 font-mono text-[10px]">
      <div className="flex gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f57]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#28c940]" />
      </div>
      <p className="text-accent-emerald">{`GET /v1/policies/:id`}</p>
      <p className="text-accent-ink/70 mt-1">
        <span className="text-accent-ink/45">{`{ "plan_id": "plan_basic",`}</span>
      </p>
      <p className="text-accent-ink/70">
        <span className="text-accent-ink/45">{`  "lapse_risk_score": 0.12 }`}</span>
      </p>
    </div>
  );
}

function IdentityArt() {
  return (
    <div className="rounded-xl bg-white border border-black/5 shadow-[0_20px_40px_-20px_rgba(10,31,27,0.2)] p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-accent-teal-light grid place-items-center text-[14px] font-medium text-accent-emerald">
        AO
      </div>
      <div className="flex-1">
        <p className="text-[12px] font-medium text-accent-ink">Amaka Okeke</p>
        <p className="text-[10px] text-accent-ink/55">BVN · NIN · Verified</p>
      </div>
      <span className="text-[10px] font-mono text-accent-emerald bg-accent-teal-light px-2 py-1 rounded-full">
        0.97
      </span>
    </div>
  );
}
