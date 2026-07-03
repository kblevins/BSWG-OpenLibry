/**
 * Scrape cover images for a magazine's back-issue collection on a Shopify store,
 * using the store's public products.json endpoint (no HTML scraping needed).
 *
 * Usage:
 *   node scripts/scrape/scrape-shopify-covers.mjs <series-slug> <collection-url>
 *
 * Example:
 *   node scripts/scrape/scrape-shopify-covers.mjs ply \
 *     https://plytogether.com/collections/ply-magazine-back-issues
 *
 * Downloads each product's first image to scratch/covers/<series-slug>/<handle>.jpg
 * and appends a row to scratch/manifest.csv (series, handle, title, sourceUrl, localImagePath).
 */

import fs from "fs/promises";
import path from "path";

const MANIFEST_PATH = path.resolve("scratch/manifest.csv");

function collectionToProductsJsonUrl(collectionUrl, pageNum) {
  const url = new URL(collectionUrl);
  url.pathname = url.pathname.replace(/\/?$/, "/products.json");
  url.searchParams.set("limit", "250");
  url.searchParams.set("page", String(pageNum));
  return url.toString();
}

async function fetchAllProducts(collectionUrl) {
  const all = [];
  for (let pageNum = 1; ; pageNum++) {
    const url = collectionToProductsJsonUrl(collectionUrl, pageNum);
    console.log(`Fetching ${url}...`);
    const res = await fetchWithRetry(url);
    const { products } = await res.json();
    if (products.length === 0) break;
    all.push(...products);
    if (products.length < 250) break;
  }
  return all;
}

async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "OpenLibry-guild-cataloging-bot/1.0" },
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

async function main() {
  const [seriesSlug, collectionUrl] = process.argv.slice(2);
  if (!seriesSlug || !collectionUrl) {
    console.error(
      "Usage: node scripts/scrape/scrape-shopify-covers.mjs <series-slug> <collection-url>",
    );
    process.exit(1);
  }

  const products = await fetchAllProducts(collectionUrl);
  console.log(`Found ${products.length} products`);

  const outDir = path.resolve("scratch/covers", seriesSlug);
  await fs.mkdir(outDir, { recursive: true });

  let success = 0;
  let skipped = 0;

  for (const product of products) {
    const image = product.images?.[0];
    if (!image) {
      console.log(`  – ${product.handle}: no image, skipped`);
      skipped++;
      continue;
    }

    const ext = path.extname(new URL(image.src).pathname) || ".jpg";
    const localPath = path.join(outDir, `${product.handle}${ext}`);

    // Resume support: skip work already done by a prior (possibly crashed) run
    const alreadyDownloaded = await fs
      .access(localPath)
      .then(() => true)
      .catch(() => false);
    if (alreadyDownloaded) {
      console.log(`  · ${product.title}: already downloaded, skipped`);
      success++;
      continue;
    }

    try {
      const imgRes = await fetchWithRetry(image.src);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      await fs.writeFile(localPath, buffer);

      await appendManifestRow([
        seriesSlug,
        product.handle,
        product.title,
        `${collectionUrl.replace(/\/$/, "")}/products/${product.handle}`,
        localPath,
      ]);

      console.log(`  ✓ ${product.title}`);
      success++;
    } catch (err) {
      console.log(`  ✗ ${product.handle}: ${err.message}`);
      skipped++;
    }

    // Be polite to the CDN
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone: ${success} covers downloaded, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
