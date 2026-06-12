import { getNetworkProviders } from "./actions";
import NetworkClient from "./NetworkClient";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const providers = await getNetworkProviders();
  return <NetworkClient providers={providers} />;
}
