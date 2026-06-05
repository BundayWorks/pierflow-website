"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { submitContactInquiry } from "./contactActions";

export default function GetStarted() {
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitContactInquiry({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        company: company.trim(),
        country: country.trim() || undefined,
        phone: phone.trim() || undefined,
        company_url: honeypot,
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      if (res.error === "RATE_LIMITED") {
        setError(
          "Too many submissions from this network. Please try again in an hour, or email pierflowllc@gmail.com directly.",
        );
        return;
      }
      setError(
        "message" in res
          ? res.message
          : "Something went wrong. Please try again.",
      );
    });
  }

  return (
    <section className="px-2 md:px-4 py-4 md:py-6 pb-12">
      <div
        className="relative mx-auto max-w-[1200px] rounded-[28px] overflow-hidden wave-bg"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #0A7C6E 0%, #0DCE9A 40%, #7AE7C7 75%, #A8F2A1 100%)",
        }}
      >
        <div className="relative grid lg:grid-cols-2 gap-10 items-center px-6 md:px-12 py-20">
          <div>
            <h2 className="font-display font-medium text-[40px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-[#042520]">
              Start building
              <br />
              <span className="text-white">better health products</span>
            </h2>
            <p className="mt-6 text-[15px] md:text-[16px] leading-[1.6] text-[#042520]/80 max-w-[420px]">
              Connect to the health data layer and ship in days. Sandbox
              credentials in your inbox the same business day.
            </p>
          </div>

          {done ? (
            <SuccessCard
              firstName={firstName}
              onReset={() => {
                setDone(false);
                setFirstName("");
                setLastName("");
                setEmail("");
                setCompany("");
                setCountry("");
                setPhone("");
              }}
            />
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white rounded-[20px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.3)] p-6 md:p-7"
            >
              <p className="font-display text-[24px] font-medium text-accent-ink">
                Let&apos;s get started
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Input
                  name="first"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  disabled={pending}
                />
                <Input
                  name="last"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  disabled={pending}
                />
                <Input
                  name="email"
                  placeholder="Company email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={pending}
                />
                <Input
                  name="company"
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  autoComplete="organization"
                  disabled={pending}
                />
                <Input
                  name="country"
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  autoComplete="country-name"
                  disabled={pending}
                />
                <Input
                  name="phone"
                  placeholder="Phone (optional)"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  disabled={pending}
                />
              </div>

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

              <p className="mt-3 text-[11px] text-accent-ink/55">
                By submitting this form, I confirm I&apos;ve read{" "}
                <a
                  href="/legal/privacy"
                  className="underline text-accent-emerald"
                >
                  Pierflow&apos;s Privacy Statement
                </a>
                .
              </p>

              {error ? (
                <p className="mt-3 text-[12px] text-[#7a2222] inline-flex items-start gap-1.5">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-cta-gradient text-accent-ink font-medium text-[14px] gradient-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? "Sending…" : "Talk with our team"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function SuccessCard({
  firstName,
  onReset,
}: {
  firstName: string;
  onReset: () => void;
}) {
  return (
    <div className="bg-white rounded-[20px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.3)] p-6 md:p-7">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-card-mint text-accent-emerald grid place-items-center">
          <CheckCircle2 size={18} />
        </span>
        <p className="font-display text-[22px] font-medium text-accent-ink">
          Got it{firstName ? `, ${firstName}` : ""}.
        </p>
      </div>
      <p className="mt-4 text-[14px] leading-[1.65] text-accent-ink/75">
        Your message landed with the Pierflow team. We&apos;ll reply within
        one business day. While you wait, you can also create a sandbox
        account at{" "}
        <a
          href="/get-started"
          className="underline text-accent-emerald"
        >
          /get-started
        </a>
        .
      </p>
      <button
        onClick={onReset}
        className="mt-5 text-[12px] text-accent-ink/55 hover:text-accent-ink"
      >
        Send another message
      </button>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-black/[0.08] px-3 py-2.5 text-[13px] text-accent-ink placeholder:text-accent-ink/40 focus:outline-none focus:border-accent-emerald disabled:opacity-60 disabled:cursor-not-allowed"
    />
  );
}
