"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

const PARTNER_TYPES = [
  { value: "EMR_VENDOR", label: "EMR vendor" },
  { value: "HMS_VENDOR", label: "HMS vendor" },
  { value: "EHR_VENDOR", label: "EHR vendor" },
  { value: "INSURER", label: "Insurer / HMO" },
  { value: "GOVERNMENT", label: "Government programme" },
  { value: "ANALYTICS", label: "Analytics" },
  { value: "OTHER", label: "Other" },
];

type FormState = {
  name: string;
  email: string;
  company: string;
  websiteUrl: string;
  useCase: string;
  expectedVolume: string;
  partnerType: string;
  // Honeypot — must remain empty for a human submission to succeed.
  company_url: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  company: "",
  websiteUrl: "",
  useCase: "",
  expectedVolume: "",
  partnerType: "OTHER",
  company_url: "",
};

export default function RequestAccessForm() {
  const [state, setState] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const update =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setState((s) => ({ ...s, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/v1/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (res.status === 202) {
        setSubmitted(true);
        return;
      }
      if (res.status === 429) {
        setError(
          "You've sent a few requests in a row — please wait an hour and try again.",
        );
        return;
      }
      const body = await res.json().catch(() => null);
      setError(
        body?.error === "VALIDATION_ERROR"
          ? "Please check the form for missing or invalid fields."
          : "Something went wrong. Please try again in a minute.",
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-accent-emerald/30 bg-card-mint p-8 text-center">
        <CheckCircle2
          size={32}
          className="text-accent-emerald mx-auto mb-3"
        />
        <h2 className="font-display text-[20px] text-accent-ink font-medium">
          Thanks — we&apos;ve received your request.
        </h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-accent-ink/70 max-w-[440px] mx-auto">
          A member of the team will review it within one business day. We&apos;ll
          send your sandbox credentials to{" "}
          <strong>{state.email}</strong> once approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="Your name"
        name="name"
        value={state.name}
        onChange={update("name")}
        required
        maxLength={120}
      />
      <Field
        label="Work email"
        name="email"
        type="email"
        value={state.email}
        onChange={update("email")}
        required
        maxLength={200}
      />
      <Field
        label="Company"
        name="company"
        value={state.company}
        onChange={update("company")}
        required
        maxLength={160}
      />
      <Field
        label="Company website"
        name="websiteUrl"
        value={state.websiteUrl}
        onChange={update("websiteUrl")}
        placeholder="https://"
        maxLength={300}
      />

      <div>
        <label
          htmlFor="partnerType"
          className="block text-[12px] font-medium text-textl-primary mb-1.5"
        >
          Type of organization
        </label>
        <select
          id="partnerType"
          name="partnerType"
          value={state.partnerType}
          onChange={update("partnerType")}
          className="w-full rounded-md border border-[#ddd] px-3 py-2.5 text-[14px] text-textl-primary bg-white focus:outline-none focus:border-accent-teal"
        >
          {PARTNER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="useCase"
          className="block text-[12px] font-medium text-textl-primary mb-1.5"
        >
          What are you building on Pierflow?
        </label>
        <textarea
          id="useCase"
          name="useCase"
          rows={5}
          required
          minLength={10}
          maxLength={4000}
          value={state.useCase}
          onChange={update("useCase")}
          placeholder="Briefly describe the integration: where the records come from, where they're going, who consumes them."
          className="w-full rounded-md border border-[#ddd] px-3 py-2.5 text-[14px] text-textl-primary placeholder:text-[#aaa] focus:outline-none focus:border-accent-teal"
        />
      </div>

      <Field
        label="Expected monthly volume"
        name="expectedVolume"
        value={state.expectedVolume}
        onChange={update("expectedVolume")}
        placeholder="e.g. ~500 records / month"
        maxLength={80}
      />

      {/* Honeypot — visually hidden, automation fills, humans skip */}
      <div className="absolute -left-[10000px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
        <label htmlFor="company_url">Company URL (do not fill)</label>
        <input
          id="company_url"
          name="company_url"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={state.company_url}
          onChange={update("company_url")}
        />
      </div>

      {error && (
        <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2 text-[13px] text-[#a83232]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-teal text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required,
  placeholder,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[12px] font-medium text-textl-primary mb-1.5"
      >
        {label}
        {required && <span className="text-[#a83232] ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-md border border-[#ddd] px-3 py-2.5 text-[14px] text-textl-primary placeholder:text-[#aaa] focus:outline-none focus:border-accent-teal"
      />
    </div>
  );
}
