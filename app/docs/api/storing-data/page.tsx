import {
  DocPageHeader,
  H2,
  Lead,
  Callout,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/storing-data");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="Storing API data"
        description="What's safe to cache, what you must persist, and what should never leave Pierflow."
      />

      <Lead>
        Pierflow is the system of record for canonical health data — your job
        is to store just enough to do your job well.
      </Lead>

      <H2 id="store-this">Always store</H2>
      <KVTable
        headers={["Field", "Why"]}
        rows={[
          ["policy_id", "Stable reference for every member action"],
          ["member_id", "Stable reference for the person"],
          ["plan_id", "Render plan info quickly without an extra call"],
          ["webhook event ids", "Deduplicate retries"],
        ]}
      />

      <H2 id="cache">Safe to cache</H2>
      <KVTable
        headers={["Field", "TTL"]}
        rows={[
          ["plan summaries", "1 hour"],
          ["provider listings", "24 hours"],
          ["verifications", "60 seconds"],
        ]}
      />

      <H2 id="never">Never store on the client</H2>
      <Callout kind="warn">
        Identity documents (BVN, NIN, biometrics) and clinical PHI must stay
        server-side. Never embed in mobile bundles or browser local storage.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
