"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldCheck,
  Building2,
  Banknote,
  Smartphone,
  Brain,
  FileText,
  Network,
  KeyRound,
  Webhook,
  Heart,
  Scale,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Logo from "@/components/shared/Logo";

/**
 * Investor / accelerator deck.
 *
 * 10 slides, web-rendered with the same fonts and colour tokens as the
 * marketing site. Arrow keys / on-screen controls navigate; hash
 * (#1…#10) keeps state in the URL so reviewers can deep-link. The
 * "Save as PDF" button opens the browser's print dialog with print CSS
 * that lays one slide per A4 landscape page.
 */
export default function Deck() {
  const total = 10;
  const [index, setIndex] = useState(1);

  // Hash <-> index sync.
  useEffect(() => {
    function readHash() {
      const raw = window.location.hash.replace("#", "");
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 1 && n <= total) setIndex(n);
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const goto = useCallback(
    (n: number) => {
      const clamped = Math.max(1, Math.min(total, n));
      setIndex(clamped);
      if (typeof window !== "undefined") {
        window.location.hash = String(clamped);
      }
    },
    [],
  );

  // Arrow + space + j/k keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === " " ||
        e.key === "j" ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        goto(index + 1);
      } else if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp" ||
        e.key === "k" ||
        e.key === "PageUp"
      ) {
        e.preventDefault();
        goto(index - 1);
      } else if (e.key === "Home") {
        goto(1);
      } else if (e.key === "End") {
        goto(total);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goto]);

  function printDeck() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="deck">
      {/* On-screen: only the active slide is visible. Print: all slides,
          one per page. */}
      <div className="deck-slides">
        <Slide id={1} active={index === 1}>
          <Cover />
        </Slide>
        <Slide id={2} active={index === 2}>
          <Problem />
        </Slide>
        <Slide id={3} active={index === 3} tone="light">
          <Vision />
        </Slide>
        <Slide id={4} active={index === 4}>
          <Solution />
        </Slide>
        <Slide id={5} active={index === 5}>
          <Platform />
        </Slide>
        <Slide id={6} active={index === 6}>
          <RecordsApi />
        </Slide>
        <Slide id={7} active={index === 7}>
          <Impact />
        </Slide>
        <Slide id={8} active={index === 8}>
          <Market />
        </Slide>
        <Slide id={9} active={index === 9}>
          <WhyNow />
        </Slide>
        <Slide id={10} active={index === 10}>
          <Ask />
        </Slide>
      </div>

      {/* Controls — hidden in print. */}
      <div className="deck-controls fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/55 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5 z-50 print:hidden">
        <button
          onClick={() => goto(index - 1)}
          disabled={index === 1}
          className="text-white/75 hover:text-white p-2 disabled:opacity-30"
          aria-label="Previous slide"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[11px] font-mono text-white/70 tabular-nums w-12 text-center">
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <button
          onClick={() => goto(index + 1)}
          disabled={index === total}
          className="text-white/75 hover:text-white p-2 disabled:opacity-30"
          aria-label="Next slide"
        >
          <ChevronRight size={16} />
        </button>
        <span className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={printDeck}
          className="text-white/75 hover:text-white text-[11px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/5"
          title="Save as PDF (browser print dialog)"
        >
          <Download size={12} />
          PDF
        </button>
      </div>
    </div>
  );
}

/* ── Slide primitives ───────────────────────────────────────── */

function Slide({
  id,
  active,
  tone = "dark",
  children,
}: {
  id: number;
  active: boolean;
  tone?: "dark" | "light";
  children: React.ReactNode;
}) {
  return (
    <section
      id={`slide-${id}`}
      aria-hidden={!active}
      className={`deck-slide ${tone === "light" ? "deck-slide-light" : ""} ${
        active ? "deck-slide-active" : "deck-slide-hidden"
      }`}
    >
      <div className="deck-slide-inner">{children}</div>
      <PageMark id={id} tone={tone} />
    </section>
  );
}

function PageMark({ id, tone }: { id: number; tone: "dark" | "light" }) {
  const color = tone === "light" ? "text-accent-ink/45" : "text-white/45";
  return (
    <div
      className={`absolute bottom-6 right-8 text-[10px] font-mono tracking-[0.18em] uppercase ${color} flex items-center gap-3`}
    >
      <span>{String(id).padStart(2, "0")} / 10</span>
      <span>pierflow.com</span>
    </div>
  );
}

