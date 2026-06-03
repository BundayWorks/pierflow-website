export const metadata = {
  title: "Pierflow Portal",
};

// The portal splits into two route groups:
//   (auth)  → sign-in / sign-up, minimal chrome
//   (app)   → authenticated portal, full shell
// Each group has its own layout. This file is a pass-through.

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
