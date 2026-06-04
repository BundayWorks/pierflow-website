export type NavMenuItem = {
  label: string;
  href: string;
  desc?: string;
};

export type NavMenu = {
  label: string;
  href: string;
  /** When defined, hovering opens a mega-menu panel of sub-links. */
  menu?: { heading?: string; items: NavMenuItem[] }[];
};

export const NAV_ITEMS: NavMenu[] = [
  { label: "Vision", href: "/vision" },
  {
    label: "Solutions",
    href: "/solutions",
    menu: [
      {
        heading: "Distribution",
        items: [
          {
            label: "Fintechs",
            href: "/solutions/fintechs",
            desc: "Embed insurance and benefits in your app.",
          },
          {
            label: "HR & payroll",
            href: "/solutions/hr-platforms",
            desc: "Group benefits for distributed teams.",
          },
          {
            label: "Cooperatives",
            href: "/solutions/cooperatives",
            desc: "Health coverage for member networks.",
          },
        ],
      },
      {
        heading: "Providers & carriers",
        items: [
          {
            label: "HMOs",
            href: "/solutions/hmos",
            desc: "Modern rails for distribution, claims, ops.",
          },
          {
            label: "HMO software vendors",
            href: "/solutions/hmo-software-vendors",
            desc: "Resell the connectivity layer.",
          },
          {
            label: "EMR / HMS vendors",
            href: "/solutions/emr-hms-vendors",
            desc: "Activate hospital clients with the Records API.",
          },
          {
            label: "Hospitals",
            href: "/solutions/hospitals",
            desc: "Verify coverage, exchange records, get paid faster.",
          },
          {
            label: "Governments",
            href: "/solutions/governments",
            desc: "Population-level data exchange.",
          },
        ],
      },
    ],
  },
  {
    label: "Platform",
    href: "/platform",
    menu: [
      {
        heading: "Core",
        items: [
          {
            label: "Connectivity",
            href: "/platform/connectivity",
            desc: "Pre-built integrations to every HMO.",
          },
          {
            label: "Data exchange",
            href: "/platform/data-exchange",
            desc: "Canonical resources mapped to FHIR R4.",
          },
          {
            label: "Insurance distribution",
            href: "/platform/insurance-distribution",
            desc: "Plans, quotes, enrollment, policies.",
          },
          {
            label: "Records API",
            href: "/platform/records-api",
            desc: "Paper records to FHIR R4 for any EMR or HMS.",
          },
        ],
      },
      {
        heading: "Trust & money",
        items: [
          {
            label: "Identity",
            href: "/platform/identity",
            desc: "BVN, NIN, biometrics, identity_confidence.",
          },
          {
            label: "Payments",
            href: "/platform/payments",
            desc: "Premium collection and payouts.",
          },
          {
            label: "Intelligence",
            href: "/platform/intelligence",
            desc: "Inline AI scoring on every transaction.",
          },
          {
            label: "Security",
            href: "/platform/security",
            desc: "NDPR-aligned, encrypted, fully audited.",
          },
        ],
      },
    ],
  },
  {
    label: "Company",
    href: "/company",
    menu: [
      {
        items: [
          {
            label: "About",
            href: "/company",
            desc: "Who we are and what we’re building.",
          },
          {
            label: "Manifesto",
            href: "/company/manifesto",
            desc: "What we believe about health data and AI.",
          },
          {
            label: "Blog",
            href: "/company/blog",
            desc: "Notes from the connectivity layer.",
          },
          {
            label: "Careers",
            href: "/company/careers",
            desc: "Build the layer that moves health in Africa.",
          },
          {
            label: "Contact",
            href: "/company/contact",
            desc: "Talk to the team.",
          },
        ],
      },
    ],
  },
  {
    label: "Developers",
    href: "/developers",
    menu: [
      {
        items: [
          {
            label: "Quick start",
            href: "/docs/quickstart/introduction",
            desc: "From sandbox to production in five steps.",
          },
          {
            label: "API reference",
            href: "/docs",
            desc: "Every endpoint, every shape.",
          },
          {
            label: "AI capabilities",
            href: "/developers/ai-capabilities",
            desc: "Inline scores, auditable, explainable.",
          },
          {
            label: "Request access",
            href: "/developers/request-access",
            desc: "Sandbox credentials, same business day.",
          },
          {
            label: "Changelog",
            href: "/docs/changelog",
            desc: "Notable platform changes.",
          },
        ],
      },
    ],
  },
  { label: "Docs", href: "/docs" },
];

