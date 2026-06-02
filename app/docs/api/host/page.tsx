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
  const { prev, next } = neighbors("api/host");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="API host & status"
        description="Where the API lives, what it's running on, and how to monitor incidents."
      />

      <H2 id="hosts">Hosts</H2>
      <KVTable
        headers={["Environment", "Hostname", "Region"]}
        rows={[
          ["Sandbox", "sandbox.api.pierflow.com", "AWS af-south-1 (Lagos)"],
          ["Production", "api.pierflow.com", "AWS af-south-1 (Lagos)"],
        ]}
      />

      <H2 id="status">Status & incidents</H2>
      <Body>
        Real-time uptime, regional health, and incident history live at{" "}
        <a href="/status" className="text-accent-emerald underline">
          status.pierflow.com
        </a>
        . Subscribe to incident notifications via the same page.
      </Body>

      <H2 id="ip-allowlists">IP allowlists</H2>
      <Lead>
        Static egress IPs are available on Growth and Enterprise plans for
        partners with strict firewall requirements. Contact support to enable.
      </Lead>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
