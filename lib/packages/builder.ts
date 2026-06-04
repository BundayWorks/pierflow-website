/**
 * Import Package builder.
 *
 * Once per cycle, walk every (Partner, Organization) link and gather the
 * validated extracted records the partner hasn't received yet. Assemble
 * a ZIP containing:
 *
 *   manifest.json           ← package metadata + record index
 *   patients/<pat_id>.json  ← one FHIR R4 Bundle per patient
 *   checksum.sha256         ← SHA-256 hash of every file in the archive
 *
 * Upload the ZIP to Cloudinary's private 'raw' storage and create an
 * ImportPackage row in READY status. The partner downloads via
 * /v1/import-packages/:id/download (which returns a signed Cloudinary
 * URL) and acknowledges via /v1/import-packages/:id/acknowledge.
 */

import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import JSZip from "jszip";
import { db } from "@/lib/db";
import type { FhirBundle } from "@/lib/fhir/mapper";

const PACKAGE_TTL_DAYS = 7;

type BuildOptions = {
  /** Limit the build to one org (testing). Otherwise builds for all. */
  organizationId?: string;
  /** Limit the build to one partner (testing). Otherwise all partners. */
  partnerId?: string;
};

export type BuildResult = {
  packagesBuilt: number;
  partnersConsidered: number;
};

