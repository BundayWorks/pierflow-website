import { DOCS_FLAT } from "@/lib/docs-structure";

function hrefFor(path: string) {
  return `/docs${path ? "/" + path : ""}`;
}

export function neighbors(currentPath: string) {
  const idx = DOCS_FLAT.findIndex((p) => p.path === currentPath);
  if (idx === -1) return { prev: undefined, next: undefined };
  const prev = DOCS_FLAT[idx - 1];
  const next = DOCS_FLAT[idx + 1];
  return {
    prev: prev ? { label: prev.title, href: hrefFor(prev.path) } : undefined,
    next: next ? { label: next.title, href: hrefFor(next.path) } : undefined,
  };
}
