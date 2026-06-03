import {
  DocPageHeader,
  H2,
  Body,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/endpoints");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="Endpoints & webhooks"
        description="A complete index of API endpoints and the platform events that mirror them."
      />

      <H2 id="endpoints">REST endpoints</H2>
      <Body>
        Connectivity (insurance distribution, claims, verification, providers)
        and Records API (paper-to-digital ingestion and partner import).
      </Body>
      <KVTable
        headers={["Resource", "Endpoint"]}
        rows={[
          ["Plans", "/v1/plans"],
          ["Quotes", "/v1/quotes"],
          ["Enrollments", "/v1/enrollments"],
          ["Policies", "/v1/policies/:id"],
          ["Claims", "/v1/claims"],
          ["Verifications", "/v1/verifications"],
          ["Providers", "/v1/providers"],
          ["Webhooks", "/v1/webhooks/endpoints"],
          ["Settlement", "/v1/settlements"],
        ]}
      />

      <H2 id="records-endpoints">Records API endpoints</H2>
      <Body>
        See the{" "}
        <a
          href="/docs/records/overview"
          className="text-accent-emerald underline"
        >
          Records API
        </a>{" "}
        section for full request and response shapes.
      </Body>
      <KVTable
        headers={["Resource", "Endpoint"]}
        rows={[
          ["Ingest documents", "POST /v1/ingest/documents"],
          ["Job status", "GET /v1/jobs/:id"],
          ["Organizations", "GET /v1/organizations"],
          ["One organization", "GET /v1/organizations/:id"],
          ["Patients", "GET /v1/organizations/:id/patients"],
          ["Patient FHIR bundle", "GET /v1/organizations/:id/patients/:patient_id/fhir"],
          ["Import packages", "GET /v1/organizations/:id/import-packages"],
          ["Download package", "GET /v1/import-packages/:package_id/download"],
          ["Acknowledge package", "POST /v1/import-packages/:package_id/acknowledge"],
        ]}
      />

      <H2 id="webhooks">Webhook events</H2>
      <Body>
        Every consequential state change emits an event. Subscribe to the ones
        you care about — full catalogue on the{" "}
        <a href="/docs/webhooks" className="text-accent-emerald underline">
          Webhooks
        </a>{" "}
        page.
      </Body>
      <KVTable
        headers={["Event", "When it fires"]}
        rows={[
          ["member.created", "A new member record was created"],
          ["policy.issued", "A policy was confirmed and is active"],
          ["policy.renewed", "Renewal premium was collected"],
          ["policy.lapsed", "Premium collection failed after the grace window"],
          ["policy.cancelled", "Policy was terminated"],
          ["premium.paid", "A premium was successfully collected"],
          ["premium.failed", "A premium collection attempt failed"],
          ["claim.submitted", "A claim was received"],
          ["claim.approved", "A claim was approved by the HMO"],
          ["claim.rejected", "A claim was rejected by the HMO"],
          ["commission.credited", "A commission entry was posted to your ledger"],
        ]}
      />

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
