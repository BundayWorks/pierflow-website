/**
 * Local webhook sink for testing.
 *
 * Run on a different port from the Pierflow dev server so both can
 * coexist on localhost. Pretty-prints every delivery to the terminal
 * — full headers + JSON body — so you can watch the lifecycle events
 * arrive in real time.
 *
 * Usage:
 *   node scripts/local-webhook-sink.mjs
 *   (default port: 4000)
 *
 *   node scripts/local-webhook-sink.mjs --port=5000
 *   PORT=4100 node scripts/local-webhook-sink.mjs
 *
 * Register http://localhost:4000/ as a webhook endpoint inside the
 * Pierflow portal. Every delivery shows up here with:
 *
 *   • Timestamp
 *   • Event type (parsed from the body)
 *   • All headers (the X-Pierflow-Signature is the HMAC)
 *   • Pretty-printed JSON body
 *
 * Press Ctrl+C to stop. Receipts are not persisted — close the
 * terminal and they're gone.
 */

import { createServer } from "node:http";

// ── Parse port from --port=N, env, or default ─────────────────────
const argPort = process.argv
  .find((a) => a.startsWith("--port="))
  ?.split("=")[1];
const PORT = Number(argPort ?? process.env.PORT ?? 4000);

// ── ANSI colours for the terminal output ──────────────────────────
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

function color(c, text) {
  // Skip colours if not a TTY (e.g. piped to a file).
  if (!process.stdout.isTTY) return text;
  return `${c}${text}${C.reset}`;
}

let counter = 0;

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    counter++;
    const raw = Buffer.concat(chunks).toString("utf8");
    const ts = new Date().toISOString();

    let parsed;
    let eventName = "(no event)";
    try {
      parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.event) {
        eventName = parsed.event;
      }
    } catch {
      /* not JSON */
    }

    // Header banner
    console.log("");
    console.log(
      color(
        C.bold + C.green,
        `── #${counter} ─ ${ts} ─ ${req.method} ${req.url} ─`,
      ),
    );
    console.log(color(C.bold + C.cyan, `Event: ${eventName}`));

    // Headers (with HMAC signature highlighted)
    console.log(color(C.dim, "Headers:"));
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (key === "x-pierflow-signature") {
        console.log(`  ${color(C.yellow, k)}: ${v}`);
      } else if (key === "content-type" || key === "user-agent") {
        console.log(`  ${color(C.dim, k)}: ${color(C.dim, v)}`);
      } else {
        console.log(`  ${color(C.dim, k)}: ${v}`);
      }
    }

    // Body
    if (parsed) {
      console.log(color(C.dim, "Body:"));
      console.log(color(C.magenta, JSON.stringify(parsed, null, 2)));
    } else if (raw.length > 0) {
      console.log(color(C.dim, "Body (raw, non-JSON):"));
      console.log(raw);
    } else {
      console.log(color(C.dim, "(empty body)"));
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ received: true, sink_id: counter }));
  });

  req.on("error", (err) => {
    console.error(color(C.red, "Request error:"), err.message);
    res.statusCode = 500;
    res.end("error");
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log(color(C.bold + C.green, `Pierflow local webhook sink`));
  console.log(color(C.dim, "─".repeat(40)));
  console.log(`  Listening on ${color(C.cyan, `http://localhost:${PORT}/`)}`);
  console.log(
    `  Register this URL as a webhook endpoint in the partner portal.`,
  );
  console.log(`  Press ${color(C.bold, "Ctrl+C")} to stop.`);
  console.log("");
});

process.on("SIGINT", () => {
  console.log("");
  console.log(
    color(C.dim, `Received ${counter} webhook${counter === 1 ? "" : "s"}.`),
  );
  console.log(color(C.dim, "Stopping sink."));
  server.close(() => process.exit(0));
});
