import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getHmoProviderBySlug } from "../../actions";
import { listMappingsAction } from "./actions";
import MappingWizardClient from "./MappingWizardClient";

export const dynamic = "force-dynamic";

export default async function MappingPage({
  params,
}: {
  params: { slug: string };
}) {
  const provider = await getHmoProviderBySlug(params.slug);
  if (!provider) notFound();

  const mappings = await listMappingsAction(provider.id);

  return (
    <div>
      <Link
        href={`/portal/hmo-providers/${provider.slug}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> {provider.displayName}
      </Link>

      <h1 className="mt-4 font-display text-[28px] md:text-[36px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Plan mapping
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[720px]">
        Paste one native plan from {provider.displayName}&apos;s system.
        Haiku proposes a translation into Pierflow&apos;s Universal Plan
        Schema; you confirm. Once a mapping is ACTIVE, the catalogue ingest
        endpoint accepts native payloads ({" "}
        <code className="font-mono text-[12px]">{"format: \"native\""}</code>)
        and translates them at write time.
      </p>

      <MappingWizardClient
        providerId={provider.id}
        slug={provider.slug}
        mappings={mappings.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          activatedAt: m.activatedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
