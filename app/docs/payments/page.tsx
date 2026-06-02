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
  const { prev, next } = neighbors("payments");
  return (
    <article>
      <DocPageHeader
        eyebrow="Commerce"
        title="Premium collection"
        description="How recurring premiums are charged, retried, and reconciled across payment methods."
      />

      <Lead>
        On policy creation, a billing schedule is created from the plan&apos;s
        frequency (monthly, quarterly, annual). The collection engine handles
        everything from there.
      </Lead>

      <H2 id="methods">Supported methods</H2>
      <KVTable
        headers={["Method", "Gateway", "Status"]}
        rows={[
          ["Card (debit/credit)", "Paystack", "MVP"],
          ["Bank transfer", "Paystack / Flutterwave", "MVP"],
          ["Payroll deduction", "Internal schedule", "MVP (HR channel only)"],
          ["Direct debit mandate", "Paystack Dedicated NUBAN", "Phase 2"],
          ["Wallet", "Flutterwave / Moniepoint", "Phase 2"],
          ["Mobile money", "MTN MoMo / Airtel Money", "Phase 2"],
        ]}
      />

      <H2 id="recurring">Recurring logic</H2>
      <Body>
        A daily job identifies policies due. On success the premium ledger
        updates, <code>premium.paid</code> fires, and the member is notified.
        On failure the engine retries at 24h, 72h, and 7d.
      </Body>

      <H2 id="grace">Grace and lapse</H2>
      <Body>
        After three failed attempts the policy enters a 7-day grace period.
        If still unpaid, it lapses and a <code>policy.lapsed</code> event
        fires. Your UI can offer in-app re-collection at any point.
      </Body>

      <Callout kind="tip">
        Use <code>lapse_risk_score</code> on the policy to drive proactive
        member outreach before the grace window even opens.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
