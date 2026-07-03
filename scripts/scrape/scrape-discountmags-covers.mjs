/**
 * Scrape cover images from a DiscountMags back-issues listing (paginated HTML,
 * no JSON API available). Used for magazines whose publisher doesn't run its
 * own back-issue shop with a clean cover-image source (e.g. PieceWork).
 *
 * Usage:
 *   node scripts/scrape/scrape-discountmags-covers.mjs <series-slug> <discountmags-magazine-slug>
 *
 * Example:
 *   node scripts/scrape/scrape-discountmags-covers.mjs piecework piecework-digital
 *
 * Downloads each issue's cover image to scratch/covers/<series-slug>/<issue-slug>.jpg
 * and appends a row to scratch/manifest.csv.
 */

import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";

const MANIFEST_PATH = path.resolve("scratch/manifest.csv");

// discountmags.com and its image CDN both sit behind bot protection that
// requires a full browser-like header set (UA + Accept + Referer) — a bare
// User-Agent alone gets 403'd on image requests.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,text/html,*/*;q=0.8",
  Referer: "https://www.discountmags.com/",
};

async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function appendManifestRow(row) {
  const exists = await fs
    .access(MANIFEST_PATH)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await fs.writeFile(
      MANIFEST_PATH,
      "series,handle,title,sourceUrl,localImagePath\n",
      "utf8",
    );
  }
  const escaped = row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  await fs.appendFile(MANIFEST_PATH, escaped + "\n", "utf8");
}

// Note: the "s=" query param on these image URLs is a signature over the
// other params (h/w/etc) — changing h/w without recomputing it 403s the
// request. Downloading the listing's own thumbnail size (368x484, a
// resizing-proxy WebP) as-is, rather than trying to upscale it, is what
// actually works and is plenty large enough for catalog thumbnails.

async function fetchPage(magazineSlug, pageNum) {
  const url = `https://www.discountmags.com/magazine/${magazineSlug}/back-issues${
    pageNum > 1 ? `?xPage=${pageNum}` : ""
  }`;
  let res;
  try {
    res = await fetchWithRetry(url);
  } catch (err) {
    if (err.message === "HTTP 404") return null; // past the last page
    throw err;
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const issues = [];
  $(`a[href*="/magazine/${magazineSlug.replace("-digital", "")}-"][href$="-digital"]`).each(
    (_, el) => {
      const href = $(el).attr("href");
      const $img = $(el).find("img");
      // Prefer the retina/2x source (368x484) over the base <img src> (184x242)
      // — each is its own pre-signed URL, not swappable via query params.
      const img = $img.attr("data-retina-src") || $img.attr("src");
      if (!href || !img) return;
      const issueSlug = href.split("/").filter(Boolean).pop();
      const imageUrl = new URL(img, "https://www.discountmags.com").toString();
      issues.push({ issueSlug, pageUrl: href, imageUrl });
    },
  );

  // De-dupe (the listing links the cover image twice per issue: title + image)
  const seen = new Map();
  for (const issue of issues) seen.set(issue.issueSlug, issue);
  return [...seen.values()];
}

async function main() {
  const [seriesSlug, magazineSlug] = process.argv.slice(2);
  if (!seriesSlug || !magazineSlug) {
    console.error(
      "Usage: node scripts/scrape/scrape-discountmags-covers.mjs <series-slug> <discountmags-magazine-slug>",
    );
    process.exit(1);
  }

  const outDir = path.resolve("scratch/covers", seriesSlug);
  await fs.mkdir(outDir, { recursive: true });

  let success = 0;
  let skipped = 0;

  for (let pageNum = 1; ; pageNum++) {
    console.log(`Fetching back-issues page ${pageNum}...`);
    const issues = await fetchPage(magazineSlug, pageNum);
    if (issues === null || issues.length === 0) break;

    for (const issue of issues) {
      const localPath = path.join(outDir, `${issue.issueSlug}.webp`);

      const alreadyDownloaded = await fs
        .access(localPath)
        .then(() => true)
        .catch(() => false);
      if (alreadyDownloaded) {
        console.log(`  · ${issue.issueSlug}: already downloaded, skipped`);
        success++;
        continue;
      }

      try {
        const imgRes = await fetchWithRetry(issue.imageUrl);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        await fs.writeFile(localPath, buffer);
        await appendManifestRow([
          seriesSlug,
          issue.issueSlug,
          issue.issueSlug,
          issue.pageUrl,
          localPath,
        ]);
        console.log(`  ✓ ${issue.issueSlug}`);
        success++;
      } catch (err) {
        console.log(`  ✗ ${issue.issueSlug}: ${err.message}`);
        skipped++;
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`\nDone: ${success} covers downloaded, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
