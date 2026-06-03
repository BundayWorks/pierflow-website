// Standalone Cloudinary smoke-test.
// Run with: node --env-file=.env.local scripts/test-cloudinary.mjs
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

console.log("cloud:", process.env.CLOUDINARY_CLOUD_NAME);

try {
  // Lightweight authenticated call — lists root resources (empty is fine).
  const r = await cloudinary.api.ping();
  console.log("ping OK:", r.status);
} catch (e) {
  console.error("FAIL:", e.message);
  process.exitCode = 1;
}
