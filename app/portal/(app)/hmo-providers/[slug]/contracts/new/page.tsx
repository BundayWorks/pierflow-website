import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getHmoProviderBySlug } from "../../../actions";
import NewContractWizard from "./NewContractWizard";

export const dynamic = "force-dynamic";

export default async function NewContractPage({
  params,
}: {
  params: { slug: string };
}) {
  const provider = await getHmoProviderBySlug(params.slug);
  if (!provider) notFound();

  return (
    <div>
      <Link
        href={`/portal/hmo-providers/${provider.slug}/contracts`}
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> Contracts
      </Link>
      <h1 className="mt-4 font-display text-[28px] md:text-[36px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        New contract — {provider.displayName}
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[720px]">
        Capture the commercial terms. The split engine validates as you go;
        the review step previews live who-gets-what at sample amounts before
        you save.
      </p>

      <NewContractWizard slug={provider.slug} />
    </div>
  );
}
