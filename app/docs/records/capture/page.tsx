import {
  DocPageHeader,
  H2,
  Lead,
  Body,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("records/capture");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Capture options"
        description="Pierflow supports several capture channels. Pick the one that fits the facility and call the same Ingest endpoint regardless."
      />

      <Lead>
        Whatever path the pages take to get to Pierflow, they end up on a
        single ingest queue. Your integration only needs to consume the
        downstream Patients and Import Package endpoints.
      </Lead>

      <H2 id="mobile">Mobile capture</H2>
      <Body>
        The simplest path to live: facility staff use the Pierflow capture web
        app on any modern phone. The app guides them through capturing each
        page, labelling the document type, and assigning it to a batch. Pages
        upload directly to the ingest queue.
      </Body>
      <KVTable
        headers={["Requirement", "Detail"]}
        rows={[
          ["Device", "Any phone with a back camera and a modern browser (iOS 16+, Android 10+)"],
          ["Connectivity", "Works offline; queued uploads resume on reconnect"],
          ["Setup", "Single magic-link sign-in for facility staff. No app store install required."],
        ]}
      />

      <H2 id="direct">Direct upload (server-to-server)</H2>
      <Body>
        Partners with existing scanning workflows can POST images or PDFs
        directly to the{" "}
        <a
          href="/docs/records/ingest"
          className="text-accent-emerald underline"
        >
          Ingest endpoint
        </a>
        . This is also how you&apos;d wire a Document Management System or an
        archive crawler into Pierflow.
      </Body>

      <H2 id="scanners">Scanner integrations <span className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium ml-2">Roadmap</span></H2>
      <Body>
        Integration with desktop and network scanners (high-volume document
        scanners, multifunction printers) is on the roadmap. While we finish
        validating that surface, mobile capture and direct upload cover the
        same workflows — the API your team builds against doesn&apos;t change.
      </Body>

      <Callout kind="info" title="Same response shape, every channel">
        Mobile, direct upload, and future scanner channels all return the same
        job IDs and produce the same FHIR R4 output. Your code path is
        identical regardless of how the pages arrived.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
