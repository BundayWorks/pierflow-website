import DocsShell from "@/components/docs/DocsShell";

export const metadata = {
  title: "Pierflow Docs",
  description:
    "Build with Pierflow — guides, references, and examples for the health connectivity API.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsShell>{children}</DocsShell>;
}
