// End-to-end test: build a signed upload the same way our server does,
// then upload a tiny image as a Cloudinary client would, verifying the
// signature is accepted.
//
// Run with: node --env-file=.env.local scripts/test-signed-upload.mjs
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const timestamp = Math.floor(Date.now() / 1000);
const folder = "pierflow/_smoke/sign-endpoint";
const params = { folder, timestamp, type: "upload" };
const signature = cloudinary.utils.api_sign_request(
  params,
  process.env.CLOUDINARY_API_SECRET,
);

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

// 1x1 transparent PNG, base64 — small, valid image, deterministic.
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const form = new FormData();
form.append("file", `data:image/png;base64,${pngBase64}`);
form.append("api_key", process.env.CLOUDINARY_API_KEY);
form.append("timestamp", String(timestamp));
form.append("folder", folder);
form.append("type", "upload");
form.append("signature", signature);

const res = await fetch(uploadUrl, { method: "POST", body: form });
const body = await res.json();

if (res.ok) {
  console.log("Upload OK:");
  console.log("  public_id:", body.public_id);
  console.log("  bytes:", body.bytes);
  console.log("  url:", body.secure_url);
} else {
  console.error("Upload FAIL:", res.status, body);
  process.exitCode = 1;
}
