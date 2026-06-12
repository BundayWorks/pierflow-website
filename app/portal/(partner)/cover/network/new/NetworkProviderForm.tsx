"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createNetworkProviderAction,
  updateNetworkProviderAction,
  type NetworkProviderDetail,
} from "../actions";

const TYPES = ["HOSPITAL", "CLINIC", "LAB", "PHARMACY", "OTHER"] as const;

export default function NetworkProviderForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: NetworkProviderDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [externalId, setExternalId] = useState(initial?.externalId ?? "");
  const [type, setType] = useState(initial?.type ?? "HOSPITAL");
  const [state, setState] = useState(initial?.state ?? "");
  const [lga, setLga] = useState(initial?.lga ?? "");
  const [street, setStreet] = useState(initial?.street ?? "");
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initial?.longitude?.toString() ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [tier, setTier] = useState(initial?.tier?.toString() ?? "");
  const [specialties, setSpecialties] = useState<string[]>(initial?.specialties ?? []);
  const [newSpecialty, setNewSpecialty] = useState("");

  function addSpecialty() {
    if (newSpecialty.trim()) {
      setSpecialties([...specialties, newSpecialty.trim()]);
      setNewSpecialty("");
    }
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    if (!externalId.trim()) { setError("External ID is required"); return; }

    const payload = {
      name: name.trim(),
      externalId: externalId.trim(),
      type,
      state: state.trim() || undefined,
      lga: lga.trim() || undefined,
      street: street.trim() || undefined,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      tier: tier ? parseInt(tier) : undefined,
      specialties,
    };

    startTransition(async () => {
      const res =
        mode === "edit" && initial
          ? await updateNetworkProviderAction(initial.id, payload)
          : await createNetworkProviderAction(payload);
      if (!res.ok) setError(res.reason);
      else {
        router.push(`/portal/cover/network/${res.id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Facility name" required>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Reddington Hospital" className="input-field" />
        </Field>
        <Field label="External ID" required hint="Your internal facility ID">
          <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="FAC-001" className="input-field font-mono text-[12px]" disabled={mode === "edit"} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
            {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Tier" hint="1 = best, 3 = basic">
          <input type="number" value={tier} onChange={(e) => setTier(e.target.value)} placeholder="optional" min="1" max="5" className="input-field" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="State"><input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="Lagos" className="input-field" /></Field>
        <Field label="LGA"><input type="text" value={lga} onChange={(e) => setLga(e.target.value)} placeholder="Ikeja" className="input-field" /></Field>
        <Field label="Street"><input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="optional" className="input-field" /></Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Latitude"><input type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="6.5244" step="any" className="input-field" /></Field>
        <Field label="Longitude"><input type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="3.3792" step="any" className="input-field" /></Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Phone"><input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+234…" className="input-field" /></Field>
        <Field label="Email"><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="optional" className="input-field" /></Field>
      </div>

      <div>
        <p className="text-[12px] text-accent-ink/65 font-medium mb-1">Specialties</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {specialties.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
              {s}
              <button type="button" onClick={() => setSpecialties(specialties.filter((_, j) => j !== i))} className="hover:text-[#a83232]"><Trash2 size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={newSpecialty} onChange={(e) => setNewSpecialty(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSpecialty())} placeholder="e.g. Cardiology" className="input-field flex-1" />
          <button type="button" onClick={addSpecialty} className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:border-black/30"><Plus size={12} /> Add</button>
        </div>
      </div>

      {error ? <p className="text-[13px] text-[#a83232] rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-4 py-3">{error}</p> : null}

      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSubmit} disabled={pending} className="px-6 py-2.5 rounded-md bg-accent-emerald text-white text-[14px] font-medium hover:bg-accent-emerald/90 disabled:opacity-50">
          {pending ? (mode === "edit" ? "Saving…" : "Adding…") : (mode === "edit" ? "Save changes" : "Add provider")}
        </button>
        <button onClick={() => router.back()} disabled={pending} className="px-4 py-2.5 rounded-md border border-black/[0.12] text-[14px] text-accent-ink/65 hover:border-black/30">Cancel</button>
      </div>

      <style jsx>{`
        .input-field { width:100%;padding:8px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;font-size:13px;color:var(--accent-ink,#0a2e24);outline:none; }
        .input-field:focus { border-color:rgba(16,185,129,0.4);box-shadow:0 0 0 2px rgba(16,185,129,0.1); }
        .input-field:disabled { background:#f5f5f5;cursor:not-allowed; }
      `}</style>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] text-accent-ink/65 font-medium mb-1">{label}{required ? <span className="text-[#a83232] ml-0.5">*</span> : null}</label>
      {children}
      {hint ? <p className="text-[11px] text-accent-ink/45 mt-0.5">{hint}</p> : null}
    </div>
  );
}
