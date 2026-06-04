import Link from "next/link";
import Logo from "@/components/shared/Logo";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] =
  [
    {
      heading: "Platform",
      links: [
        { label: "Connectivity", href: "/platform/connectivity" },
        { label: "Data exchange", href: "/platform/data-exchange" },
        { label: "Insurance distribution", href: "/platform/insurance-distribution" },
        { label: "Records API", href: "/platform/records-api" },
        { label: "Identity", href: "/platform/identity" },
        { label: "Payments", href: "/platform/payments" },
        { label: "Intelligence", href: "/platform/intelligence" },
        { label: "Security", href: "/platform/security" },
      ],
    },
    {
      heading: "Solutions",
      links: [
        { label: "HMOs", href: "/solutions/hmos" },
        { label: "Hospitals", href: "/solutions/hospitals" },
        { label: "Fintechs", href: "/solutions/fintechs" },
        { label: "HR & payroll", href: "/solutions/hr-platforms" },
        { label: "HMO software vendors", href: "/solutions/hmo-software-vendors" },
        { label: "EMR / HMS vendors", href: "/solutions/emr-hms-vendors" },
        { label: "Governments", href: "/solutions/governments" },
        { label: "Cooperatives", href: "/solutions/cooperatives" },
      ],
    },
    {
      heading: "Developers",
      links: [
        { label: "Quick start", href: "/docs/quickstart/introduction" },
        { label: "API reference", href: "/docs" },
        { label: "AI capabilities", href: "/developers/ai-capabilities" },
        { label: "Request access", href: "/developers/request-access" },
        { label: "Changelog", href: "/docs/changelog" },
        { label: "Status", href: "/status" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About", href: "/company" },
        { label: "Vision", href: "/vision" },
        { label: "Manifesto", href: "/company/manifesto" },
        { label: "Blog", href: "/company/blog" },
        { label: "Careers", href: "/company/careers" },
        { label: "Contact", href: "/company/contact" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy", href: "/legal/privacy" },
        { label: "Terms", href: "/legal/terms" },
        { label: "Cookies", href: "/legal/cookies" },
        { label: "NDPR", href: "/legal/ndpr" },
      ],
    },
  ];

export default function Footer() {
  return (
    <footer className="px-2 md:px-4 pb-4">
      <div className="mx-auto max-w-[1200px] rounded-[28px] bg-[#06251f] text-white overflow-hidden">
        <div className="px-6 md:px-10 pt-16 pb-10 grid lg:grid-cols-[200px_1fr] gap-10">
          <div>
            <Logo variant="light" size="md" />
            <p className="mt-5 text-[12px] text-white/55 max-w-[180px]">
              The connectivity layer for healthcare in Africa.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {COLUMNS.map((c) => (
              <div key={c.heading}>
                <h4 className="text-[12px] uppercase tracking-[0.16em] text-accent-mint">
                  {c.heading}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-white/75 hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 px-6 md:px-10 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-[11px] text-white/50">
            © {new Date().getFullYear()} Pierflow Technologies
          </p>
          <p className="text-[11px] text-white/50">
            Built in Lagos. Made for Africa.
          </p>
        </div>
      </div>
    </footer>
  );
}
