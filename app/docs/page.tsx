import CodeBlock from "@/components/shared/CodeBlock";

export default function DocsHome() {
  return (
    <article>
      <h1 className="text-[34px] font-medium text-textl-primary leading-[1.2]">
        Pierflow API
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-textl-secondary">
        The Pierflow API is a single canonical surface across every connected
        HMO, provider, and partner in the network. Authenticate with a bearer
        token. Everything else is plain JSON.
      </p>

      <h2 className="mt-10 text-[20px] font-medium text-textl-primary">
        Base URLs
      </h2>
      <table className="mt-3 text-[13px] border border-[#eaeaea] rounded-md overflow-hidden w-full">
        <tbody>
          <tr className="border-b border-[#eaeaea]">
            <td className="px-4 py-2.5 font-mono text-textl-secondary bg-[#fafafa] w-40">
              Sandbox
            </td>
            <td className="px-4 py-2.5 font-mono">
              https://api.sandbox.pierflow.ng
            </td>
          </tr>
          <tr>
            <td className="px-4 py-2.5 font-mono text-textl-secondary bg-[#fafafa]">
              Production
            </td>
            <td className="px-4 py-2.5 font-mono">https://api.pierflow.ng</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-10 text-[20px] font-medium text-textl-primary">
        Quick start
      </h2>
      <div className="mt-4">
        <CodeBlock filename="curl">
          <code>
            curl https://api.sandbox.pierflow.ng/v1/plans \{"\n"}
            {"  "}-H &quot;Authorization: Bearer $PIERFLOW_KEY&quot;
          </code>
        </CodeBlock>
      </div>

      <h2 className="mt-10 text-[20px] font-medium text-textl-primary">
        Conventions
      </h2>
      <ul className="mt-3 text-[14px] leading-[1.8] text-textl-secondary list-disc pl-5">
        <li>All requests and responses are JSON.</li>
        <li>Timestamps are ISO-8601 in UTC.</li>
        <li>Money is represented in minor units (kobo for NGN).</li>
        <li>
          Writes are idempotent — set <code>Idempotency-Key</code> to retry
          safely.
        </li>
        <li>
          AI fields are stable and explained in the{" "}
          <a href="/docs/ai-layer" className="text-accent-teal hover:underline">
            AI layer
          </a>{" "}
          guide.
        </li>
      </ul>
    </article>
  );
}
