import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pierflow — Investor deck",
  description: "The connectivity layer for healthcare in Africa.",
  // Unlinked from the public nav and noindex so this URL stays
  // shareable but doesn't show up in search.
  robots: { index: false, follow: false },
};

export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="deck-root bg-dark-bg text-white">{children}</div>;
}
