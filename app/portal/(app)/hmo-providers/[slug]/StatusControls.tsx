"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateHmoProvider, suspendHmoProvider } from "../actions";

export default function StatusControls({
  providerId,
  status,
}: {
  providerId: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {status !== "ACTIVE" ? (
        <button
          onClick={() => run(() => activateHmoProvider(providerId))}
          disabled={pending}
          className="px-3 py-1.5 rounded-full bg-accent-ink text-white text-[12px] font-medium disabled:opacity-50"
        >
          {pending ? "Working…" : "Activate"}
        </button>
      ) : null}
      {status !== "SUSPENDED" ? (
        <button
          onClick={() => run(() => suspendHmoProvider(providerId))}
          disabled={pending}
          className="px-3 py-1.5 rounded-full border border-black/[0.12] text-accent-ink/75 text-[12px] font-medium hover:text-accent-ink disabled:opacity-50"
        >
          Suspend
        </button>
      ) : null}
    </div>
  );
}
