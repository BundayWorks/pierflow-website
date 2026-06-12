"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SettlementConfig } from "./actions";
import { updateSettlementAction } from "./actions";

export default function SettlementConfigClient({
  config,
}: {
  config: SettlementConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [mode, setMode] = useState(config.defaultSettlementMode);
  const [bankName, setBankName] = useState(config.settlementBankName ?? "");
  const [bankAccount, setBankAccount] = useState(config.settlementBankAccount ?? "");
  const [bankCode, setBankCode] = useState(config.settlementBankCode ?? "");

  function handleSubmit() {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const res = await updateSettlementAction({
        defaultSettlementMode: mode,
        settlementBankName: bankName,
        settlementBankAccount: bankAccount,
        settlementBankCode: bankCode,
      });
      if (!res.ok) {
        setError(res.reason);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Default mode */}
      <div className="rounded-xl border border-black/[0.08] p-5 space-y-4">
        <h2 className="text-[14px] font-semibold text-accent-ink">
          Default Settlement Mode
        </h2>
        <p className="text-[13px] text-accent-ink/55">
          Choose how premiums collected by fintechs are settled to you.
        </p>

        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-black/[0.08] cursor-pointer hover:bg-black/[0.01]">
            <input
              type="radio"
              name="mode"
              value="IN_FINTECH_ACCOUNT"
              checked={mode === "IN_FINTECH_ACCOUNT"}
              onChange={() => setMode("IN_FINTECH_ACCOUNT")}
              className="mt-0.5"
            />
            <div>
              <p className="text-[13px] font-medium text-accent-ink">
                In Fintech Account
              </p>
              <p className="text-[12px] text-accent-ink/50 mt-0.5">
                Premiums stay in the fintech&apos;s account. Settlement is
                handled between you and the fintech directly.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-black/[0.08] cursor-pointer hover:bg-black/[0.01]">
            <input
              type="radio"
              name="mode"
              value="EXTERNAL_BANK_SWEEP"
              checked={mode === "EXTERNAL_BANK_SWEEP"}
              onChange={() => setMode("EXTERNAL_BANK_SWEEP")}
              className="mt-0.5"
            />
            <div>
              <p className="text-[13px] font-medium text-accent-ink">
                External Bank Sweep
              </p>
              <p className="text-[12px] text-accent-ink/50 mt-0.5">
                Pierflow sweeps premiums to your bank account on a schedule.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Bank details — only shown for EXTERNAL_BANK_SWEEP */}
      {mode === "EXTERNAL_BANK_SWEEP" && (
        <div className="rounded-xl border border-black/[0.08] p-5 space-y-4">
          <h2 className="text-[14px] font-semibold text-accent-ink">
            Bank Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-accent-ink/65 font-medium mb-1">
                Bank name <span className="text-[#a83232]">*</span>
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="First Bank"
                className="w-full px-3 py-2 border border-black/10 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
              />
            </div>
            <div>
              <label className="block text-[12px] text-accent-ink/65 font-medium mb-1">
                Bank code <span className="text-[#a83232]">*</span>
              </label>
              <input
                type="text"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                placeholder="011"
                className="w-full px-3 py-2 border border-black/10 rounded-md text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
              />
              <p className="text-[11px] text-accent-ink/45 mt-0.5">
                CBN bank code
              </p>
            </div>
          </div>
          <div>
            <label className="block text-[12px] text-accent-ink/65 font-medium mb-1">
              Account number <span className="text-[#a83232]">*</span>
            </label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="0123456789"
              className="w-full max-w-xs px-3 py-2 border border-black/10 rounded-md text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
            />
          </div>
        </div>
      )}

      {/* Per-fintech overrides (read-only) */}
      {config.channelOverrides.length > 0 && (
        <div className="rounded-xl border border-black/[0.08] p-5 space-y-4">
          <h2 className="text-[14px] font-semibold text-accent-ink">
            Per-Fintech Overrides
          </h2>
          <p className="text-[13px] text-accent-ink/55">
            Custom settlement terms per fintech channel. Managed by Pierflow.
          </p>
          <div className="rounded-lg border border-black/[0.06] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-black/[0.03] text-accent-ink/55 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Fintech</th>
                  <th className="text-left px-4 py-2 font-medium">Mode</th>
                  <th className="text-left px-4 py-2 font-medium">Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {config.channelOverrides.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2.5 font-medium text-accent-ink">
                      {o.partnerName}
                    </td>
                    <td className="px-4 py-2.5 text-accent-ink/65">
                      {o.settlementMode?.replace(/_/g, " ") ?? "Inherits default"}
                    </td>
                    <td className="px-4 py-2.5 text-accent-ink/50 font-mono text-[12px]">
                      {o.settlementBankName
                        ? `${o.settlementBankName} — ${o.settlementBankAccount ?? "—"}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feedback */}
      {error && (
        <p className="text-[13px] text-[#a83232] rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-4 py-3">
          {error}
        </p>
      )}
      {success && (
        <p className="text-[13px] text-emerald-700 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          Settlement config updated.
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={pending}
          className="px-6 py-2.5 rounded-md bg-accent-emerald text-white text-[14px] font-medium hover:bg-accent-emerald/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