export const PARTNERS = [
  "CLEARLINE HMO",
  "BASTION HEALTH",
  "SEAMLESSHR",
  "WORKPAY",
  "RELIANCE HMO",
  "TOTAL HEALTH TRUST",
] as const;

export const SOLUTIONS = [
  {
    slug: "fintechs",
    title: "Fintechs",
    sub: "Embed health insurance, savings, and benefits in your app.",
    icon: "Smartphone",
    aiField: "plan_recommendation",
  },
  {
    slug: "hr-platforms",
    title: "HR & payroll",
    sub: "Group benefits and enrollment for distributed teams.",
    icon: "Building2",
    aiField: "lapse_risk_score",
  },
  {
    slug: "hmos",
    title: "HMOs & vendors",
    sub: "Modern infrastructure for distribution, claims, and ops.",
    icon: "HeartPulse",
    aiField: "fraud_score",
  },
  {
    slug: "hospitals",
    title: "Hospitals",
    sub: "Verify coverage, exchange records, get paid faster.",
    icon: "Hospital",
    aiField: "eligibility_confidence",
  },
  {
    slug: "emr-hms-vendors",
    title: "EMR / HMS vendors",
    sub: "Activate hospital clients with digitised paper records.",
    icon: "Database",
    aiField: "extraction_confidence",
  },
  {
    slug: "governments",
    title: "Governments",
    sub: "Population-level health data exchange and analytics.",
    icon: "Globe",
    aiField: "population_signal",
  },
  {
    slug: "cooperatives",
    title: "Cooperatives",
    sub: "Health coverage and benefits for member networks.",
    icon: "Users",
    aiField: "plan_match_score",
  },
] as const;

export const STATS = [
  { value: "7", suffix: "+", label: "HMOs connected" },
  { value: "<48", suffix: "h", label: "average integration time" },
  { value: "FHIR ", suffix: "R4", label: "data standard" },
  { value: "99", suffix: "%", label: "API uptime SLA" },
] as const;

export const DOC_SECTIONS = [
  { slug: "getting-started", title: "Getting started" },
  { slug: "authentication", title: "Authentication" },
  { slug: "data-standards", title: "Data standards" },
  { slug: "plans", title: "Plans" },
  { slug: "enrollment", title: "Enrollment" },
  { slug: "policies", title: "Policies" },
  { slug: "claims", title: "Claims" },
  { slug: "verification", title: "Verification" },
  { slug: "providers", title: "Providers" },
  { slug: "webhooks", title: "Webhooks" },
  { slug: "ai-layer", title: "AI layer" },
  { slug: "errors", title: "Errors" },
  { slug: "changelog", title: "Changelog" },
] as const;

export const AI_CELLS = [
  {
    title: "Normalises",
    body: "Every HMO plan mapped to the Universal Health Schema automatically. No manual field mapping.",
    badge: "normalisation_confidence: 97",
    icon: "Layers",
  },
  {
    title: "Scores",
    body: "Every enrollment and claim assessed for fraud, identity confidence, and completeness before it moves.",
    badge: "fraud_score: 4 / 100",
    icon: "ShieldCheck",
  },
  {
    title: "Ranks",
    body: "Plans returned by value score — coverage breadth, price efficiency, HMO reliability — not just premium.",
    badge: "value_score: 88 / 100",
    icon: "ArrowUpDown",
  },
  {
    title: "Predicts",
    body: "Lapse risk calculated per policy before the collection cycle. Partners intervene before a member loses coverage.",
    badge: "lapse_risk_score: 0.12",
    icon: "TrendingUp",
  },
  {
    title: "Learns",
    body: "Every confirmed identity, approved claim, and renewed policy makes every model more accurate.",
    badge: "improving with every txn",
    icon: "Sparkles",
  },
  {
    title: "Auditable",
    body: "Every AI decision is logged, explainable, and reviewable. No black boxes in health infrastructure.",
    badge: "full decision trail",
    icon: "ScrollText",
  },
] as const;
