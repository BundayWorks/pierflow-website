import { requirePartnerUser } from "@/lib/auth";
import { listMyEndpoints } from "./actions";
import WebhooksClient from "./WebhooksClient";

export const dynamic = "force-dynamic";

export default async function PartnerWebhooksPage() {
  const [{ partner }, endpoints] = await Promise.all([
    requirePartnerUser(),
    listMyEndpoints(),
  ]);

  const canRegister =
    partner.accessStatus === "SANDBOX" || partner.accessStatus === "PRODUCTION";

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Realtime delivery
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Webhooks
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Register an HTTPS endpoint to receive events when jobs complete and
        when import packages become ready. We sign every payload with{" "}
        <code className="text-[13px]">HMAC-SHA256</code> so you can verify
        delivery hasn&apos;t been tampered with.
      </p>
      <div className="mt-8">
        <WebhooksClient
          initialEndpoints={endpoints.map((e) => ({
            id: e.id,
            url: e.url,
            events: e.events,
            isActive: e.isActive,
            createdAt: e.createdAt.toISOString(),
          }))}
          canRegister={canRegister}
        />
      </div>
    </div>
  );
}
