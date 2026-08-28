/**
 * Exports the English process book from Markdown to a single clean PDF
 * (no header/footer, no file URL, no print date) with Mermaid diagrams rendered.
 *
 * Default output: Resonant-Sips-Process-Book-English-2026-04-25.pdf (no spaces; easy to find in Explorer)
 *
 * Usage:
 *   node scripts/export-process-book-pdf.mjs
 *   node scripts/export-process-book-pdf.mjs [input.md] [output.pdf]
 *   node scripts/export-process-book-pdf.mjs [output-only.pdf]   (single arg ending in .pdf)
 *
 * Requires: puppeteer-core, local Chrome, pandoc on PATH, network for mermaid CDN.
 */
import { execFileSync, execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DEFAULT_MD = "process book - English - 2026-04-25.md";
const DEFAULT_OUT = "Resonant-Sips-Process-Book-English-2026-04-25.pdf";
const ALT_WHEN_LOCKED = "Resonant-Sips-Process-Book-English-UNLOCK-AND-RETRY.pdf";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

const MERMAID_BOOTSTRAP = `
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  (async function () {
    if (typeof mermaid === "undefined") return;
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      flowchart: { useMaxWidth: true, htmlLabels: true, padding: 10 },
      themeVariables: { fontSize: "12px" },
    });
    document.querySelectorAll("pre.mermaid").forEach(function (pre) {
      var code = pre.querySelector("code");
      if (!code) return;
      var div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = code.textContent;
      pre.replaceWith(div);
    });
    await mermaid.run();
  })().catch(function () {});
});
</script>
`.trim();

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findPandoc() {
  try {
    if (process.platform === "win32") {
      const out = execSync("where pandoc", { encoding: "utf8" });
      const line = out.split(/\r?\n/)[0]?.trim();
      if (line && fs.existsSync(line)) return line;
    } else {
      const out = execSync("command -v pandoc", { encoding: "utf8" });
      const p = out.trim();
      if (p) return p;
    }
  } catch {
    // ignore
  }
  return "pandoc";
}

function buildHtmlFromMd(mdPath) {
  const cssPath = path.join(root, "DOC", "pdf-github-like.css");
  if (!fs.existsSync(mdPath)) {
    throw new Error("Markdown not found: " + mdPath);
  }
  if (!fs.existsSync(cssPath)) {
    throw new Error("CSS not found: " + cssPath);
  }
  const pandoc = findPandoc();
  return execFileSync(
    pandoc,
    [mdPath, "-s", "-c", cssPath, "-f", "markdown", "-t", "html5", "-o", "-"],
    { encoding: "utf8" }
  );
}

function injectMermaid(html) {
  const i = html.lastIndexOf("</body>");
  if (i === -1) {
    return html + "\n" + MERMAID_BOOTSTRAP;
  }
  return html.slice(0, i) + MERMAID_BOOTSTRAP + "\n" + html.slice(i);
}

/** Resolve relative <img src> against repo root (temp HTML used to live in tmp and broke paths). */
function injectBaseHref(html, projectRoot) {
  let baseHref = pathToFileURL(path.resolve(projectRoot)).href;
  if (!baseHref.endsWith("/")) baseHref += "/";
  const tag = `<base href="${baseHref}">`;
  const m = html.match(/<head[^>]*>/i);
  if (m) {
    return html.replace(m[0], m[0] + "\n" + tag);
  }
  if (html.includes("</head>")) {
    return html.replace("</head>", tag + "\n</head>");
  }
  return tag + "\n" + html;
}

async function waitForImages(page) {
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images).map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          })
      )
    );
  });
}

function resolveArgs() {
  const a2 = process.argv[2];
  const a3 = process.argv[3];
  const defaultMd = path.join(root, DEFAULT_MD);
  const defaultOut = path.join(root, DEFAULT_OUT);
  if (a2 && a2.toLowerCase().endsWith(".pdf") && !a3) {
    return {
      md: defaultMd,
      out: path.isAbsolute(a2) ? a2 : path.join(root, a2),
    };
  }
  if (a2) {
    return {
      md: path.isAbsolute(a2) ? a2 : path.join(root, a2),
      out: a3 ? (path.isAbsolute(a3) ? a3 : path.join(root, a3)) : defaultOut,
    };
  }
  return { md: defaultMd, out: defaultOut };
}

async function main() {
  const { md: mdPath, out: outPath } = resolveArgs();
  const execPath = findChrome();
  if (!execPath) {
    console.error("No Chrome/Edge found in standard locations.");
    process.exit(1);
  }

  let rawHtml;
  try {
    rawHtml = buildHtmlFromMd(mdPath);
  } catch (e) {
    console.error("Pandoc failed. Install pandoc and ensure it is on PATH.", e?.message || e);
    process.exit(1);
  }
  let html = injectMermaid(rawHtml);
  html = injectBaseHref(html, root);
  const tmp = path.join(root, ".process-book-en-print-tmp.html");
  fs.writeFileSync(tmp, html, "utf8");

  const fileUrl = pathToFileURL(tmp).href;
  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: "new",
    args: ["--allow-file-access-from-files", "--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
  await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 120000 });
  try {
    await waitForImages(page);
  } catch {
    // still export
  }
  try {
    await page.waitForFunction(() => document.querySelector("svg") !== null, {
      timeout: 90000,
      polling: 200,
    });
  } catch {
    // Mermaid or network: still export text
  }
  await page.emulateMediaType("print");
  const tmpPdf = path.join(os.tmpdir(), `rs-process-book-${Date.now()}.pdf`);
  await page.pdf({
    path: tmpPdf,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: false,
    preferCSSPageSize: false,
    margin: { top: "20mm", right: "22mm", bottom: "22mm", left: "22mm" },
  });
  await browser.close();
  try {
    fs.unlinkSync(tmp);
  } catch {
    // ignore
  }
  try {
    fs.copyFileSync(tmpPdf, outPath);
    fs.unlinkSync(tmpPdf);
    console.log("Wrote", outPath);
  } catch {
    const alt = path.join(root, ALT_WHEN_LOCKED);
    try {
      fs.copyFileSync(tmpPdf, alt);
      fs.unlinkSync(tmpPdf);
      console.warn("Target PDF is locked or busy. Wrote instead:", alt);
      console.warn("Close any viewer using the target file, then run again to overwrite", outPath);
    } catch (e) {
      fs.unlinkSync(tmpPdf);
      throw e;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
