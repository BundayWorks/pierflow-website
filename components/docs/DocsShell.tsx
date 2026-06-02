"use client";

import { useState } from "react";
import DocsTopbar from "./DocsTopbar";
import DocsSidebar from "./DocsSidebar";

export default function DocsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-white min-h-screen">
      <DocsTopbar
        mobileMenuOpen={mobileOpen}
        onMobileMenuToggle={() => setMobileOpen((o) => !o)}
      />

      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 grid lg:grid-cols-[260px_minmax(0,1fr)] gap-10">
        <aside className="hidden lg:block py-10 lg:sticky lg:top-[64px] lg:max-h-[calc(100vh-64px)] lg:overflow-y-auto">
          <DocsSidebar />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <aside className="lg:hidden fixed inset-x-0 top-[64px] bottom-0 z-30 bg-white border-t border-black/[0.06] overflow-y-auto p-5">
            <DocsSidebar onLinkClick={() => setMobileOpen(false)} />
          </aside>
        )}

        <main className="py-10 max-w-[760px]">{children}</main>
      </div>
    </div>
  );
}
