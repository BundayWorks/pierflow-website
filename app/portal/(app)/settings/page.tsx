import { listPartnerLinks } from "./actions";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const links = await listPartnerLinks();
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Settings
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Partner access
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Create the partners — EMR / HMS vendors, payers, downstream
        systems — that pull validated records from your organization, and
        issue them API keys.
      </p>
      <SettingsClient
        partners={links.map((l) => ({
          id: l.partner.id,
          name: l.partner.name,
          slug: l.partner.slug,
          type: l.partner.type,
          isActive: l.partner.isActive,
          keys: l.partner.apiKeys.map((k) => ({
            id: k.id,
            label: k.label,
            last4: k.last4,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          })),
        }))}
      />
    </div>
  );
}
