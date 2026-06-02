"use client";

import { usePathname } from "next/navigation";
import Nav from "./Nav";
import Footer from "./Footer";

export function ConditionalNav() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/docs")) return null;
  return <Nav />;
}

export function ConditionalFooter() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/docs")) return null;
  return <Footer />;
}

export function ConditionalMainPadding({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isDocs = pathname.startsWith("/docs");
  return (
    <main className={isDocs ? "" : "pt-[84px]"}>{children}</main>
  );
}
