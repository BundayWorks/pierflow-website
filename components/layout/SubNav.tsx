"use client";

import Link from "next/link";

type Item = { label: string; href: string };

export default function SubNav({ items }: { items: Item[] }) {
  return (
    <div className="sticky top-[60px] z-40 bg-dark-bg/95 backdrop-blur border-b border-dark-muted">
      <div className="max-w-[1200px] mx-auto px-6 h-[44px] flex items-center gap-6 overflow-x-auto">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-[12px] text-textd-secondary hover:text-white whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