function Eyebrow({
  children,
  tone = "dark",
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
}) {
  const color =
    tone === "light" ? "text-accent-emerald" : "text-accent-green";
  return (
    <p
      className={`text-[11px] uppercase tracking-[0.22em] font-medium ${color}`}
    >
      {children}
    </p>
  );
}

function Headline({
  children,
  tone = "dark",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const color = tone === "light" ? "text-accent-ink" : "text-white";
  const sizeClass =
    size === "xl"
      ? "text-[56px] md:text-[80px] leading-[0.98]"
      : size === "lg"
        ? "text-[44px] md:text-[60px] leading-[1.02]"
        : "text-[36px] md:text-[48px] leading-[1.05]";
  return (
    <h2
      className={`font-display font-medium tracking-[-0.022em] ${sizeClass} ${color} ${className}`}
    >
      {children}
    </h2>
  );
}

function Sub({
  children,
  tone = "dark",
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
}) {
  const color = tone === "light" ? "text-accent-ink/65" : "text-white/65";
  return (
    <p className={`text-[16px] md:text-[18px] leading-[1.55] ${color}`}>
      {children}
    </p>
  );
}

function CodeBlock({
  language,
  filename,
  children,
}: {
  language?: string;
  filename?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-dark-surface overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-black/40">
        <span className="text-[11px] font-mono text-textd-secondary">
          {filename ?? "request"}
        </span>
        {language ? (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-accent-green-dim text-accent-green">
            {language}
          </span>
        ) : null}
      </div>
      <pre className="p-5 text-[13px] leading-[1.7] font-mono overflow-x-auto text-white">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/* ── Slide 1: Cover ────────────────────────────────────────── */

function Cover() {
  return (
    <div className="grid lg:grid-cols-[1.05fr,0.95fr] gap-12 items-center">
      <div>
        <div className="mb-10">
          <Logo variant="light" size="lg" />
        </div>
        <Headline size="xl">
          The connectivity layer for healthcare in Africa.
        </Headline>
        <p className="mt-6 text-[18px] md:text-[20px] leading-[1.55] text-white/70 max-w-[520px]">
          AI-native. API-first. Standards-aligned with FHIR R4. Built in
          Lagos.
        </p>
        <div className="mt-10 flex flex-wrap gap-2">
          {["AI-native", "API-first", "FHIR R4", "Built for Africa"].map(
            (label) => (
              <span
                key={label}
                className="text-[12px] px-3 py-1.5 rounded-full border border-accent-green/30 text-accent-green bg-accent-green/[0.06]"
              >
                {label}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="space-y-4">
        <CodeBlock language="HTTP" filename="POST /v1/ingest/documents">
{`{
  "organizationId": "org_lagoon_hospital",
  "batchId": "bat_5q3…",
  "source": {
    "publicId": "pierflow/org_…/page_001",
    "secureUrl": "https://res.cloudinary.com/…/page_001.jpg"
  },
  "documentType": "OUTPATIENT_CARD"
}`}
        </CodeBlock>
        <CodeBlock language="HTTP 202" filename="response">
{`{
  "status": "accepted",
  "job_id": "job_3xMA…",
  "batch_id": "bat_5q3…",
  "pages": 1,
  "job_status": "QUEUED"
}`}
        </CodeBlock>
      </div>
    </div>
  );
}

/* ── Slide 2: Problem ──────────────────────────────────────── */

function Problem() {
  const stats = [
    {
      number: "< 5%",
      caption: "health insurance penetration",
      sub: "Coverage doesn't reach.",
    },
    {
      number: "70%+",
      caption: "of health spending is out-of-pocket",
      sub: "Systems don't share.",
    },
    {
      number: "220M+",
      caption: "Nigerians without digital health records",
      sub: "Processes don't connect.",
    },
  ];

  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>The problem</Eyebrow>
      <Headline size="lg" className="mt-4">
        Healthcare data in Africa doesn&apos;t flow.
      </Headline>
      <Sub>
        Every consequential moment in care depends on data moving between
        systems. Today, in most of Africa, that movement fails.
      </Sub>

      <div className="mt-12 grid md:grid-cols-3 gap-5">
        {stats.map((s) => (
          <div
            key={s.caption}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7"
          >
            <p className="font-display text-[64px] md:text-[72px] leading-[1] tracking-[-0.03em] text-accent-green font-medium">
              {s.number}
            </p>
            <p className="mt-5 text-[15px] text-white/85 leading-[1.5]">
              {s.caption}
            </p>
            <p className="mt-3 text-[13px] text-accent-mint italic">
              {s.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 3: Vision (light tone) ──────────────────────────── */

function Vision() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow tone="light">Vision</Eyebrow>
      <Headline tone="light" size="xl" className="mt-6">
        Health data should move the way money does.
      </Headline>
      <div className="mt-12 max-w-[680px] space-y-5">
        <p className="text-[18px] md:text-[19px] leading-[1.65] text-accent-ink/70">
          The internet learned to move information. Fintech learned to move
          money. Healthcare in Africa hasn&apos;t yet learned to move its own
          data — coverage, records, payments, and referrals — between the
          systems that need it.
        </p>
        <p className="text-[20px] md:text-[22px] leading-[1.4] font-medium text-accent-emerald">
          Pierflow is the missing infrastructure layer.
        </p>
        <p className="text-[13px] uppercase tracking-[0.22em] text-accent-ink/45 font-medium pt-4">
          Neutral · Standards-aligned · AI-native by default
        </p>
      </div>
    </div>
  );
}

/* ── Slide 4: Solution ─────────────────────────────────────── */

function Solution() {
  const left = [
    { label: "HMOs & Insurers", icon: <ShieldCheck size={14} /> },
    { label: "Hospitals & Clinics", icon: <Building2 size={14} /> },
    { label: "Fintechs & Banks", icon: <Banknote size={14} /> },
    { label: "HR & Payroll Platforms", icon: <Smartphone size={14} /> },
  ];
  const right = [
    { label: "Coverage & Enrollment", icon: <ShieldCheck size={14} /> },
    { label: "Records & FHIR Data", icon: <FileText size={14} /> },
    { label: "Claims & Payments", icon: <Banknote size={14} /> },
    { label: "Intelligence & Scores", icon: <Brain size={14} /> },
  ];
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>The solution</Eyebrow>
      <Headline size="lg" className="mt-4">
        One API. Every player connected.
      </Headline>

      <div className="mt-12 grid lg:grid-cols-[1fr,auto,1fr] gap-8 items-stretch">
        <ul className="space-y-2">
          {left.map((x) => (
            <li
              key={x.label}
              className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
            >
              <span className="w-7 h-7 rounded-md bg-accent-green/10 text-accent-green grid place-items-center shrink-0">
                {x.icon}
              </span>
              <span className="text-[14px] text-white/85">{x.label}</span>
            </li>
          ))}
        </ul>

        <div className="self-center">
          <div className="hidden lg:flex h-full items-center px-4">
            <ArrowRight size={20} className="text-accent-green/70" />
          </div>
        </div>

        <ul className="space-y-2">
          {right.map((x) => (
            <li
              key={x.label}
              className="flex items-center gap-3 rounded-xl border border-accent-green/30 bg-accent-green/[0.06] px-4 py-3"
            >
              <span className="w-7 h-7 rounded-md bg-accent-green/20 text-accent-green grid place-items-center shrink-0">
                {x.icon}
              </span>
              <span className="text-[14px] text-white">{x.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-accent-teal/20 border border-accent-green/30 text-accent-green text-[13px] font-medium">
          <Network size={14} />
          Pierflow connectivity layer
        </div>
        <p className="mt-6 text-[14px] text-white/55 italic">
          You build the experience. Pierflow moves the data.
        </p>
      </div>
    </div>
  );
}

/* ── Slide 5: Platform (four capabilities) ────────────────── */

function Platform() {
  const caps = [
    {
      icon: <FileText size={16} />,
      title: "Records API",
      kicker: "Paper → FHIR R4",
      body: "AI converts physical patient records into validated FHIR R4 bundles any EMR or HMS can import.",
      snippet: "GET /v1/organizations/:id/patients",
    },
    {
      icon: <Network size={16} />,
      title: "Insurance Distribution",
      kicker: "Embedded coverage",
      body: "HMO plans distributed inside fintechs, banks, and super-apps via one API. Enrollment + collections handled.",
      snippet: "POST /v1/enrollment/create",
    },
    {
      icon: <Brain size={16} />,
      title: "Intelligence",
      kicker: "Inline AI scoring",
      body: "Fraud, eligibility, and lapse-risk scores returned inline on every response. Auditable end-to-end.",
      snippet: "fraud_score: 0.04",
    },
    {
      icon: <KeyRound size={16} />,
      title: "Identity & Connectivity",
      kicker: "Verified in milliseconds",
      body: "BVN, NIN, biometric, and historical signal fused into identity_confidence. Prebuilt integrations everywhere.",
      snippet: "identity_confidence: 0.97",
    },
  ];
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>The platform</Eyebrow>
      <Headline size="lg" className="mt-4">
        Four capabilities. One canonical API.
      </Headline>

      <div className="mt-10 grid md:grid-cols-2 gap-4">
        {caps.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-accent-green/10 text-accent-green grid place-items-center">
                {c.icon}
              </span>
              <div>
                <p className="text-[15px] font-medium text-white">{c.title}</p>
                <p className="text-[12px] text-accent-mint">{c.kicker}</p>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] text-white/70 leading-[1.6]">
              {c.body}
            </p>
            <code className="mt-4 inline-block text-[12px] font-mono text-textd-tealish bg-black/40 border border-white/[0.06] rounded-md px-2.5 py-1.5">
              {c.snippet}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 6: Records API deep-dive ────────────────────────── */

function RecordsApi() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>Records API</Eyebrow>
      <Headline size="lg" className="mt-4">
        Paper records to FHIR R4. In one API call.
      </Headline>
      <Sub>
        The biggest barrier to EMR / HMS adoption in Nigeria is not software
        — it&apos;s decades of physical patient records that cannot migrate.
        The Pierflow Records API removes that barrier.
      </Sub>

      <div className="mt-10 grid lg:grid-cols-[0.95fr,1.05fr] gap-8 items-start">
        <div>
          <div className="grid grid-cols-3 gap-3">
            <Stat number="Thousands" caption="records / day throughput" />
            <Stat number="FHIR R4" caption="compliant output" />
            <Stat number="> 0.9" caption="auto-approval confidence" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-white/65">
            {[
              "Scan / photograph",
              "AI extract",
              "FHIR R4 map",
              "Human review",
              "Import package",
            ].map((step, i) => (
              <span key={step} className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  <span className="text-[10px] text-accent-green font-mono">
                    {i + 1}
                  </span>
                  {step}
                </span>
                {i < 4 ? (
                  <ArrowRight size={11} className="text-white/35" />
                ) : null}
              </span>
            ))}
          </div>

          <p className="mt-6 text-[12.5px] leading-[1.65] text-white/55">
            Same pipeline supports Pierflow-operated capture (for hospitals
            without digital infrastructure) and partner-direct ingest (for
            EMR vendors with their own scanning operations). Webhooks fire on{" "}
            <code className="text-accent-mint">processing_job.completed</code>{" "}
            and{" "}
            <code className="text-accent-mint">import_package.ready</code>.
          </p>
        </div>

        <CodeBlock language="FHIR R4" filename="GET /v1/.../fhir">
{`{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    { "resource": {
      "resourceType": "Patient",
      "id": "pat_b3f9c21a",
      "identifier": [
        { "system": "https://healthos.ng/mrn/",
          "value": "LH-00143" }
      ],
      "name": "Adaeze Nwosu",
      "birthDate": "1985-03-14",
      "gender": "female"
    }},
    { "resource": {
      "resourceType": "Observation",
      "code": { "coding": [
        { "system": "http://loinc.org",
          "code": "8480-6" }
      ]},
      "valueQuantity":
        { "value": 132, "unit": "mmHg" }
    }}
  ]
}`}
        </CodeBlock>
      </div>
    </div>
  );
}

function Stat({ number, caption }: { number: string; caption: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
      <p className="font-display text-[24px] leading-[1.05] tracking-[-0.02em] text-accent-green font-medium">
        {number}
      </p>
      <p className="mt-2 text-[11.5px] text-white/65 leading-[1.4]">
        {caption}
      </p>
    </div>
  );
}

/* ── Slide 7: SDG impact ──────────────────────────────────── */

function Impact() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>Impact</Eyebrow>
      <Headline size="lg" className="mt-4">
        Connectivity is a public-health lever.
      </Headline>
      <Sub>
        Pierflow is a B2B layer, but the data it moves is the substrate of
        care. Two of the UN Sustainable Development Goals map directly to
        outcomes we can attribute and measure.
      </Sub>

      <div className="mt-10 grid md:grid-cols-2 gap-5">
        <SdgCard
          tag="SDG 3"
          tagColor="#4C9F38"
          icon={<Heart size={18} />}
          title="Good Health and Well-being"
          lever="Records API + Intelligence"
          how="Bringing 12+ years of paper history into the EMR on day one of a hospital go-live closes the most consequential gap in continuity of care: clinicians make better decisions when they have history, not guesses. Lab and prescription history travel with the patient when they switch facilities."
          measures={[
            "Records digitised per hospital go-live",
            "Reduction in duplicate diagnostic tests across linked facilities",
            "Time to retrieve a patient's prior history (paper baseline vs. Pierflow API)",
          ]}
        />
        <SdgCard
          tag="SDG 10"
          tagColor="#DD1367"
          icon={<Scale size={18} />}
          title="Reduced Inequalities"
          lever="Insurance Distribution + Identity"
          how="95% of Nigerians are uninsured. The cost of acquiring them inside a standalone HMO journey is prohibitive. Embedding coverage where they already are — banking apps, savings products, payroll — collapses acquisition cost and brings care within reach of people the formal system has never served."
          measures={[
            "New HMO members enrolled via embedded distribution",
            "Average premium for plans distributed through Pierflow vs. retail HMO",
            "Geographic coverage: % of LGAs with at least one connected provider",
          ]}
        />
      </div>
    </div>
  );
}

function SdgCard({
  tag,
  tagColor,
  icon,
  title,
  lever,
  how,
  measures,
}: {
  tag: string;
  tagColor: string;
  icon: React.ReactNode;
  title: string;
  lever: string;
  how: string;
  measures: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.18em] font-medium px-2 py-1 rounded-md text-white"
          style={{ background: tagColor }}
        >
          {tag}
        </span>
        <span className="w-7 h-7 rounded-md bg-accent-green/10 text-accent-green grid place-items-center">
          {icon}
        </span>
      </div>
      <h3 className="mt-4 font-display text-[22px] leading-[1.2] tracking-[-0.01em] text-white font-medium">
        {title}
      </h3>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-accent-mint font-medium">
        Pierflow lever — {lever}
      </p>
      <p className="mt-4 text-[13px] text-white/70 leading-[1.65]">{how}</p>
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 font-medium mb-2">
          How we measure it
        </p>
        <ul className="space-y-1.5">
          {measures.map((m) => (
            <li
              key={m}
              className="flex items-start gap-2 text-[12px] text-white/65 leading-[1.55]"
            >
              <CheckCircle2
                size={11}
                className="text-accent-green mt-[3px] shrink-0"
              />
              {m}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Slide 8: Market & traction ───────────────────────────── */

function Market() {
  const stats = [
    { number: "$25B+", caption: "Nigeria healthcare market (2025)" },
    { number: "220M+", caption: "Nigerians without digital health records" },
    { number: "< 5%", caption: "health insurance penetration rate" },
    { number: "50K+", caption: "healthcare facilities in Nigeria" },
  ];
  const partners = [
    {
      name: "LinkHMS",
      body: "Active partnership — digitisation pilot for multiple hospital clients.",
    },
    {
      name: "Healthcare Federation of Nigeria",
      body: "Ecosystem partnership conversation initiated at WHX 2026.",
    },
    {
      name: "Nigeria Health Watch",
      body: "Data partnership + invited to NHW Abuja Hackathon, July 2026.",
    },
    {
      name: "Africa Health-Tech Accelerator",
      body: "Applied — co-hosted by Africa CDC.",
    },
    {
      name: "SANeForce · GE Healthcare · SYNLAB",
      body: "Active partnership conversations, World Health Expo Lagos.",
    },
  ];
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>Market & traction</Eyebrow>
      <Headline size="lg" className="mt-4">
        A $25B+ market with no connectivity infrastructure.
      </Headline>

      <div className="mt-10 grid lg:grid-cols-[0.9fr,1.1fr] gap-8">
        <ul className="space-y-3">
          {stats.map((s) => (
            <li
              key={s.caption}
              className="border-l-2 border-accent-green pl-5 py-1"
            >
              <p className="font-display text-[34px] leading-[1.05] tracking-[-0.02em] text-accent-green font-medium">
                {s.number}
              </p>
              <p className="mt-1 text-[13px] text-white/70">{s.caption}</p>
            </li>
          ))}
        </ul>

        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-white/45 font-medium mb-3">
            Early traction
          </p>
          <ul className="space-y-2">
            {partners.map((p) => (
              <li
                key={p.name}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 flex items-start gap-3"
              >
                <CheckCircle2
                  size={14}
                  className="text-accent-green mt-1 shrink-0"
                />
                <div>
                  <p className="text-[13.5px] font-medium text-white">
                    {p.name}
                  </p>
                  <p className="text-[12px] text-white/65 leading-[1.55] mt-0.5">
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Slide 9: Why now / why us ────────────────────────────── */

function WhyNow() {
  const reasons = [
    {
      icon: <TrendingUp size={16} />,
      title: "EMR adoption is past the inflection",
      body: "Lagos, Abuja, and Port Harcourt hospitals are buying clinical software at a rate that didn't exist three years ago. Every new buyer hits the paper-history wall on month one.",
    },
    {
      icon: <Network size={16} />,
      title: "FHIR R4 is now the de facto standard",
      body: "Government tenders, donor-funded programs, and EMR vendors are converging on FHIR R4. The cost of speaking it natively used to be prohibitive — that changed.",
    },
    {
      icon: <Sparkles size={16} />,
      title: "Multimodal AI just became accurate enough",
      body: "Frontier vision models can now extract handwritten clinical notes at a confidence level that displaces double-key entry. Our extraction layer runs on Anthropic Claude with prompt caching to keep cost per page near zero.",
    },
    {
      icon: <Webhook size={16} />,
      title: "Connectivity is a category — and it's empty",
      body: "Nigeria has Flutterwave for money, Mono for accounts, Termii for messaging. There is no equivalent for health data. The first credible team to ship the standard wins distribution.",
    },
  ];
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>Why now · why us</Eyebrow>
      <Headline size="lg" className="mt-4">
        The window is small and we&apos;re inside it.
      </Headline>
      <Sub>
        Four conditions had to be true at once. They are now.
      </Sub>

      <div className="mt-10 grid md:grid-cols-2 gap-4">
        {reasons.map((r) => (
          <div
            key={r.title}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-accent-green/10 text-accent-green grid place-items-center">
                {r.icon}
              </span>
              <p className="text-[15px] font-medium text-white">{r.title}</p>
            </div>
            <p className="mt-4 text-[13.5px] text-white/70 leading-[1.65]">
              {r.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 10: The ask ────────────────────────────────────── */

function Ask() {
  const blocks = [
    {
      title: "Partner",
      body: "HMOs, hospitals, fintechs, and EMR / HMS vendors — join the connectivity layer. API access within 24 hours of approval.",
      cta: "pierflow.com/get-started",
    },
    {
      title: "Invest",
      body: "We're building the standard for a $25B+ healthcare market with no existing connectivity layer. Long horizon, defensible position.",
      cta: "hello@pierflow.com",
    },
    {
      title: "Accelerate",
      body: "Mentors, ecosystem access, and grant capital that helps us scale across Nigeria and West Africa.",
      cta: "hello@pierflow.com",
    },
  ];
  return (
    <div className="max-w-[1100px] mx-auto">
      <Eyebrow>The ask</Eyebrow>
      <Headline size="lg" className="mt-4">
        Build with Pierflow.
      </Headline>
      <Sub>
        We&apos;re raising and partnering to scale Nigeria&apos;s healthcare
        connectivity infrastructure, then expand across West Africa.
      </Sub>

      <div className="mt-10 grid md:grid-cols-3 gap-4">
        {blocks.map((b, i) => (
          <div
            key={b.title}
            className={`rounded-2xl border p-6 ${
              i === 1
                ? "border-accent-green/40 bg-accent-green/[0.06]"
                : "border-white/[0.08] bg-white/[0.02]"
            }`}
          >
            <p
              className={`text-[18px] font-display font-medium tracking-[-0.01em] ${
                i === 1 ? "text-accent-green" : "text-accent-mint"
              }`}
            >
              {b.title}
            </p>
            <p className="mt-3 text-[13px] text-white/75 leading-[1.65]">
              {b.body}
            </p>
            <p className="mt-5 text-[11.5px] font-mono text-white/55 inline-flex items-center gap-1.5">
              <ArrowRight size={11} className="text-accent-green" />
              {b.cta}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-14 flex items-center justify-between flex-wrap gap-4 pt-6 border-t border-white/[0.06]">
        <Logo variant="light" size="md" />
        <div className="text-[12px] text-white/55 flex items-center gap-4">
          <span>pierflow.com</span>
          <span className="opacity-30">·</span>
          <span>hello@pierflow.com</span>
          <span className="opacity-30">·</span>
          <span>Built in Lagos · Made for Africa</span>
        </div>
      </div>
    </div>
  );
}
