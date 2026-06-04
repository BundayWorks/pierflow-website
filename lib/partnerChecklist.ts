/**
 * Computes the production-access checklist state for a Partner.
 *
 * The four required items (sandbox approved, email verified, first API
 * call, signed DPA + security questionnaire) gate the "Request
 * production access" button on the partner dashboard.
 */
import type {
  Partner,
  PartnerAgreement,
  PartnerApiKey,
  PartnerSecurityAssessment,
  PartnerUser,
} from "@prisma/client";

export type ChecklistKey =
  | "sandboxApproved"
  | "emailVerified"
  | "firstApiCall"
  | "dpaSigned"
  | "securityAssessment";

export type ChecklistItem = {
  key: ChecklistKey;
  label: string;
  description: string;
  owner: "partner" | "pierflow";
  done: boolean;
  blockedBy?: ChecklistKey;
};

export type ChecklistState = {
  items: ChecklistItem[];
  doneCount: number;
  requiredCount: number;
  allRequiredDone: boolean;
};

export type PartnerForChecklist = Partner & {
  users: Pick<PartnerUser, "joinedAt" | "externalId">[];
  apiKeys: Pick<PartnerApiKey, "lastUsedAt" | "revokedAt">[];
  agreements: Pick<PartnerAgreement, "kind">[];
  securityAssessment: Pick<PartnerSecurityAssessment, "completedAt"> | null;
};

export function buildChecklist(
  partner: PartnerForChecklist,
  emailVerified: boolean,
): ChecklistState {
  const sandboxApproved =
    partner.accessStatus !== "PENDING_SANDBOX" &&
    partner.accessStatus !== "SUSPENDED";

  const firstApiCall = partner.apiKeys.some(
    (k) => k.lastUsedAt !== null && k.revokedAt === null,
  );

  const dpaSigned = partner.agreements.some((a) => a.kind === "DPA");

  const securityAssessment =
    partner.securityAssessment?.completedAt != null;

  const items: ChecklistItem[] = [
    {
      key: "sandboxApproved",
      label: "Sandbox access approved",
      description:
        "Pierflow reviews your account and issues your first sandbox key. Usually within one business day.",
      owner: "pierflow",
      done: sandboxApproved,
    },
    {
      key: "emailVerified",
      label: "Verify your email",
      description:
        "Confirm the email address you signed up with via the link in your inbox.",
      owner: "partner",
      done: emailVerified,
    },
    {
      key: "firstApiCall",
      label: "Make your first sandbox API call",
      description:
        "Send a request to /v1/organizations with your sandbox key to confirm your integration works end-to-end.",
      owner: "partner",
      done: firstApiCall,
      blockedBy: sandboxApproved ? undefined : "sandboxApproved",
    },
    {
      key: "dpaSigned",
      label: "Sign the data processing agreement",
      description:
        "Click-to-sign DPA covering how you'll handle records on behalf of organisations.",
      owner: "partner",
      done: dpaSigned,
    },
    {
      key: "securityAssessment",
      label: "Complete the security questionnaire",
      description:
        "Tell us how data is stored, who can access it, and how long you retain it.",
      owner: "partner",
      done: securityAssessment,
    },
  ];

  const requiredCount = items.length;
  const doneCount = items.filter((i) => i.done).length;

  return {
    items,
    doneCount,
    requiredCount,
    allRequiredDone: doneCount === requiredCount,
  };
}
