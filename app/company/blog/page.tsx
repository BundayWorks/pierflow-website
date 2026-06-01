import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";

const POSTS = [
  {
    slug: "building-the-connectivity-layer",
    title: "Building the connectivity layer for healthcare in Africa.",
    date: "2026-05-12",
    excerpt:
      "Why we are starting with insurance distribution, and how we plan to expand to clinical records and cross-border exchange.",
  },
  {
    slug: "the-platform-thinks",
    title: "The platform thinks: AI as health-data infrastructure.",
    date: "2026-04-02",
    excerpt:
      "Fraud scoring, lapse prediction, plan ranking — and why they belong in the connectivity layer, not in apps.",
  },
];

export default function BlogPage() {
  return (
    <>
      <PageHeader
        label="Blog"
        title="Notes from the connectivity layer."
        intro="What we are learning while we build."
      />
      <section className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20 divide-y divide-[#eee]">
          {POSTS.map((p) => (
            <Link
              key={p.slug}
              href={`/company/blog/${p.slug}`}
              className="block py-8 group"
            >
              <p className="text-[12px] text-accent-teal font-mono">{p.date}</p>
              <h2 className="mt-2 text-[22px] font-medium text-textl-primary group-hover:text-accent-teal">
                {p.title}
              </h2>
              <p className="mt-3 text-[14px] text-textl-secondary leading-[1.7] max-w-[640px]">
                {p.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
