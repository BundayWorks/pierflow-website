import { getHmoNetwork } from "./actions";
import HmoNetworkClient from "./HmoNetworkClient";

export const metadata = { title: "HMO Network — Pierflow" };

export default async function HmoNetworkPage() {
  const hmos = await getHmoNetwork();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-accent-ink">
          HMO Network
        </h1>
        <p className="text-[13px] text-accent-ink/55 mt-1 max-w-xl">
          These are the HMOs Pierflow has active integrations with. Enable the
          ones you want to distribute — your API key will then return their
          plans and accept enrollments. The rate shown is what you earn per
          enrolled member every billing cycle.
        </p>
      </div>

      <HmoNetworkClient initialHmos={hmos} />
    </div>
  );
}
