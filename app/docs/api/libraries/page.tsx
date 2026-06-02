import {
  DocPageHeader,
  H2,
  Body,
  KVTable,
  Code,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/libraries");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="Client libraries"
        description="Official SDKs that wrap the REST API with typed clients and helpers."
      />

      <H2 id="languages">Languages</H2>
      <KVTable
        headers={["Language", "Package", "Status"]}
        rows={[
          ["Node / TypeScript", "@pierflow/node", "Stable"],
          ["Python", "pierflow", "Beta"],
          ["Go", "github.com/pierflow/pierflow-go", "Beta"],
          ["Ruby", "pierflow", "Planned"],
        ]}
      />

      <H2 id="install">Install</H2>
      <Code language="bash">
        {`npm install @pierflow/node
pip install pierflow
go get github.com/pierflow/pierflow-go`}
      </Code>

      <H2 id="usage">Usage</H2>
      <Body>
        SDKs accept an <code>environment</code> option and read{" "}
        <code>PIERFLOW_KEY</code> from your environment by default.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
