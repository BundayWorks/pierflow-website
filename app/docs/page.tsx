import {
  Rocket,
  TerminalSquare,
  ShieldCheck,
  Webhook,
  Sparkles,
  BookOpen,
  Boxes,
  FileText,
} from "lucide-react";
import Link from "next/link";
import {
  DocPageHeader,
  H2,
  Lead,
  KVTable,
  FieldCardList,
  FieldCard,
  CtaRow,
  Callout,
} from "@/components/docs/primitives";

const HUB = [
  {
    icon: Rocket,
    title: "Quickstart",
    desc: "From sandbox keys to your first policy in under 10 minutes.",
    href: "/docs/quickstart/introduction",
  },
  {
    icon: TerminalSquare,
    title: "API reference",
    desc: "Every endpoint, every shape, with copy-paste examples.",
    href: "/docs/api/overview",
  },
  {
    icon: FileText,
    title: "Records API",
    desc: "Turn paper records into FHIR R4 bundles for any EMR or HMS.",
    href: "/docs/records/overview",
  },
  {
    icon: Boxes,
    title: "Data standards",
    desc: "The Universal Plan Schema and FHIR R4 mappings.",
    href: "/docs/data-standards/plan-schema",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    desc: "Durable, signed events for every meaningful state change.",
    href: "/docs/webhooks",
  },
  {
    icon: Sparkles,
    title: "AI layer",
    desc: "Inline fraud, identity, lapse, and value scoring.",
    href: "/docs/ai-layer",
  },
  {
    icon: ShieldCheck,
    title: "Security & NDPR",
    desc: "Encryption, RBAC, PHI isolation, and compliance posture.",
    href: "/docs/security",
  },
];

export default function DocsHome() {
  return (
    <article>
      <DocPageHeader
        eyebrow="Welcome"
        title="Welcome to the Pierflow Docs"
        description="Here you'll find guides, references, and examples to build with Pierflow — the connectivity layer for healthcare in Africa. One canonical API across HMOs, hospitals, pharmacies, fintechs, HR platforms, and government programmes."
      />

      <CtaRow
        items={[
          {
            label: "Quickstart",
            href: "/docs/quickstart/introduction",
            icon: <Rocket size={14} />,
          },
          {
            label: "API reference",
            href: "/docs/api/overview",
            icon: <TerminalSquare size={14} />,
          },
          {
            label: "Get started",
            href: "/get-started",
            icon: <BookOpen size={14} />,
          },
        ]}
      />

      <Callout kind="tip" title="New here?">
        Start with the{" "}
        <Link href="/docs/quickstart/introduction">Quickstart</Link> — five short
        pages that take you from API key to a live policy with AI scoring
        inline.
      </Callout>

      <H2 id="explore">Explore the docs</H2>
      <div className="not-prose my-6 grid sm:grid-cols-2 gap-4">
        {HUB.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-black/[0.08] p-5 hover:border-black/25 transition-colors bg-white"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-accent-teal-light grid place-items-center text-accent-emerald">
                  <Icon size={18} />
                </span>
                <h3 className="text-[15px] font-medium text-accent-ink">
                  {card.title}
                </h3>
              </div>
              <p className="mt-3 text-[13px] leading-[1.6] text-accent-ink/65">
                {card.desc}
              </p>
            </Link>
          );
        })}
      </div>

      <H2 id="environments">Environments and keys</H2>
      <Lead>
        You&apos;ll work in two environments — sandbox first, then production —
        with separate keys and base URLs for each.
      </Lead>
      <KVTable
        headers={["Environment", "Base URL"]}
        rows={[
          ["Sandbox", "https://sandbox.api.pierflow.com/v1/"],
          ["Production", "https://api.pierflow.com/v1/"],
        ]}
      />

      <H2 id="key-types">Your API keys</H2>
      <FieldCardList>
        <FieldCard
          name="client_id"
          type="string"
          description="Public identifier for your tenant. Safe to embed in front-end builds."
        />
        <FieldCard
          name="client_secret"
          type="string"
          required
          description="Private credential used in OAuth client-credentials and key rotation flows."
        />
        <FieldCard
          name="pf_live_sk_… / pf_test_sk_…"
          type="API key"
          required
          description="Secret API keys for server-to-server calls. One per environment."
        />
      </FieldCardList>

      <H2 id="developer-community">Developer community</H2>
      <Lead>
        For questions, RFCs, and roadmap previews, email{" "}
        <a
          href="mailto:pierflowllc@gmail.com"
          className="text-accent-emerald underline"
        >
          pierflowllc@gmail.com
        </a>
        . Public Slack and GitHub community are launching soon.
      </Lead>
    </article>
  );
}
