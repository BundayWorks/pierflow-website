import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";

type Props = { params: { slug: string } };

const POSTS: Record<
  string,
  { title: string; date: string; body: string[] }
> = {
  "building-the-connectivity-layer": {
    title: "Building the connectivity layer for healthcare in Africa.",
    date: "2026-05-12",
    body: [
      "Health systems in Africa do not lack ambition. They lack the infrastructure to coordinate.",
      "We started with insurance distribution because it is the most acute, most visible, and most immediately solvable problem in African healthcare connectivity.",
      "From here, the same connectivity layer reaches into clinical records, governments, and cross-border exchange.",
    ],
  },
  "the-platform-thinks": {
    title: "The platform thinks: AI as health-data infrastructure.",
    date: "2026-04-02",
    body: [
      "AI in healthcare has too often been bolted on. We took the other route: we built Pierflow AI-native from day one.",
      "Every endpoint returns scored, normalised data. Fraud, identity confidence, lapse risk, value — inline, auditable, and explainable.",
      "The platform does not just move data. It understands it.",
    ],
  },
};

export default function BlogPost({ params }: Props) {
  const post = POSTS[params.slug];
  if (!post) {
    return (
      <section className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20">
          <p className="text-textl-secondary">Post not found.</p>
          <Link
            href="/company/blog"
            className="mt-4 inline-block text-accent-teal"
          >
            ← Back to blog
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHeader label={`Blog · ${post.date}`} title={post.title} />
      <section className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20 space-y-6 text-[16px] leading-[1.8] text-textl-secondary">
          {post.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <Link
            href="/company/blog"
            className="mt-8 inline-block text-[13px] text-accent-teal hover:underline"
          >
            ← All posts
          </Link>
        </div>
      </section>
    </>
  );
}
