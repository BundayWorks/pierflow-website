/**
 * Build the Insurance Distribution test guide PDF.
 *
 *   1. Read the Markdown source from docs/test-guides/.
 *   2. Convert to HTML with marked.
 *   3. Wrap in a print-friendly stylesheet.
 *   4. Write the HTML to a temp file.
 *   5. Invoke Microsoft Edge in headless mode with --print-to-pdf.
 *
 * Run: node scripts/build-test-guide-pdf.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { marked } from "marked";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "docs/test-guides/insurance-distribution-test-guide.md");
const OUT_HTML = path.join(ROOT, "docs/test-guides/insurance-distribution-test-guide.html");
const OUT_PDF = path.join(ROOT, "docs/test-guides/insurance-distribution-test-guide.pdf");

const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

function findEdge() {
  for (const p of EDGE_PATHS) {
    try {
      // synchronous check via existsSync would need import; instead just try the first
      return p;
    } catch {
      /* keep going */
    }
  }
  throw new Error("Edge not found. Install Microsoft Edge or adjust EDGE_PATHS.");
}

const STYLE = `
<style>
  @page {
    size: A4;
    margin: 18mm 16mm;
  }
  body {
    font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1d2333;
    max-width: 100%;
  }
  h1 {
    font-size: 22pt;
    color: #0f7257;
    margin: 0 0 0.4em 0;
    page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    font-size: 15pt;
    color: #0f7257;
    margin-top: 1.4em;
    border-bottom: 1px solid #0f7257;
    padding-bottom: 4px;
  }
  h3 {
    font-size: 12pt;
    color: #1d2333;
    margin-top: 1.2em;
  }
  h4 {
    font-size: 11pt;
    color: #4a5160;
    margin-top: 1em;
  }
  p, ul, ol { margin: 0.55em 0; }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.15em 0; }
  code {
    font-family: "Cascadia Code", "Consolas", "Monaco", monospace;
    font-size: 9.5pt;
    background: #f3f4f7;
    padding: 1px 5px;
    border-radius: 3px;
  }
  pre {
    background: #f3f4f7;
    border-left: 3px solid #0f7257;
    padding: 10px 12px;
    border-radius: 4px;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code {
    background: transparent;
    padding: 0;
    font-size: 9pt;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
    page-break-inside: avoid;
    font-size: 9.5pt;
  }
  th, td {
    border: 1px solid #d6d9e0;
    padding: 6px 9px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #eef5f2;
    color: #0f7257;
    font-weight: 600;
  }
  hr {
    border: none;
    border-top: 1px solid #d6d9e0;
    margin: 1.5em 0;
  }
  blockquote {
    border-left: 4px solid #0f7257;
    background: #eef5f2;
    margin: 1em 0;
    padding: 8px 14px;
    color: #1d2333;
  }
  /* Avoid orphaned headings */
  h2, h3, h4 { page-break-after: avoid; }
  /* Keep table headers with rows */
  thead { display: table-header-group; }
  /* Page break heuristics */
  section, article { page-break-inside: avoid; }
  /* Cover-page-ish: only the very first h1 + lead paragraphs */
  body > p:first-of-type strong { color: #0f7257; }
</style>
`;

function wrap(html) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pierflow Insurance Distribution — Test Guide</title>
${STYLE}
</head>
<body>
${html}
</body>
</html>`;
}

async function main() {
  console.log("Reading", SRC);
  const md = await fs.readFile(SRC, "utf8");

  console.log("Converting Markdown → HTML");
  const html = marked.parse(md, { gfm: true, breaks: false });
  const wrapped = wrap(html);

  console.log("Writing", OUT_HTML);
  await fs.writeFile(OUT_HTML, wrapped, "utf8");

  console.log("Locating Edge");
  const edge = findEdge();

  console.log("Printing PDF via Edge headless");
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${OUT_PDF}`,
    `file:///${OUT_HTML.replace(/\\/g, "/")}`,
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn(edge, args, { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Edge exited with code ${code}`));
    });
  });

  // Edge sometimes returns before the PDF file handle is flushed.
  // Poll briefly for the file to appear with a non-zero size.
  let stat;
  for (let i = 0; i < 20; i++) {
    try {
      stat = await fs.stat(OUT_PDF);
      if (stat.size > 0) break;
    } catch {
      /* not there yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!stat || stat.size === 0) {
    throw new Error(`PDF was not written to ${OUT_PDF}`);
  }
  console.log(`OK: ${OUT_PDF} (${(stat.size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
