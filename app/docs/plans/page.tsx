import {
  DocPageHeader,
  H2,
  Body,
  Endpoint,
  Code,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("plans");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Plans"
        description="List and inspect HMO plans available across the network. Results are returned in the Universal Plan Schema and ranked by value_score."
      />

      <H2 id="list-plans">List plans</H2>
      <Endpoint method="GET" path="/v1/plans" />
      <Body>Filter by budget, audience, benefits, or HMO.</Body>
      <KVTable
        headers={["Query parameter", "Description"]}
        rows={[
          ["budget_ngn", "Maximum monthly premium in NGN minor units"],
          ["audience", "individual | family | corporate"],
          ["hmo_id", "Restrict to one HMO"],
          ["includes", "Comma-separated benefit keys that must be covered"],
        ]}
      />
      <Code language="bash">
        {`curl https://sandbox.api.pierflow.com/v1/plans?budget_ngn=120000&audience=individual \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>

      <H2 id="retrieve-a-plan">Retrieve a plan</H2>
      <Endpoint method="GET" path="/v1/plans/:id" />
      <Body>
        Returns the full Plan object — coverage, exclusions, waiting periods,
        pricing, provider count.
      </Body>
      <Code language="bash">
        {`curl https://sandbox.api.pierflow.com/v1/plans/pf_plan_01HX... \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
