"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Mail, Check, AlertCircle } from "lucide-react";

/**
 * Email verification widget for the partner dashboard checklist.
 *
 * Uses Clerk's client-side primitives because the backend SDK doesn't
 * have a "send verification email" method — verification is driven
 * from the signed-in user's session.
 *
 *   1. prepareVerification({ strategy: "email_code" }) sends a 6-digit
 *      code to the email address.
 *   2. attemptVerification({ code }) confirms it.
 *
 * On success we refresh the server component above us so the checklist
 * picks up the new verification status from `user.primaryEmailAddress`.
 */
export default function EmailVerification() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [phase, setPhase] = useState<"idle" | "sent" | "verifying">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isLoaded) {
    return (
      <p className="mt-4 text-[12px] text-accent-ink/55">Loading…</p>
    );
  }

  const primary = user?.primaryEmailAddress;
  if (!primary) {
    return (
      <p className="mt-4 text-[12px] text-accent-ink/55">
        No primary email address on your account. Add one in the user menu,
        top-right.
      </p>
    );
  }

  if (primary.verification?.status === "verified") {
    return (
      <p className="mt-4 text-[12px] text-accent-emerald inline-flex items-center gap-1.5">
        <Check size={13} />
        Verified — nothing more to do here.
      </p>
    );
  }

  async function handleSend() {
    if (!primary) return;
    setBusy(true);
    setError(null);
    try {
      await primary.prepareVerification({ strategy: "email_code" });
      setPhase("sent");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send code. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!primary || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await primary.attemptVerification({ code: code.trim() });
      if (result.verification?.status === "verified") {
        setPhase("idle");
        setCode("");
        // Pull fresh user state from Clerk so the next render of the
        // page reads the new "verified" status.
        await user?.reload();
        router.refresh();
      } else {
        setError("That code wasn't accepted. Double-check and try again.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to verify. Try a fresh code.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-[12px] text-accent-ink/55 leading-[1.65]">
        We&apos;ll send a 6-digit code to{" "}
        <code className="text-[12px] font-mono text-accent-ink">
          {primary.emailAddress}
        </code>
        . Enter it below to verify ownership.
      </p>

      {phase === "idle" ? (
        <button
          type="button"
          onClick={handleSend}
          disabled={busy}
          className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white disabled:opacity-40 hover:opacity-90 inline-flex items-center gap-2"
        >
          <Mail size={13} />
          {busy ? "Sending…" : "Send verification code"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              placeholder="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="text-[14px] font-mono tracking-[0.3em] rounded-md border border-black/[0.12] bg-white px-3 py-2.5 w-[180px] focus:outline-none focus:border-accent-emerald/60"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy || code.length !== 6}
              className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white disabled:opacity-40 hover:opacity-90"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            className="text-[11px] text-accent-ink/55 hover:text-accent-ink"
          >
            Resend code
          </button>
        </div>
      )}

      {error ? (
        <p className="text-[12px] text-[#7a2222] inline-flex items-start gap-1.5">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
