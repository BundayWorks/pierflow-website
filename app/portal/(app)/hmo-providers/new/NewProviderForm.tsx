"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHmoProviderAction } from "../actions";

export default function NewProviderForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);

  function onDisplayNameChange(v: string) {
    setDisplayName(v);
    if (!slugDirty) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40),
      );
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors([]);
    const fd = new FormData(e.currentTarget);
    const raw = {
      displayName: String(fd.get("displayName") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      registrationNo: String(fd.get("registrationNo") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""),
      contactPhone: String(fd.get("contactPhone") ?? ""),
      websiteUrl: String(fd.get("websiteUrl") ?? ""),
      state: String(fd.get("state") ?? ""),
      lga: String(fd.get("lga") ?? ""),
    };

    startTransition(async () => {
      const result = await createHmoProviderAction(raw);
      if (!result.ok) {
        if (result.reason === "SLUG_TAKEN") {
          setErrors(["That slug is already in use. Pick another."]);
        } else if (result.reason === "INVALID_SLUG") {
          setErrors([
            result.detail ??
              "Slug must be lowercase alphanumeric with optional dashes.",
          ]);
        } else if (result.reason === "DISPLAY_NAME_REQUIRED") {
          setErrors(["Display name is required."]);
        } else {
          setErrors(result.issues ?? [result.reason]);
        }
        return;
      }
      router.push(`/portal/hmo-providers/${result.slug}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Display name" htmlFor="displayName" required>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={120}
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          className={inputCls}
          placeholder="Reliance HMO"
        />
      </Field>

      <Field
        label="Slug"
        htmlFor="slug"
        required
        hint="Lowercase, alphanumeric and dashes. Used in URLs (3–40 chars)."
      >
        <input
          id="slug"
          name="slug"
          required
          maxLength={40}
          value={slug}
          onChange={(e) => {
            setSlugDirty(true);
            setSlug(e.target.value);
          }}
          className={inputCls + " font-mono"}
          placeholder="reliance-hmo"
          pattern="^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Registration #" htmlFor="registrationNo">
          <input
            id="registrationNo"
            name="registrationNo"
            maxLength={60}
            className={inputCls}
            placeholder="NAICOM / NHIA id"
          />
        </Field>
        <Field label="Website" htmlFor="websiteUrl">
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            maxLength={300}
            className={inputCls}
            placeholder="https://"
          />
        </Field>
        <Field label="Contact email" htmlFor="contactEmail">
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            maxLength={200}
            className={inputCls}
            placeholder="ops@reliancehmo.com"
          />
        </Field>
        <Field label="Contact phone" htmlFor="contactPhone">
          <input
            id="contactPhone"
            name="contactPhone"
            maxLength={40}
            className={inputCls}
            placeholder="+234…"
          />
        </Field>
        <Field label="State" htmlFor="state">
          <input
            id="state"
            name="state"
            maxLength={60}
            className={inputCls}
            placeholder="Lagos"
          />
        </Field>
        <Field label="LGA" htmlFor="lga">
          <input
            id="lga"
            name="lga"
            maxLength={60}
            className={inputCls}
            placeholder="Ikeja"
          />
        </Field>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-lg border border-[#fde6e6] bg-[#fdf3f3] p-3 text-[13px] text-[#7a2727]">
          <p className="font-medium">Couldn’t save</p>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-full bg-accent-ink text-white text-[13px] font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Register HMO"}
        </button>
        <a
          href="/portal/hmo-providers"
          className="text-[13px] text-accent-ink/55 hover:text-accent-ink"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-black/[0.12] px-3 py-2 text-[14px] text-accent-ink placeholder:text-accent-ink/35 focus:outline-none focus:border-accent-emerald focus:ring-2 focus:ring-accent-teal-light";

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="block text-[12px] font-medium text-accent-ink/75">
        {label}
        {required ? <span className="text-[#a83232]"> *</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p className="mt-1 text-[11px] text-accent-ink/45">{hint}</p>
      ) : null}
    </label>
  );
}
