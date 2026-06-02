import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("ledger");
  return (
    <article>
      <DocPageHeader
        eyebrow="Commerce"
        title="Ledger & reconciliation"
        description="The platform's single source of truth for every financial position — premium, settlement, commission, refund, and failed payment."
      />

      <Lead>
        Insurance money flows get messy fast. The ledger is not an
        afterthought — every premium, payout, and clawback lands in a
        double-entry record before anything else considers it.
      </Lead>

      <H2 id="accounts">Ledger accounts</H2>
      <KVTable
        headers={["Account", "Records"]}
        rows={[
          ["Premium", "Every premium collected, by policy and by month"],
          ["Settlement", "Payments made to HMOs on behalf of policies"],
          ["Commission", "Commission entries earned by each partner"],
          ["Refund", "Unused premium refunded on cancellation"],
          ["Failed payment", "All failed collection attempts and resolutions"],
        ]}
      />

      <H2 id="jobs">Reconciliation jobs</H2>
      <Body>
        Three jobs run nightly to keep every financial position correct. Any
        discrepancy is surfaced in the operations dashboard for review.
      </Body>
      <ul className="list-disc pl-5 text-[15px] leading-[1.85] text-accent-ink/80 space-y-1.5">
        <li>
          <strong>Premium vs HMO settlement</strong> — every collected premium
          remitted to the correct HMO.
        </li>
        <li>
          <strong>Commission vs payout</strong> — every posted commission paid
          out in the next cycle.
        </li>
        <li>
          <strong>Policy vs HMO roster</strong> — every active Pierflow policy
          exists and is active in the HMO&apos;s own system.
        </li>
      </ul>

      <Callout kind="tip">
        Subscribe to <code>commission.credited</code> and store the entry in
        your own ledger. Reconcile against Pierflow&apos;s settlement
        statements weekly.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
