import Link from "next/link";
import {
  DocPageHeader,
  H2,
  Body,
  CtaRow,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";
import { Webhook, ShieldCheck, Sparkles, Wallet } from "lucide-react";

export default function Page() {
  const { prev, next } = neighbors("quickstart/next-steps");
  return (
    <article>
      <DocPageHeader
        eyebrow="Quickstart"
        title="Next steps"
        description="You've shipped your first policy. Here are the natural next layers to add to your integration."
      />

      <Body>
        Each of these is a self-contained guide — you can take them in any
        order based on what your product needs next.
      </Body>

      <CtaRow
        items={[
          {
            label: "Webhooks",
            href: "/docs/webhooks",
            icon: <Webhook size={14} />,
          },
          {
            label: "AI scoring",
            href: "/docs/ai-layer",
            icon: <Sparkles size={14} />,
          },
          {
            label: "Premium collection",
            href: "/docs/payments",
            icon: <Wallet size={14} />,
          },
          {
            label: "Security & NDPR",
            href: "/docs/security",
            icon: <ShieldCheck size={14} />,
          },
        ]}
      />

      <H2 id="go-to-production">Go to production</H2>
      <Body>
        When you&apos;re ready to switch from sandbox to production,{" "}
        <Link
          href="/developers/request-access"
          className="text-accent-emerald underline"
        >
          request access
        </Link>
        . We&apos;ll review your integration and provision live keys, usually
        within one business day.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
