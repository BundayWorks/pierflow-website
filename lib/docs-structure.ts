export type DocAnchor = { label: string; hash: string };
export type DocPage = {
  title: string;
  slug: string;
  /** Path relative to /docs (e.g. "quickstart/introduction"). */
  path: string;
  summary?: string;
  anchors?: DocAnchor[];
  badge?: string;
};
export type DocSection = {
  title: string;
  /** Optional icon name from lucide-react. */
  icon?: string;
  pages: DocPage[];
};

export const DOCS_TREE: DocSection[] = [
  {
    title: "Home",
    icon: "Home",
    pages: [
      {
        title: "Welcome to the Docs",
        slug: "home",
        path: "",
        summary:
          "Guides, references, and examples to build with Pierflow — the connectivity layer for healthcare in Africa.",
      },
    ],
  },
  {
    title: "Quickstart",
    icon: "Rocket",
    pages: [
      {
        title: "Introduction",
        slug: "introduction",
        path: "quickstart/introduction",
        summary:
          "Pierflow connects HMOs, providers, and digital partners through one canonical API.",
        anchors: [
          { label: "Who Pierflow is for", hash: "who-its-for" },
          { label: "Two environments", hash: "two-environments" },
          { label: "Your API keys", hash: "your-api-keys" },
        ],
      },
      {
        title: "Quickstart setup",
        slug: "setup",
        path: "quickstart/setup",
        anchors: [
          { label: "Install the SDK", hash: "install-the-sdk" },
          { label: "Authenticate", hash: "authenticate" },
          { label: "Make your first call", hash: "first-call" },
        ],
      },
      {
        title: "Issue your first policy",
        slug: "first-policy",
        path: "quickstart/first-policy",
        anchors: [
          { label: "Quote", hash: "quote" },
          { label: "Enroll", hash: "enroll" },
          { label: "Observe webhooks", hash: "observe-webhooks" },
        ],
      },
      {
        title: "How it works",
        slug: "how-it-works",
        path: "quickstart/how-it-works",
        anchors: [
          { label: "Five-layer model", hash: "five-layer-model" },
          { label: "Request lifecycle", hash: "request-lifecycle" },
        ],
      },
      {
        title: "Next steps",
        slug: "next-steps",
        path: "quickstart/next-steps",
      },
    ],
  },
  {
    title: "API",
    icon: "TerminalSquare",
    pages: [
      {
        title: "Overview",
        slug: "overview",
        path: "api/overview",
        anchors: [
          { label: "Base URLs", hash: "base-urls" },
          { label: "Conventions", hash: "conventions" },
        ],
      },
      {
        title: "Endpoints & webhooks",
        slug: "endpoints",
        path: "api/endpoints",
      },
      { title: "Protocols & headers", slug: "protocols", path: "api/protocols" },
      { title: "API host & status", slug: "host", path: "api/host" },
      { title: "Storing API data", slug: "storing-data", path: "api/storing-data" },
      { title: "Field formats", slug: "field-formats", path: "api/field-formats" },
      { title: "Postman collection", slug: "postman", path: "api/postman" },
      { title: "Client libraries", slug: "libraries", path: "api/libraries" },
      { title: "API versioning", slug: "versioning", path: "api/versioning" },
    ],
  },
  {
    title: "Authentication & access",
    icon: "ShieldCheck",
    pages: [
      {
        title: "Authentication",
        slug: "authentication",
        path: "authentication",
        anchors: [
          { label: "OAuth 2.0", hash: "oauth-2" },
          { label: "API keys", hash: "api-keys" },
          { label: "Key format", hash: "key-format" },
          { label: "Rotation", hash: "rotation" },
        ],
      },
      { title: "Rate limiting", slug: "rate-limiting", path: "rate-limiting" },
      { title: "Idempotency", slug: "idempotency", path: "idempotency" },
      { title: "Request validation", slug: "validation", path: "validation" },
    ],
  },
  {
    title: "Data standards",
    icon: "Layers",
    pages: [
      {
        title: "Universal Plan Schema",
        slug: "plan-schema",
        path: "data-standards/plan-schema",
        anchors: [
          { label: "Plan object", hash: "plan-object" },
          { label: "Coverage", hash: "coverage" },
          { label: "Pricing", hash: "pricing" },
          { label: "Exclusions & waiting periods", hash: "exclusions" },
        ],
      },
      {
        title: "Identifiers",
        slug: "identifiers",
        path: "data-standards/identifiers",
      },
      {
        title: "FHIR R4 mapping",
        slug: "fhir",
        path: "data-standards/fhir",
      },
      {
        title: "Money & timestamps",
        slug: "money-time",
        path: "data-standards/money-time",
      },
    ],
  },
  {
    title: "Resources",
    icon: "Box",
    pages: [
      {
        title: "Plans",
        slug: "plans",
        path: "plans",
        anchors: [
          { label: "List plans", hash: "list-plans" },
          { label: "Retrieve a plan", hash: "retrieve-a-plan" },
        ],
      },
      {
        title: "Quotes",
        slug: "quotes",
        path: "quotes",
        anchors: [
          { label: "Create a quote", hash: "create-a-quote" },
          { label: "Quote response", hash: "quote-response" },
          { label: "Pricing rules", hash: "pricing-rules" },
        ],
      },
      {
        title: "Enrollment",
        slug: "enrollment",
        path: "enrollment",
        anchors: [
          { label: "Enroll a member", hash: "enroll-a-member" },
          { label: "Idempotency", hash: "idempotency" },
          { label: "Household enrollment", hash: "household" },
          { label: "Lifecycle events", hash: "events" },
        ],
      },
      {
        title: "Policies",
        slug: "policies",
        path: "policies",
        anchors: [
          { label: "Retrieve a policy", hash: "retrieve-a-policy" },
          { label: "Renewals", hash: "renewals" },
          { label: "Cancellations", hash: "cancellations" },
        ],
      },
      {
        title: "Claims",
        slug: "claims",
        path: "claims",
        anchors: [
          { label: "Submit a claim", hash: "submit-a-claim" },
          { label: "Status codes", hash: "status-codes" },
        ],
      },
      {
        title: "Verification",
        slug: "verification",
        path: "verification",
      },
      {
        title: "Providers",
        slug: "providers",
        path: "providers",
      },
    ],
  },
  {
    title: "Events & webhooks",
    icon: "Webhook",
    pages: [
      {
        title: "Webhooks",
        slug: "webhooks",
        path: "webhooks",
        anchors: [
          { label: "Event catalogue", hash: "event-catalogue" },
          { label: "Subscribing", hash: "subscribing" },
          { label: "Signature verification", hash: "signature" },
          { label: "Retries", hash: "retries" },
        ],
      },
    ],
  },
  {
    title: "Commerce",
    icon: "Wallet",
    pages: [
      {
        title: "Commission & revenue",
        slug: "commission",
        path: "commission",
        anchors: [
          { label: "Commission models", hash: "models" },
          { label: "Revenue split", hash: "split" },
          { label: "Settlement", hash: "settlement" },
        ],
      },
      {
        title: "Ledger & reconciliation",
        slug: "ledger",
        path: "ledger",
        anchors: [
          { label: "Ledger accounts", hash: "accounts" },
          { label: "Reconciliation jobs", hash: "jobs" },
        ],
      },
      {
        title: "Premium collection",
        slug: "payments",
        path: "payments",
      },
    ],
  },
  {
    title: "Intelligence",
    icon: "Sparkles",
    pages: [
      {
        title: "AI layer",
        slug: "ai-layer",
        path: "ai-layer",
        anchors: [
          { label: "fraud_score", hash: "fraud-score" },
          { label: "identity_confidence", hash: "identity-confidence" },
          { label: "lapse_risk_score", hash: "lapse-risk-score" },
          { label: "value_score", hash: "value-score" },
          { label: "Auditability", hash: "auditability" },
        ],
      },
    ],
  },
  {
    title: "Records API",
    icon: "FileText",
    pages: [
      {
        title: "Overview",
        slug: "records-overview",
        path: "records/overview",
        summary:
          "Convert paper-based patient records into validated, FHIR R4-compliant data and pull them into your EMR, HMS, or partner system.",
        anchors: [
          { label: "How it works", hash: "how-it-works" },
          { label: "Who it's for", hash: "who-its-for" },
          { label: "What you get back", hash: "what-you-get" },
        ],
      },
      {
        title: "Capture options",
        slug: "records-capture",
        path: "records/capture",
        anchors: [
          { label: "Mobile capture (available)", hash: "mobile" },
          { label: "Direct upload", hash: "direct" },
          { label: "Scanner integrations (roadmap)", hash: "scanners" },
        ],
      },
      {
        title: "Ingest documents",
        slug: "records-ingest",
        path: "records/ingest",
        anchors: [
          { label: "Endpoint", hash: "endpoint" },
          { label: "Document types", hash: "types" },
          { label: "Job lifecycle", hash: "lifecycle" },
        ],
      },
      {
        title: "Organizations",
        slug: "records-organizations",
        path: "records/organizations",
      },
      {
        title: "Patients",
        slug: "records-patients",
        path: "records/patients",
        anchors: [
          { label: "List patients", hash: "list" },
          { label: "Patient FHIR bundle", hash: "bundle" },
          { label: "Identifiers", hash: "identifiers" },
        ],
      },
      {
        title: "Patient mapping",
        slug: "patient-mapping",
        path: "patient-mapping",
        summary:
          "How Pierflow groups multi-page charts, detects duplicates, and maps Pierflow patient ids to your EMR's ids.",
        anchors: [
          { label: "Chart folders", hash: "chart-folders" },
          { label: "Duplicate detection", hash: "duplicates" },
          { label: "Partner patient links", hash: "partner-links" },
          { label: "FHIR Bundle with your id", hash: "fhir-bundle" },
        ],
      },
      {
        title: "Import packages",
        slug: "records-packages",
        path: "records/packages",
        anchors: [
          { label: "Why packages", hash: "why" },
          { label: "Listing packages", hash: "list" },
          { label: "Downloading", hash: "download" },
          { label: "Acknowledging", hash: "ack" },
        ],
      },
      {
        title: "Confidence & review",
        slug: "records-confidence",
        path: "records/confidence",
      },
    ],
  },
  {
    title: "Trust",
    icon: "Lock",
    pages: [
      {
        title: "Security & compliance",
        slug: "security",
        path: "security",
        anchors: [
          { label: "Encryption", hash: "encryption" },
          { label: "RBAC", hash: "rbac" },
          { label: "PHI isolation", hash: "phi" },
          { label: "NDPR", hash: "ndpr" },
        ],
      },
    ],
  },
  {
    title: "Reference",
    icon: "BookOpen",
    pages: [
      { title: "Errors", slug: "errors", path: "errors" },
      { title: "Changelog", slug: "changelog", path: "changelog" },
    ],
  },
];

/** Flat list — used by search and prev/next nav. */
export const DOCS_FLAT = DOCS_TREE.flatMap((section) =>
  section.pages.map((p) => ({ ...p, sectionTitle: section.title })),
);
