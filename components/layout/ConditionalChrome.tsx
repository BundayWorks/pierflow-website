"use client";

import { usePathname } from "next/navigation";
import Nav from "./Nav";
import Footer from "./Footer";

function hasOwnChrome(pathname: string) {
  // Docs, Portal, and the get-started onboarding flow swap the
  // marketing chrome for their own.
  return (
    pathname.startsWith("/docs") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/get-started")
  );
}

export function ConditionalNav() {
  const pathname = usePathname() ?? "";
  if (hasOwnChrome(pathname)) return null;
  return <Nav />;
}

export function ConditionalFooter() {
  const pathname = usePathname() ?? "";
  if (hasOwnChrome(pathname)) return null;
  return <Footer />;
}

export function ConditionalMainPadding({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const ownChrome = hasOwnChrome(pathname);
  return <main className={ownChrome ? "" : "pt-[84px]"}>{children}</main>;
}
