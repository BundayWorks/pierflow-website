"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { activateContractAction } from "../actions";

export default function ActivateButton({
  contractId,
  slug,
}: {
  contractId: string;
  slug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function activate() {
    startTransition(async () => {
      await activateContractAction(contractId, slug);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={activate}
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent-ink text-white text-[13px] font-medium disabled:opacity-50 shrink-0"
    >
      <ArrowRight size={14} />
      {pending ? "Activating…" : "Activate contract"}
    </button>
  );
}
