export default function ChangelogPage() {
  const entries = [
    {
      date: "2026-05-20",
      title: "Public sandbox launches",
      body: "Sandbox API access opens with seven HMOs connected. AI scoring is on by default.",
    },
    {
      date: "2026-04-08",
      title: "FHIR R4 endpoints",
      body: "Every canonical resource is now retrievable as FHIR R4 via /v1/fhir/*.",
    },
    {
      date: "2026-03-15",
      title: "Webhook signing",
      body: "Per-endpoint secrets and signature verification headers are now generally available.",
    },
  ];

  return (
    <article>
      <h1 className="text-[34px] font-medium text-textl-primary leading-[1.2]">
        Changelog
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-textl-secondary">
        Notable platform changes, in reverse chronological order.
      </p>
      <ul className="mt-10 divide-y divide-[#eee]">
        {entries.map((e) => (
          <li key={e.date} className="py-6">
            <p className="text-[12px] font-mono text-accent-teal">{e.date}</p>
            <h3 className="mt-1 text-[16px] font-medium text-textl-primary">
              {e.title}
            </h3>
            <p className="mt-2 text-[14px] leading-[1.7] text-textl-secondary">
              {e.body}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