export async function buildPendingImportPackages(
  opts: BuildOptions = {},
): Promise<BuildResult> {
  ensureCloudinary();

  // Resolve the (Partner, Organization) pairs to consider.
  const links = await db.partnerOrganizationLink.findMany({
    where: {
      ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      partner: { isActive: true },
      organization: { isActive: true },
    },
    select: {
      partnerId: true,
      organizationId: true,
      partner: { select: { id: true, slug: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  let packagesBuilt = 0;

  for (const link of links) {
    const built = await buildPackageForPair({
      partnerId: link.partnerId,
      organizationId: link.organizationId,
      partnerSlug: link.partner.slug,
      organizationName: link.organization.name,
    });
    if (built) packagesBuilt++;
  }

  return { packagesBuilt, partnersConsidered: links.length };
}

async function buildPackageForPair(input: {
  partnerId: string;
  organizationId: string;
  partnerSlug: string;
  organizationName: string;
}): Promise<boolean> {
  // Candidate records: validated, not yet packaged for this partner.
  const records = await db.extractedRecord.findMany({
    where: {
      organizationId: input.organizationId,
      validationStatus: { in: ["AUTO_APPROVED", "VALIDATED"] },
      importPackageId: null,
      patientId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      patientId: true,
      fhirBundle: true,
    },
    take: 5000,
  });

  if (records.length === 0) return false;

  // Group records by patient so each patient ends up as one bundle file.
  const byPatient = new Map<string, FhirBundle["entry"]>();
  const recordIdsByPatient = new Map<string, string[]>();
  for (const r of records) {
    if (!r.patientId || !r.fhirBundle) continue;
    const bundle = r.fhirBundle as unknown as FhirBundle;
    if (!Array.isArray(bundle.entry)) continue;
    const acc = byPatient.get(r.patientId) ?? [];
    acc.push(...bundle.entry);
    byPatient.set(r.patientId, acc);
    const ids = recordIdsByPatient.get(r.patientId) ?? [];
    ids.push(r.id);
    recordIdsByPatient.set(r.patientId, ids);
  }

  if (byPatient.size === 0) return false;

  // Pull canonical Patient resources to anchor each bundle.
  const patients = await db.patient.findMany({
    where: { id: { in: Array.from(byPatient.keys()) } },
    include: {
      identifiers: { select: { system: true, value: true, use: true } },
    },
  });

  const zip = new JSZip();
  const fileChecksums: { path: string; sha256: string }[] = [];

  const manifest = {
    package_format: "FHIR_R4_JSON",
    organization_id: input.organizationId,
    organization_name: input.organizationName,
    partner_id: input.partnerId,
    built_at: new Date().toISOString(),
    patient_count: byPatient.size,
    record_count: records.length,
    patients: [] as { patient_id: string; mrn: string | null; file: string; record_count: number }[],
  };

  for (const patient of patients) {
    const entries = byPatient.get(patient.id) ?? [];
    // Prepend canonical Patient resource and de-duplicate Patient entries
    // from the per-record bundles.
    const canonicalPatient = {
      fullUrl: `Patient/${patient.id}`,
      resource: {
        resourceType: "Patient" as const,
        id: patient.id,
        identifier: patient.identifiers.map((i) => ({
          system: i.system,
          value: i.value,
          use: i.use ?? undefined,
        })),
        name: [{ use: "official", text: patient.fullName, ...splitName(patient.fullName) }],
        gender:
          patient.sex === "M"
            ? "male"
            : patient.sex === "F"
              ? "female"
              : "unknown",
        birthDate: patient.dateOfBirth
          ? patient.dateOfBirth.toISOString().slice(0, 10)
          : undefined,
      },
    };
    const merged: FhirBundle["entry"] = [canonicalPatient as FhirBundle["entry"][number]];
    const seen = new Set<string>([`Patient/${patient.id}`]);
    for (const e of entries) {
      const r = e.resource as { resourceType: string; id: string };
      if (r.resourceType === "Patient") continue;
      if (r.resourceType === "Organization") continue;
      const key = `${r.resourceType}/${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(e);
    }

    const bundle: FhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      total: merged.length,
      entry: merged,
    };

    const filePath = `patients/${patient.id}.json`;
    const json = JSON.stringify(bundle, null, 2);
    zip.file(filePath, json);
    const sha = createHash("sha256").update(json).digest("hex");
    fileChecksums.push({ path: filePath, sha256: sha });

    manifest.patients.push({
      patient_id: patient.id,
      mrn:
        patient.identifiers.find((i) => i.system === "https://pierflow.com/mrn")
          ?.value ?? null,
      file: filePath,
      record_count: recordIdsByPatient.get(patient.id)?.length ?? 0,
    });
  }

  const manifestJson = JSON.stringify(manifest, null, 2);
  zip.file("manifest.json", manifestJson);
  fileChecksums.unshift({
    path: "manifest.json",
    sha256: createHash("sha256").update(manifestJson).digest("hex"),
  });

  const checksumFile = fileChecksums.map((c) => `${c.sha256}  ${c.path}`).join("\n") + "\n";
  zip.file("checksum.sha256", checksumFile);

  // Generate the archive
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const archiveSha = createHash("sha256").update(zipBuffer).digest("hex");

  // Upload as raw (we don't want Cloudinary applying image transforms to
  // a ZIP).
  const publicId = `pierflow/packages/${input.partnerSlug}/${input.organizationId}/${Date.now()}`;
  const upload = await new Promise<{ public_id: string; secure_url: string; bytes: number }>(
    (resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: publicId,
          type: "upload",
          format: "zip",
        },
        (err, result) => {
          if (err || !result) return reject(err);
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            bytes: result.bytes,
          });
        },
      );
      uploadStream.end(zipBuffer);
    },
  );

  // Persist the package row and mark the included records as packaged.
  const expiresAt = new Date(Date.now() + PACKAGE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const pkg = await db.$transaction(async (tx) => {
    const created = await tx.importPackage.create({
      data: {
        organizationId: input.organizationId,
        partnerId: input.partnerId,
        status: "READY",
        patientCount: manifest.patient_count,
        recordCount: manifest.record_count,
        archiveAsset: {
          publicId: upload.public_id,
          secureUrl: upload.secure_url,
          format: "zip",
          resourceType: "raw",
        },
        fileSizeBytes: BigInt(upload.bytes),
        checksumSha256: archiveSha,
        expiresAt,
      },
    });
    await tx.extractedRecord.updateMany({
      where: { id: { in: records.map((r) => r.id) } },
      data: { importPackageId: created.id },
    });
    return created;
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[packages] built ${pkg.id} (${manifest.patient_count} patients, ${manifest.record_count} records, ${upload.bytes} bytes)`,
    );
  }
  return true;
}

function ensureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function splitName(text: string): { family?: string; given?: string[] } {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { family: parts[0] };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1) };
}
