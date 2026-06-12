"use client";

import { useState } from "react";
import type { EligibilityResult } from "../actions";
import { checkEligibilityAction } from "./actions";

export default function EligibilityClient() {
  const [identifier, setIdentifier] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);

  async function handleCheck() {
    if (!identifier.trim()) return;
    setChecking(true);
    const r = await checkEligibilityAction(identifier);
    setResult(r);
    setChecking(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-accent-ink">
          Eligibility Check
        </h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Verify a member&apos;s coverage eligibility by enrollment ID or HMO
          member ID
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Enrollment ID or HMO Member ID"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          className="px-4 py-2 border border-black/10 rounded-md text-[14px] w-80 focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
        />
        <button
          onClick={handleCheck}
          disabled={checking || !identifier.trim()}
          className="px-5 py-2 text-[14px] font-medium rounded-md bg-accent-emerald text-white hover:bg-accent-emerald/90 disabled:opacity-50"
        >
          {checking ? "Checking..." : "Check"}
        </button>
      </div>

      {result && (
        <div className="rounded-lg border border-black/[0.06] p-6 bg-white space-y-4 max-w-xl">
          {/* Eligibility status */}
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                result.eligible ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-[16px] font-semibold text-accent-ink">
              {result.eligible ? "Eligible" : "Not Eligible"}
            </span>
          </div>

          {result.enrollment ? (
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-accent-ink/60">Name</span>
                <span className="font-medium text-accent-ink">
                  {result.enrollment.fullName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent-ink/60">Plan</span>
                <span className="text-accent-ink">
                  {result.enrollment.planName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent-ink/60">Status</span>
                <span
                  className={`font-medium ${
                    result.enrollment.status === "ACTIVE"
                      ? "text-emerald-700"
                      : "text-red-600"
                  }`}
                >
                  {result.enrollment.status}
                </span>
              </div>
              {result.enrollment.effectiveFrom && (
                <div className="flex justify-between">
                  <span className="text-accent-ink/60">Effective</span>
                  <span className="text-accent-ink/70 text-[13px]">
                    {new Date(
                      result.enrollment.effectiveFrom,
                    ).toLocaleDateString()}
                    {result.enrollment.effectiveTo
                      ? ` → ${new Date(result.enrollment.effectiveTo).toLocaleDateString()}`
                      : " → ongoing"}
                  </span>
                </div>
              )}

              {/* Coverage breakdown */}
              {result.coverageSummary && (
                <div className="mt-4 pt-4 border-t border-black/[0.06]">
                  <p className="text-[13px] font-medium text-accent-ink/70 mb-2">
                    Coverage Details
                  </p>
                  <div className="space-y-1">
                    {Object.entries(result.coverageSummary).map(
                      ([key, value]) => {
                        const detail = value as Record<string, unknown>;
                        const covered = detail?.covered !== false;
                        return (
                          <div
                            key={key}
                            className="flex justify-between text-[13px]"
                          >
                            <span className="text-accent-ink/60 capitalize">
                              {key.replace(/_/g, " ")}
                            </span>
                            <span
                              className={
                                covered ? "text-emerald-600" : "text-red-500"
                              }
                            >
                              {covered ? "Covered" : "Not covered"}
                              {typeof detail?.limit === "number"
                                ? ` (limit: ${detail.limit.toLocaleString()})`
                                : ""}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[14px] text-accent-ink/50">
              No enrollment found for this identifier.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
