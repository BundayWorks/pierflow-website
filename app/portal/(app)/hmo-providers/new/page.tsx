import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewProviderForm from "./NewProviderForm";

export const dynamic = "force-dynamic";

export default function NewHmoProviderPage() {
  return (
    <div className="max-w-[640px]">
      <Link
        href="/portal/hmo-providers"
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> HMO providers
      </Link>
      <h1 className="mt-4 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Register HMO
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65">
        Creates an Organization (type INSURER) and an HmoProvider row linked
        1:1. The provider starts PENDING — activate it after a contract is
        captured and the first plans are in the catalogue.
      </p>

      <div className="mt-8">
        <NewProviderForm />
      </div>
    </div>
  );
}
