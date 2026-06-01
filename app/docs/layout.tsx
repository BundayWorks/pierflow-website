import Link from "next/link";
import { DOC_SECTIONS } from "@/lib/constants";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-12 grid lg:grid-cols-[220px_1fr] gap-10">
        <aside className="lg:sticky lg:top-[80px] self-start">
          <p className="text-[11px] font-medium tracking-[1.5px] uppercase text-accent-teal">
            Docs
          </p>
          <nav className="mt-4 space-y-1">
            <Link
              href="/docs"
              className="block text-[13px] text-textl-primary hover:text-accent-teal py-1"
            >
              Overview
            </Link>
            {DOC_SECTIONS.map((s) => (
              <Link
                key={s.slug}
                href={`/docs/${s.slug}`}
                className="block text-[13px] text-textl-secondary hover:text-accent-teal py-1"
              >
                {s.title}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="prose prose-slate max-w-none">{children}</div>
      </div>
    </div>
  );
}
