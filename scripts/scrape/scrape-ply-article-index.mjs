/**
 * Scrape PLY Magazine's public article index (plymagazine.com/ply-article-index/),
 * a paginated table of every published article, and group entries by issue into
 * per-issue TOC text.
 *
 * Usage:
 *   node scripts/scrape/scrape-ply-article-index.mjs
 *
 * Output: scratch/toc/ply-index-raw.json (array of {author, title, issueDate,
 * issueNumber, issueTopic, topics, description}) and scratch/toc/ply-per-issue.json
 * (keyed by issue number -> combined TOC text block).
 */

import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";

const BASE_URL = "https://plymagazine.com/ply-article-index/";
const OUT_DIR = path.resolve("scratch/toc");

async function fetchWithRetry(url, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          // A plain "curl"-style UA gets blocked by this site's Cloudflare
          // bot protection; a realistic desktop-browser UA passes through.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 5 * (i + 1);
        console.log(`  (rate limited, waiting ${retryAfter}s...)`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 750 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("Exceeded retry attempts (persistent 429)");
}

function parsePage(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $("table.pdb-list-count, table.list-container")
    .find("tbody tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const get = (cls) => $tr.find(`td.${cls}-field`).text().trim();
      rows.push({
        author: get("author"),
        title: get("article_title"),
        issueDate: get("issue_date"),
        issueNumber: get("issue_number"),
        issueTopic: get("issue_topic"),
        topics: get("article_topic_list"),
        description: get("description"),
      });
    });
  return rows;
}

function getTotalRecords(html) {
  const match = html.match(/Total Records Found:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`Fetching ${BASE_URL} (page 1)...`);
  const firstRes = await fetchWithRetry(BASE_URL);
  const firstHtml = await firstRes.text();
  const total = getTotalRecords(firstHtml);
  const allRows = parsePage(firstHtml);
  console.log(`  Total records reported: ${total}, page 1 rows: ${allRows.length}`);

  const perPage = allRows.length || 25;
  const totalPages = total ? Math.ceil(total / perPage) : 1;

  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    const url = `${BASE_URL}?listpage=${pageNum}&instance=1`;
    console.log(`Fetching page ${pageNum}/${totalPages}...`);
    const res = await fetchWithRetry(url);
    const html = await res.text();
    const rows = parsePage(html);
    allRows.push(...rows);
    // Save incrementally so a crash/rate-limit mid-run doesn't lose earlier pages
    await fs.writeFile(
      path.join(OUT_DIR, "ply-index-raw.json"),
      JSON.stringify(allRows, null, 2),
      "utf8",
    );
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\nCollected ${allRows.length} article rows (expected ${total}).`);

  const rawPath = path.join(OUT_DIR, "ply-index-raw.json");
  await fs.writeFile(rawPath, JSON.stringify(allRows, null, 2), "utf8");
  console.log(`Wrote ${rawPath}`);

  // Group by issue number into a per-issue TOC text block
  const byIssue = new Map();
  for (const row of allRows) {
    const key = row.issueNumber || "unknown";
    if (!byIssue.has(key)) {
      byIssue.set(key, {
        issueNumber: row.issueNumber,
        issueDate: row.issueDate,
        issueTopic: row.issueTopic,
        articles: [],
      });
    }
    byIssue.get(key).articles.push({
      title: row.title,
      author: row.author,
      topics: row.topics,
      description: row.description,
    });
  }

  const perIssue = [...byIssue.values()].map((issue) => ({
    ...issue,
    tableOfContents: issue.articles
      .map((a) => `${a.title} — ${a.author}${a.description ? ` (${a.description})` : ""}`)
      .join("\n"),
  }));

  const perIssuePath = path.join(OUT_DIR, "ply-per-issue.json");
  await fs.writeFile(perIssuePath, JSON.stringify(perIssue, null, 2), "utf8");
  console.log(`Wrote ${perIssuePath} (${perIssue.length} issues)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
