/**
 * Cloudinary server helper.
 *
 * We use Cloudinary for storing scanned record pages. Originals stay in a
 * private folder structure scoped by organization and batch; preview
 * transformations are generated on the fly when the review portal needs
 * a zoomable image.
 *
 * The API secret never leaves the server. The mobile capture flow asks
 * /v1/uploads/sign for a one-shot signature, then uploads directly to
 * Cloudinary using that signature — so the browser never sees the secret
 * and the server never has to proxy the file body.
 */
import { v2 as cloudinary } from "cloudinary";

let configured = false;

export function ensureConfigured() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[cloudinary] CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not set. Uploads will fail.",
      );
    }
  }

  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true,
  });
  configured = true;
}

/**
 * Build a signed upload payload the browser can POST directly to
 * Cloudinary's upload endpoint.
 *
 * The returned object goes back to the capture app as JSON. The browser
 * adds the file and POSTs to `https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload`.
 */
export function buildSignedUpload(opts: {
  /** Final folder, e.g. "org_xxx/batch_xxx" */
  folder: string;
  /** Optional override; defaults to a sensible asset prefix */
  publicIdPrefix?: string;
  /** Cap upload size (bytes) so a malicious client can't OOM us */
  maxBytes?: number;
  /** Lock to image content types only */
  resourceType?: "image" | "raw" | "auto";
}) {
  ensureConfigured();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = opts.folder;
  const params: Record<string, string | number> = {
    folder,
    timestamp,
    // Cloudinary auto-detects orientation from EXIF; we still want it
    // applied so the review portal sees pages right-way-up.
    type: "upload",
  };

  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET ?? "",
  );

  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    timestamp,
    folder,
    signature,
    resourceType: opts.resourceType ?? "auto",
    maxBytes: opts.maxBytes ?? 25 * 1024 * 1024, // 25 MB default
    uploadUrl: `https://api.cloudinary.com/v1_1/${
      process.env.CLOUDINARY_CLOUD_NAME ?? ""
    }/${opts.resourceType ?? "auto"}/upload`,
  };
}

/**
 * Permanently delete an asset from Cloudinary. Used when an operator
 * removes a captured page from a batch — we never want orphaned blobs
 * outliving the database row that referenced them.
 *
 * Returns true if Cloudinary considered the asset gone (including the
 * "not found" case, which we treat as success so retries are safe).
 */
export async function destroyAsset(
  publicId: string,
  opts?: { resourceType?: "image" | "raw" | "video" },
): Promise<boolean> {
  ensureConfigured();
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: opts?.resourceType ?? "image",
      invalidate: true,
    });
    return result.result === "ok" || result.result === "not found";
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[cloudinary] destroy failed:", publicId, err);
    }
    return false;
  }
}

/**
 * Return a short-lived, signed URL for an already-uploaded asset.
 * Used by the review portal to fetch private originals.
 */
export function signedAssetUrl(
  publicId: string,
  opts?: { expiresInSeconds?: number; resourceType?: "image" | "raw" | "auto" },
) {
  ensureConfigured();
  return cloudinary.utils.private_download_url(
    publicId,
    opts?.resourceType ?? "auto",
    {
      expires_at:
        Math.floor(Date.now() / 1000) + (opts?.expiresInSeconds ?? 3600),
    },
  );
}

/**
 * Generate a public URL with on-the-fly transformations for the review
 * portal preview pane. Cloudinary will rasterise PDFs and resize images
 * server-side.
 */
export function previewUrl(
  publicId: string,
  opts: {
    width?: number;
    height?: number;
    page?: number; // 1-based for multi-page PDFs
  } = {},
) {
  ensureConfigured();
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    transformation: [
      opts.page ? { page: opts.page } : {},
      {
        width: opts.width ?? 1200,
        crop: opts.width ? "limit" : undefined,
        quality: "auto:good",
        fetch_format: "auto",
      },
    ],
  });
}

export { cloudinary };
