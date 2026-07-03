/**
 * Fetch a magazine's freely-published master index PDF and extract its raw text.
 *
 * Usage:
 *   node scripts/scrape/fetch-index-pdf.mjs <series-slug> <pdf-url> [<pdf-url> ...]
 *
 * Multiple URLs are concatenated (some series split their index across
 * decade-range PDFs). Output is written to scratch/toc/<series-slug>-index-raw.txt.
 */

import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const OUT_DIR = path.resolve("scratch/toc");

async function fetchPdfText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "OpenLibry-guild-cataloging-bot/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const { text } = await pdfParse(buffer);
  return text;
}

async function main() {
  const [seriesSlug, ...urls] = process.argv.slice(2);

  if (!seriesSlug || urls.length === 0) {
    console.error(
      "Usage: node scripts/scrape/fetch-index-pdf.mjs <series-slug> <pdf-url> [<pdf-url> ...]",
    );
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const chunks = [];
  for (const url of urls) {
    console.log(`Fetching ${url}...`);
    try {
      const text = await fetchPdfText(url);
      chunks.push(`\n\n===== SOURCE: ${url} =====\n\n${text}`);
      console.log(`  ✓ extracted ${text.length} characters`);
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
    }
    // Be polite between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  const outPath = path.join(OUT_DIR, `${seriesSlug}-index-raw.txt`);
  await fs.writeFile(outPath, chunks.join("\n"), "utf8");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
