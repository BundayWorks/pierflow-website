import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getNetworkProviderDetail } from "../actions";
import NetworkProviderForm from "../new/NetworkProviderForm";

export const dynamic = "force-dynamic";

export default async function NetworkProviderDetailPage({
  params,
}: {
  params: { providerId: string };
}) {
  const provider = await getNetworkProviderDetail(params.providerId);
  if (!provider) notFound();

  return (
    <div>
      <Link
        href="/portal/cover/network"
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> Network
      </Link>
      <div className="mt-4">
        <h1 className="text-[22px] font-semibold text-accent-ink">
          {provider.name}
        </h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Edit this network provider&apos;s details.
        </p>
      </div>
      <div className="mt-8">
        <NetworkProviderForm mode="edit" initial={provider} />
      </div>
    </div>
  );
}
