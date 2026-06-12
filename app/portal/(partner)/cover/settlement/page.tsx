import { getSettlementConfig } from "./actions";
import SettlementConfigClient from "./SettlementConfigClient";

export const dynamic = "force-dynamic";

export default async function SettlementPage() {
  const config = await getSettlementConfig();

  if (!config) {
    return (
      <div className="space-y-4">
        <h1 className="text-[22px] font-semibold text-accent-ink">Settlement</h1>
        <p className="text-[14px] text-accent-ink/50">
          Unable to load settlement config. Please contact Pierflow support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-accent-ink">Settlement</h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Configure how premiums are settled to your account.
        </p>
      </div>
      <SettlementConfigClient config={config} />
    </div>
  );
}
