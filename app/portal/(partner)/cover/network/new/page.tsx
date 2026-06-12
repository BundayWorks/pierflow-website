import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NetworkProviderForm from "./NetworkProviderForm";

export default function NewNetworkProviderPage() {
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
          Add network provider
        </h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Register a hospital, clinic, lab, or pharmacy in your network.
        </p>
      </div>
      <div className="mt-8">
        <NetworkProviderForm mode="create" />
      </div>
    </div>
  );
}
