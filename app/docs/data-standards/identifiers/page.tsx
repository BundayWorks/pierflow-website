import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("data-standards/identifiers");
  return (
    <article>
      <DocPageHeader
        eyebrow="Data standards"
        title="Identifiers"
        description="Pierflow IDs, identity documents, and HMO-native identifiers — what's safe to display, what to store, what to keep server-side."
      />

      <Lead>
        Every resource has a stable Pierflow ID. External identifiers (HMO
        member numbers, BVN, NIN) are carried with provenance metadata so you
        always know where a value came from.
      </Lead>

      <H2 id="pierflow-ids">Pierflow IDs</H2>
      <KVTable
        headers={["Resource", "Prefix", "Example"]}
        rows={[
          ["Plan", "pf_plan_", "pf_plan_01HX7K…"],
          ["HMO", "pf_hmo_", "pf_hmo_clearline"],
          ["Member", "pf_mem_", "pf_mem_01HX7K…"],
          ["Policy", "pf_pol_", "pf_pol_01HX7K…"],
          ["Claim", "pf_clm_", "pf_clm_01HX7K…"],
          ["Provider", "pf_prov_", "pf_prov_01HX7K…"],
          ["Webhook event", "pf_evt_", "pf_evt_01HX7K…"],
        ]}
      />

      <H2 id="identity-documents">Identity documents</H2>
      <Body>
        BVN (11 digits) and NIN (11 digits) are the primary identity inputs.
        Pierflow stores them encrypted and never returns them in full — only
        the last 3 digits, prefixed with asterisks.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
