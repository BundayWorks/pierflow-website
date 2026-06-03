// Standalone Haiku extraction smoke test.
// Sends a public test image to Claude Haiku 4.5 and prints the result.
// Run with: node --env-file=.env.local scripts/test-haiku.mjs
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Public test image — a stock prescription pad photo so we exercise
// the multimodal + medical-text path without needing a real upload.
const IMAGE_URL =
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1024";

console.log("calling claude-haiku-4-5...");
const t0 = Date.now();

const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: "You are a Nigerian clinical records specialist. Reply with a single JSON object describing what you see in the image: { type, has_text, summary, _confidence: 0..1 }. Nothing else.",
      cache_control: { type: "ephemeral" },
    },
  ],
  messages: [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "url", url: IMAGE_URL } },
        { type: "text", text: "Describe this." },
      ],
    },
  ],
});

const ms = Date.now() - t0;
const text = response.content
  .filter((c) => c.type === "text")
  .map((c) => ("text" in c ? c.text : ""))
  .join("\n");

console.log("ok (" + ms + "ms)");
console.log("---");
console.log(text);
console.log("---");
console.log("tokens:", response.usage);
