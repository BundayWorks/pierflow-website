"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import Progress from "@/components/onboarding/Progress";
import {
  SESSION_STORAGE_KEY,
  type OnboardingDraft,
} from "@/lib/onboarding";
import { submitSignup } from "./actions";

export default function Step3Account() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    } catch {}
    if (!raw) {
      router.replace("/get-started");
      return;
    }
    try {
      const d = JSON.parse(raw) as OnboardingDraft;
      if (!d.partnerType || !d.primaryUseCase) {
        router.replace("/get-started");
        return;
      }
      setDraft(d);
      setHydrated(true);
    } catch {
      router.replace("/get-started");
    }
  }, [router]);

  function clearDraft() {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setEmailTaken(false);
    startTransition(async () => {
      const result = await submitSignup({
        ...draft,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        company: company.trim(),
        websiteUrl: website.trim() || undefined,
        country: "NG",
        company_url: honeypot,
      });
      if (!result.ok) {
        if (result.error === "EMAIL_TAKEN") {
          setEmailTaken(true);
          return;
        }
        setError(
          result.error === "VALIDATION_ERROR"
            ? result.message
            : "Something went wrong. Try again, or email pierflowllc@gmail.com if it persists.",
        );
        return;
      }
      clearDraft();
      // The signup action sent a Clerk invitation to result.email.
      // Surface a "check your inbox" page; the user clicks the link to
      // set a password and Clerk drops them into /portal.
      router.push(
        `/get-started/welcome?email=${encodeURIComponent(result.email)}`,
      );
    });
  }

  if (!hydrated) return null;

  return (
    <div>
      <Progress step={3} labels={["You", "Fit", "Account"]} />
      <h1 className="font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Create your Pierflow account.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-accent-ink/65">
        We&apos;ll set up a partner workspace tied to your email. You can sign
        in straight after to explore the console, read the docs, and complete
        your onboarding checklist while we approve your sandbox key.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
        <Field label="Your full name" required>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            className="input"
          />
        </Field>
        <Field label="Work email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailTaken(false);
            }}
            required
            maxLength={200}
            autoComplete="email"
            className="input"
          />
          {emailTaken ? (
            <p className="mt-2 text-[12px] text-[#a83232] flex items-center gap-1.5">
              <AlertCircle size={12} />
              An account with this email already exists.{" "}
              <Link
                href="/portal"
                className="text-accent-emerald underline ml-1"
              >
                Log in instead
              </Link>
              .
            </p>
          ) : null}
        </Field>
        <Field label="Company name" required>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            minLength={2}
            maxLength={160}
            autoComplete="organization"
            className="input"
          />
        </Field>
        <Field label="Company website (optional)">
          <input
            type="text"
            placeholder="https://"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={300}
            autoComplete="url"
            className="input"
          />
        </Field>

        {/* Honeypot — hidden from humans, fillable by bots. */}
        <input
          type="text"
          name="company_url"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{
            position: "absolute",
            left: "-9999px",
            width: 1,
            height: 1,
            opacity: 0,
          }}
        />

        {error ? (
          <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2.5 text-[12px] text-[#7a2222] flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        <p className="text-[12px] text-accent-ink/55 leading-[1.65]">
          By creating an account you agree to Pierflow&apos;s{" "}
          <Link href="/legal/terms" className="underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline">
            Privacy Notice
          </Link>
          .
        </p>

        <div className="mt-4 flex justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={pending}
            className="text-[13px] font-medium px-4 py-2.5 rounded-md text-accent-ink/65 hover:text-accent-ink disabled:opacity-50 inline-flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <button
            type="submit"
            disabled={pending}
            className="text-[13px] font-medium px-5 py-2.5 rounded-md bg-accent-ink text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
          >
            {pending ? "Creating account…" : "Create account"}
            {!pending && <ArrowRight size={14} />}
          </button>
        </div>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          font-size: 14px;
          border-radius: 6px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: white;
          padding: 10px 12px;
          outline: none;
        }
        :global(.input:focus) {
          border-color: rgba(13, 206, 154, 0.6);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-accent-ink mb-1.5">
        {label}{" "}
        {required ? (
          <span className="text-accent-ink/35 font-normal">·</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}
