/**
 * Scrape cover images from handwovenmagazine.com's public subscriber
 * "Library" — despite living under /library/, individual issue pages and
 * their cover images are publicly reachable with no login required (only
 * the "Read Now" full-issue content is gated). Discovers every library item
 * via the site's own sitemap, keeps only Handwoven-magazine-format issues,
 * and downloads each cover.
 *
 * Usage:
 *   node scripts/scrape/scrape-handwoven-library-covers.mjs [--max-year=2014]
 *
 * --max-year limits downloads to issues whose year (parsed from the title)
 * is <= the given value — useful for scoping a first pass to a known gap
 * range instead of the full 45+ year archive in one run.
 *
 * Downloads covers to scratch/covers/handwoven-ltm-library/<slug>.jpg and
 * writes scratch/toc/handwoven-ltm-library-manifest.json (issueLabel,
 * pageUrl, coverUrl, localPath) for cross-referencing against the existing
 * missing-cover gap list.
 */

import fs from "fs/promises";
import path from "path";

const SITEMAP_URL = "https://handwovenmagazine.com/sitemap-library-items.xml";
const OUT_DIR = path.resolve("scratch/covers/handwoven-ltm-library");
const MANIFEST_PATH = path.resolve("scratch/toc/handwoven-ltm-library-manifest.json");

async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OpenLibry-guild-cataloging-bot/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function getSitemapUrls() {
  const res = await fetchWithRetry(SITEMAP_URL);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return urls;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function scrapePage(pageUrl) {
  const res = await fetchWithRetry(pageUrl);
  const html = await res.text();

  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const formatMatch = html.match(/<th scope="row">Format<\/th>\s*<td>([^<]+)<\/td>/);
  const imgMatch = html.match(
    /<img src="https:\/\/handwovenmagazine\.com\/cdn-cgi\/image\/[^"]*\/(https:\/\/www\.datocms-assets\.com\/[^"?]+)[^"]*"/,
  );

  if (!titleMatch || !formatMatch || !imgMatch) return null;

  const title = titleMatch[1].replace(/\s*\|\s*Handwoven Library\s*$/, "").trim();
  const format = formatMatch[1].trim();
  const coverUrl = `${imgMatch[1]}?w=900&fm=jpg`; // full asset, no social-share crop

  return { title, format, coverUrl, pageUrl };
}

async function main() {
  const maxYearFlag = process.argv.find((a) => a.startsWith("--max-year="));
  const maxYear = maxYearFlag ? parseInt(maxYearFlag.split("=")[1], 10) : null;
  if (maxYear) console.log(`Limiting to issues from ${maxYear} or earlier`);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const urls = await getSitemapUrls();
  console.log(`Found ${urls.length} library items in sitemap`);

  const manifest = [];
  let kept = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (i % 25 === 0) console.log(`Progress: ${i}/${urls.length}...`);

    let page;
    try {
      page = await scrapePage(url);
    } catch (err) {
      console.log(`  ✗ ${url}: ${err.message}`);
      failed++;
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    if (!page || page.format !== "Magazine" || !page.title.startsWith("Handwoven ")) {
      skipped++;
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    const yearMatch = page.title.match(/(19|20)\d{2}/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
    if (maxYear && year && year > maxYear) {
      skipped++;
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    const slug = slugify(page.title);
    const localPath = path.join(OUT_DIR, `${slug}.jpg`);

    const alreadyDownloaded = await fs
      .access(localPath)
      .then(() => true)
      .catch(() => false);
    if (!alreadyDownloaded) {
      try {
        const imgRes = await fetchWithRetry(page.coverUrl);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        await fs.writeFile(localPath, buffer);
        console.log(`  ✓ ${page.title}`);
      } catch (err) {
        console.log(`  ✗ ${page.title}: cover download failed (${err.message})`);
        failed++;
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
    } else {
      console.log(`  · ${page.title}: already downloaded, skipped`);
    }

    manifest.push({ ...page, localPath });
    kept++;

    await new Promise((r) => setTimeout(r, 300));
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log(
    `\nDone: ${kept} Handwoven magazine covers kept, ${skipped} non-matching items skipped, ${failed} failed.`,
  );
  console.log(`Wrote manifest to ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
