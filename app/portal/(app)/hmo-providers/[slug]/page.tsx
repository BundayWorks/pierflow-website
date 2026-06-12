import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Receipt,
} from "lucide-react";
import { getActiveContract } from "@/lib/insurance/contracts";
import { listChannelSettlements } from "@/lib/insurance/providers";
import SettlementForm from "./SettlementForm";
import {
  getHmoProviderBySlug,
  listPlansForProvider,
} from "../actions";
import StatusControls from "./StatusControls";
import PublishSampleButton from "./PublishSampleButton";

export const dynamic = "force-dynamic";

export default async function HmoProviderDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const provider = await getHmoProviderBySlug(params.slug);
  if (!provider) notFound();

  const [plans, activeContract, channelSettlements] = await Promise.all([
    listPlansForProvider(provider.id),
    getActiveContract(provider.id),
    listChannelSettlements(provider.id),
  ]);

  return (
    <div>
      <Link
        href="/portal/hmo-providers"
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> HMO providers
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-10 h-10 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
              <Building2 size={18} />
            </span>
            <h1 className="font-display text-[28px] md:text-[36px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
              {provider.displayName}
            </h1>
            <Chip status={provider.status} />
          </div>
          <p className="mt-2 text-[13px] font-mono text-accent-ink/55">
            {provider.slug}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link
            href={`/portal/hmo-providers/${provider.slug}/mapping`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.12] text-accent-ink/75 text-[12px] font-medium hover:text-accent-ink"
          >
            <Sparkles size={12} /> Plan mapping
          </Link>
          <Link
            href={`/portal/hmo-providers/${provider.slug}/contracts`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.12] text-accent-ink/75 text-[12px] font-medium hover:text-accent-ink"
          >
            <Receipt size={12} /> Contracts
          </Link>
          <PublishSampleButton
            providerId={provider.id}
            slug={provider.slug}
            variant="secondary"
          />
          <StatusControls
            providerId={provider.id}
            status={provider.status}
          />
        </div>
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-6">
          {/* ── Plans ──────────────────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[16px] font-medium text-accent-ink">
                Plans <span className="text-accent-ink/45">({plans.length})</span>
              </h2>
              <p className="text-[12px] text-accent-ink/45">
                Pushed via{" "}
                <code className="font-mono text-accent-ink/65">
                  POST /v1/hmo-providers/{provider.slug}/plans
                </code>
              </p>
            </div>

            {plans.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
                <p className="text-[14px] text-accent-ink/55">
                  No plans yet. The connector publishes plans through the
                  catalogue endpoint; nothing arrives here until the EMR
                  vendor pushes their catalogue.
                </p>
                <div className="mt-4 flex items-center justify-center">
                  <PublishSampleButton
                    providerId={provider.id}
                    slug={provider.slug}
                  />
                </div>
                <p className="mt-3 text-[11px] text-accent-ink/45">
                  Inserts one synthetic Silver Plan via the active mapping
                  — useful for testing and demos. Requires an active mapping
                  first.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {plans.map((p) => {
                  const stale =
                    p.staleAfter !== null && p.staleAfter < new Date();
                  const pricing = p.pricing as {
                    individual_monthly?: number;
                  } | null;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/portal/hmo-providers/${provider.slug}/plans/${p.id}`}
                        className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
                      >
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-[14px] font-medium text-accent-ink">
                          {p.name}
                        </p>
                        <PlanStatusChip status={p.status} />
                        <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55">
                          {p.scope.replace(/_/g, " ").toLowerCase()}
                        </span>
                        {stale ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
                            <Clock size={10} /> Stale
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] text-accent-ink/55">
                        ext id{" "}
                        <span className="font-mono">{p.externalId}</span> ·{" "}
                        last synced{" "}
                        {new Date(p.lastSyncedAt).toLocaleString()}
                        {p.lastVerifiedAt
                          ? ` · verified ${new Date(p.lastVerifiedAt).toLocaleString()}`
                          : ""}
                      </p>
                      {pricing?.individual_monthly !== undefined ? (
                        <p className="mt-1 text-[13px] text-accent-ink">
                          ₦
                          {(pricing.individual_monthly / 100).toLocaleString()}{" "}
                          / {p.billingFrequency.toLowerCase()}
                        </p>
                      ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ── Side panel ───────────────────────────────────────────── */}
        <aside className="space-y-4 text-[13px]">
          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              At a glance
            </p>
            <dl className="mt-3 space-y-2.5">
              <Row label="Plans" value={String(provider._count.plans)} />
              <Row label="Contracts" value={String(provider._count.contracts)} />
              <Row
                label="Tenant org"
                value={provider.organization.id}
                mono
              />
              <Row label="State" value={provider.organization.state ?? "—"} />
              <Row label="LGA" value={provider.organization.lga ?? "—"} />
            </dl>
          </div>

          {provider.registrationNo ||
          provider.websiteUrl ||
          provider.contactEmail ||
          provider.contactPhone ? (
            <div className="rounded-xl border border-black/[0.08] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
                Contact
              </p>
              <dl className="mt-3 space-y-2.5">
                {provider.registrationNo ? (
                  <Row label="Reg #" value={provider.registrationNo} mono />
                ) : null}
                {provider.contactEmail ? (
                  <Row label="Email" value={provider.contactEmail} />
                ) : null}
                {provider.contactPhone ? (
                  <Row label="Phone" value={provider.contactPhone} />
                ) : null}
                {provider.websiteUrl ? (
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-accent-ink/55">Website</span>
                    <a
                      href={provider.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-emerald inline-flex items-center gap-1 truncate max-w-[200px]"
                    >
                      <ExternalLink size={11} /> {provider.websiteUrl}
                    </a>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              Active contract
            </p>
            {activeContract ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/portal/hmo-providers/${provider.slug}/contracts/${activeContract.id}`}
                    className="text-[12px] font-medium text-accent-emerald hover:underline"
                  >
                    v{activeContract.version} →
                  </Link>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/55">
                    remainder {activeContract.remainderBearer}
                  </span>
                </div>
                <p className="text-[11px] text-accent-ink/55">
                  {activeContract.parties.length} part
                  {activeContract.parties.length === 1 ? "y" : "ies"} ·
                  effective{" "}
                  {new Date(activeContract.effectiveFrom).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-accent-ink/55">
                No active contract.{" "}
                <Link
                  href={`/portal/hmo-providers/${provider.slug}/contracts/new`}
                  className="text-accent-emerald hover:underline"
                >
                  Capture one
                </Link>{" "}
                to enable splits.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              Default settlement
            </p>
            <SettlementForm
              providerId={provider.id}
              defaultSettlementMode={provider.defaultSettlementMode}
              settlementBankName={provider.settlementBankName}
              settlementBankAccount={provider.settlementBankAccount}
              settlementBankCode={provider.settlementBankCode}
            />
          </div>

          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              Per-fintech overrides
            </p>
            {channelSettlements.length === 0 ? (
              <p className="mt-2 text-[12px] text-accent-ink/55">
                None. Every fintech inherits the default above. Per-fintech
                overrides appear here once a fintech partner negotiates
                different terms.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-[12px]">
                {channelSettlements.map((cs) => (
                  <li
                    key={cs.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-accent-ink truncate">
                      {cs.partner.name}
                    </span>
                    <span className="text-accent-ink/55 text-[10px] uppercase tracking-[0.12em]">
                      {cs.settlementMode
                        ?.replace(/_/g, " ")
                        .toLowerCase() ?? "inherit"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-accent-ink/55">{label}</span>
      <span
        className={`text-accent-ink truncate max-w-[200px] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Chip({ status }: { status: string }) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} /> Pending
      </span>
    );
  }
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} /> Active
      </span>
    );
  }
  if (status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <AlertCircle size={10} /> Suspended
      </span>
    );
  }
  return null;
}

function PlanStatusChip({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        Active
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3a3a8a]">
        Draft
      </span>
    );
  }
  if (status === "WITHDRAWN") {
    return (
      <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.06] text-accent-ink/55">
        Withdrawn
      </span>
    );
  }
  return null;
}
