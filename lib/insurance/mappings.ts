/**
 * ConnectorMapping persistence + lifecycle.
 *
 *   createDraftFromProposal()  store a fresh Haiku proposal as DRAFT
 *   activateMapping()          flip DRAFT → ACTIVE, SUPERSEDED the old one
 *   getActiveMapping()         what the runtime path reads on every push
 *   listMappingsForProvider()  staff portal queue
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  Proposal,
  Template,
  TemplateField,
} from "@/lib/insurance/normalise";

export type CreateDraftInput = {
  providerId: string;
  sample: unknown;
  proposal: Proposal;
  /** Optional staff-curated template overlay. If omitted, we derive
   *  from the proposal — the reviewer can edit it before activating. */
  template?: Template;
  createdByExternalId?: string;
};

export async function createDraftFromProposal(input: CreateDraftInput) {
  const latest = await db.connectorMapping.findFirst({
    where: { providerId: input.providerId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const template =
    input.template ?? deriveTemplateFromProposal(input.proposal);

  return db.connectorMapping.create({
    data: {
      providerId: input.providerId,
      version: nextVersion,
      status: "DRAFT",
      sample: input.sample as Prisma.InputJsonValue,
      proposal: input.proposal as unknown as Prisma.InputJsonValue,
      template: template as unknown as Prisma.InputJsonValue,
      averageConfidence: input.proposal.averageConfidence,
      lowConfidenceFields: input.proposal.lowConfidencePaths.length,
      createdByExternalId: input.createdByExternalId,
      modelId: input.proposal.diagnostics.model,
      promptVersion: input.proposal.diagnostics.promptVersion,
    },
    select: {
      id: true,
      version: true,
      status: true,
      averageConfidence: true,
      lowConfidenceFields: true,
    },
  });
}

/**
 * Flip a draft to ACTIVE. The existing ACTIVE mapping (if any) for
 * the same provider becomes SUPERSEDED in the same transaction.
 */
export async function activateMapping(
  mappingId: string,
  reviewerExternalId?: string,
) {
  return db.$transaction(async (tx) => {
    const draft = await tx.connectorMapping.findUnique({
      where: { id: mappingId },
      select: { id: true, providerId: true, status: true },
    });
    if (!draft) throw new Error("MAPPING_NOT_FOUND");
    if (draft.status === "ACTIVE") return draft;
    if (draft.status === "ARCHIVED") {
      throw new Error("Cannot activate an archived mapping.");
    }
    await tx.connectorMapping.updateMany({
      where: {
        providerId: draft.providerId,
        status: "ACTIVE",
        id: { not: draft.id },
      },
      data: { status: "SUPERSEDED" },
    });
    return tx.connectorMapping.update({
      where: { id: draft.id },
      data: {
        status: "ACTIVE",
        reviewedAt: new Date(),
        reviewedByExternalId: reviewerExternalId,
        activatedAt: new Date(),
      },
      select: { id: true, status: true, version: true },
    });
  });
}

export async function getActiveMapping(providerId: string) {
  return db.connectorMapping.findFirst({
    where: { providerId, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      template: true,
      averageConfidence: true,
    },
  });
}

export async function listMappingsForProvider(providerId: string) {
  return db.connectorMapping.findMany({
    where: { providerId },
    orderBy: [{ version: "desc" }],
    select: {
      id: true,
      version: true,
      status: true,
      averageConfidence: true,
      lowConfidenceFields: true,
      createdAt: true,
      activatedAt: true,
    },
  });
}

/**
 * Build a runtime Template from a Haiku proposal. Used when a
 * reviewer accepts a proposal as-is without manual edits.
 */
export function deriveTemplateFromProposal(proposal: Proposal): Template {
  const template: Template = {};
  const rawFields = (proposal.fields ?? {}) as Record<string, unknown>;
  for (const [path, raw] of Object.entries(rawFields)) {
    if (typeof raw !== "object" || raw === null) continue;
    const node = raw as Record<string, unknown>;

    if ("each" in node) {
      // Defensive: Haiku occasionally returns each as a string, null,
      // or with the sub-fields under .template (its own confusion with
      // the runtime Template key) instead of .fields. Skip rather
      // than throw if we can't make sense of it.
      const each = node.each as Record<string, unknown> | null | undefined;
      if (!each || typeof each !== "object") continue;
      const jsonPath =
        typeof each.jsonPath === "string" ? each.jsonPath : null;
      if (!jsonPath) continue;
      const sub = (each.fields ?? each.template) as
        | Record<string, unknown>
        | null
        | undefined;
      if (!sub || typeof sub !== "object") continue;

      const subTemplate: Record<string, TemplateField> = {};
      for (const [subPath, subRaw] of Object.entries(sub)) {
        if (typeof subRaw !== "object" || subRaw === null) continue;
        const subField = subRaw as Record<string, unknown>;
        if (typeof subField.jsonPath !== "string") continue;
        subTemplate[subPath] = {
          jsonPath: subField.jsonPath,
          ...(typeof subField.transform === "string"
            ? { transform: subField.transform as TemplateField["transform"] }
            : {}),
        };
      }
      template[path] = {
        each: { jsonPath, template: subTemplate },
      };
    } else {
      // Plain leaf field. Skip if jsonPath missing.
      if (typeof node.jsonPath !== "string") continue;
      template[path] = {
        jsonPath: node.jsonPath,
        ...(typeof node.transform === "string"
          ? { transform: node.transform as TemplateField["transform"] }
          : {}),
      };
    }
  }
  return template;
}
