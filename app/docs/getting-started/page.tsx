import CodeBlock from "@/components/shared/CodeBlock";

export default function Page() {
  return (
    <article>
      <h1 className="text-[34px] font-medium text-textl-primary leading-[1.2]">
        Getting started
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-textl-secondary">
        Request sandbox credentials, install the SDK, and make your first
        request in under five minutes.
      </p>

      <h2 className="mt-10 text-[20px] font-medium text-textl-primary">
        1. Install
      </h2>
      <div className="mt-4">
        <CodeBlock filename="bash">
          <code>npm install @pierflow/node</code>
        </CodeBlock>
      </div>

      <h2 className="mt-10 text-[20px] font-medium text-textl-primary">
        2. Authenticate
      </h2>
      <div className="mt-4">
        <CodeBlock filename="ts">
          <code>
            <span className="text-[#C586C0]">import</span>{" "}
            <span className="text-[#7EC8E3]">Pierflow</span>{" "}
            <span className="text-[#C586C0]">from</span>{" "}
            <span className="text-[#A8DDD8]">&apos;@pierflow/node&apos;</span>;
            {"\n\n"}
            <span className="text-[#C586C0]">const</span> pf ={" "}
            <span className="text-[#C586C0]">new</span>{" "}
            <span className="text-accent-green">Pierflow</span>({"{"}{" "}
            <span className="text-[#7EC8E3]">apiKey</span>:{" "}
            <span className="text-[#A8DDD8]">process.env.PIERFLOW_KEY</span>{" "}
            {"});"}
          </code>
        </CodeBlock>
      </div>

      <h2 className="mt-10 text-[20px] font-medium text-textl-primary">
        3. Your first call
      </h2>
      <div className="mt-4">
        <CodeBlock filename="ts">
          <code>
            <span className="text-[#C586C0]">const</span> plans ={" "}
            <span className="text-[#C586C0]">await</span> pf.plans.
            <span className="text-accent-green">list</span>({"{ "}
            <span className="text-[#7EC8E3]">budget_ngn</span>:{" "}
            <span className="text-[#F5A623]">120000</span> {"});"}
          </code>
        </CodeBlock>
      </div>
    </article>
  );
}
