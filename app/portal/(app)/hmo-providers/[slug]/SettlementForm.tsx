"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateSettlementAction } from "../actions";

export default function SettlementForm({
  providerId,
  defaultSettlementMode,
  settlementBankName,
  settlementBankAccount,
  settlementBankCode,
}: {
  providerId: string;
  defaultSettlementMode: "IN_FINTECH_ACCOUNT" | "EXTERNAL_BANK_SWEEP";
  settlementBankName: string | null;
  settlementBankAccount: string | null;
  settlementBankCode: string | null;
}) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState(defaultSettlementMode);
  const [bankName, setBankName] = useState(settlementBankName ?? "");
  const [account, setAccount] = useState(settlementBankAccount ?? "");
  const [code, setCode] = useState(settlementBankCode ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function save() {
    setErrors([]);
    startTransition(async () => {
      const r = await updateSettlementAction({
        providerId,
        slug: params.slug,
        defaultSettlementMode: mode,
        settlementBankName: bankName,
        settlementBankAccount: account,
        settlementBankCode: code,
      });
      if (!r.ok) {
        setErrors(r.issues);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2.5 text-[12px]">
      <label className="block">
        <span className="text-accent-ink/55">Mode</span>
        <select
          value={mode}
          onChange={(e) =>
            setMode(e.target.value as typeof defaultSettlementMode)
          }
          className="mt-1 w-full rounded-md border border-black/[0.12] px-2 py-1 text-[12px]"
        >
          <option value="IN_FINTECH_ACCOUNT">
            In-fintech account (cleanest)
          </option>
          <option value="EXTERNAL_BANK_SWEEP">External bank sweep</option>
        </select>
      </label>

      {mode === "EXTERNAL_BANK_SWEEP" ? (
        <>
          <label className="block">
            <span className="text-accent-ink/55">Bank name</span>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="GTBank"
              className="mt-1 w-full rounded-md border border-black/[0.12] px-2 py-1 text-[12px]"
            />
          </label>
          <label className="block">
            <span className="text-accent-ink/55">Account number</span>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="0123456789"
              className="mt-1 w-full rounded-md border border-black/[0.12] px-2 py-1 text-[12px] font-mono"
            />
          </label>
          <label className="block">
            <span className="text-accent-ink/55">Bank code (CBN)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="058"
              className="mt-1 w-full rounded-md border border-black/[0.12] px-2 py-1 text-[12px] font-mono"
            />
          </label>
        </>
      ) : null}

      {errors.length > 0 ? (
        <p className="text-[11px] text-[#a83232]">{errors.join(" ")}</p>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-3 py-1.5 rounded-full bg-accent-ink text-white text-[11px] font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {savedAt ? (
          <span className="text-[11px] text-accent-emerald">Saved</span>
        ) : null}
      </div>
    </div>
  );
}
