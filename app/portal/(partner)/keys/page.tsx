import { requirePartnerUser } from "@/lib/auth";
import { listMyApiKeys } from "./actions";
import KeysClient from "./KeysClient";

export const dynamic = "force-dynamic";

export default async function PartnerKeysPage() {
  const [{ partner }, keys] = await Promise.all([
    requirePartnerUser(),
    listMyApiKeys(),
  ]);

  const canCreate =
    partner.accessStatus === "SANDBOX" ||
    partner.accessStatus === "PRODUCTION_REQUESTED" ||
    partner.accessStatus === "PRODUCTION";

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Credentials
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        API keys
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Use these keys to authenticate requests to the Pierflow Records API.
        Keep them server-side — they shouldn&apos;t be embedded in mobile or
        browser code. We only show the full key once, at the moment of
        creation. Revoke any key you suspect has leaked.
      </p>
      <div className="mt-8">
        <KeysClient
          initialKeys={keys}
          canCreate={canCreate}
          accessStatus={partner.accessStatus}
        />
      </div>
    </div>
  );
}
