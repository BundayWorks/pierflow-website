import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  FieldCardList,
  FieldCard,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("ai-layer");
  return (
    <article>
      <DocPageHeader
        eyebrow="Intelligence"
        title="AI layer"
        description="Inline scoring on every meaningful API response. Stable schemas, model versioning, and a full audit trail per decision."
      />

      <Lead>
        Pierflow is AI-native because health data is too complex for static
        rules at scale. Every score is returned alongside the data — no
        separate model calls to orchestrate.
      </Lead>

      <FieldCardList>
        <FieldCard
          name="fraud_score"
          type="0–100"
          description="Returned on enrollments, claims, and payments. Higher = higher risk. Tunable thresholds available per partner."
        />
        <FieldCard
          name="identity_confidence"
          type="0–1"
          description="Confidence on the verified identity of a member. Combines BVN, NIN, biometric, and historical signal."
        />
        <FieldCard
          name="lapse_risk_score"
          type="0–1"
          description="Risk that a policy will lapse during the next collection cycle. Designed for proactive retention."
        />
        <FieldCard
          name="value_score"
          type="0–100"
          description="Plan-quality score balancing benefit breadth, network depth, and pricing efficiency."
        />
        <FieldCard
          name="eligibility_confidence"
          type="0–1"
          description="Confidence on a verification result given the policy and provider context."
        />
      </FieldCardList>

      <H2 id="auditability">Auditability</H2>
      <Body>
        Every score is logged with the model version, input hash, and decision
        time. Full traces are queryable from the operations dashboard.
      </Body>

      <Callout kind="info" title="Why this matters">
        AI in healthcare should work invisibly — improving decisions and
        catching errors — without ever replacing human judgment. Pierflow
        scores are explainable signals, not black-box verdicts.
      </Callout>

      <H2 id="versioning">Model versioning</H2>
      <Body>
        Each score carries <code>model_version</code> in long-form responses
        (e.g. <code>fraud_v3.2</code>). Old versions remain queryable for at
        least 12 months so audits can reproduce historical decisions.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
