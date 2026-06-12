"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, CheckCircle2, XCircle } from "lucide-react";
import type { NetworkProviderRow } from "./actions";

const TYPE_FILTERS = ["ALL", "HOSPITAL", "CLINIC", "LAB", "PHARMACY", "OTHER"] as const;

export default function NetworkClient({
  providers,
}: {
  providers: NetworkProviderRow[];
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filtered = providers.filter((p) => {
    if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q) ||
        p.specialties.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold text-accent-ink">
            Provider Network
          </h1>
          <p className="text-[14px] text-accent-ink/55 mt-1">
            Hospitals, clinics, and labs in your network. Fintechs use this for
            provider search.
          </p>
        </div>
        <Link
          href="/portal/cover/network/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-emerald text-white text-[13px] font-medium hover:bg-accent-emerald/90"
        >
          <Plus size={14} /> Add provider
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-ink/35"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, state, specialty…"
            className="w-full pl-9 pr-3 py-2 border border-black/10 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
          />
        </div>
        <div className="flex gap-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                typeFilter === t
                  ? "bg-accent-emerald text-white"
                  : "bg-black/[0.04] text-accent-ink/65 hover:text-accent-ink"
              }`}
            >
              {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[12px] text-accent-ink/45">
        {filtered.length} of {providers.length} providers
      </p>

      {filtered.length === 0 ? (
        <div className="mt-8 text-center text-[14px] text-accent-ink/55">
          {providers.length === 0
            ? "No network providers yet. Add your first hospital or clinic."
            : "No providers match your filters."}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-black/[0.08] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Location</th>
                <th className="text-left px-4 py-2.5 font-medium">
                  Specialties
                </th>
                <th className="text-center px-4 py-2.5 font-medium">Tier</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/cover/network/${p.id}`}
                      className="text-accent-ink font-medium hover:text-accent-emerald"
                    >
                      {p.name}
                    </Link>
                    <p className="text-[11px] text-accent-ink/45 font-mono mt-0.5">
                      {p.externalId}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-accent-ink/75">
                    {p.type.charAt(0) + p.type.slice(1).toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/75">
                    {[p.lga, p.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.specialties.length > 0
                        ? p.specialties.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-card-mint text-accent-emerald"
                            >
                              {s}
                            </span>
                          ))
                        : <span className="text-accent-ink/35 text-[11px]">—</span>}
                      {p.specialties.length > 3 ? (
                        <span className="text-[10px] text-accent-ink/45">
                          +{p.specialties.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-accent-ink/65">
                    {p.tier ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.isActive ? (
                      <CheckCircle2
                        size={14}
                        className="inline text-accent-emerald"
                      />
                    ) : (
                      <XCircle size={14} className="inline text-accent-ink/35" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
