/**
 * Split a magazine's subject/author master index (raw PDF-extracted text,
 * as produced by fetch-index-pdf.mjs) into per-issue TOC text files.
 *
 * The index PDFs list entries under subject/author headings, each tagged
 * with an issue code + 2-digit year + page number (e.g. "MJ19, 50-52" or
 * "F24: 46-50"). This script finds every such tag, treats the text between
 * consecutive tags as that entry's title/description, and groups entries
 * by the issue they belong to.
 *
 * Usage:
 *   node scripts/scrape/split-master-index.mjs <series-slug> <raw-index-path> [--codes=early-handwoven] [--merge]
 *
 * --codes=early-handwoven selects the alternate 2-letter abbreviation scheme
 * used by Handwoven's pre-2005 index (Ja/Mr/My/Su/Se/Nv), which predates and
 * conflicts with the standard scheme's Su/Sp/F/W (true seasonal) codes — so
 * it must not be active at the same time as the default scheme.
 *
 * --merge folds results into any existing per-issue files/summary for this
 * series-slug instead of overwriting them, for running multiple source
 * files (e.g. separate pre-2005 and 2005-2025 indexes) into one combined set.
 *
 * Output: scratch/toc/<series-slug>/<year>-<issue-label-slug>.txt (one per
 * issue) and scratch/toc/<series-slug>-issue-summary.json (counts + which
 * issues were found, for spot-checking coverage).
 */

import fs from "fs/promises";
import path from "path";

const BIMONTHLY_CODES = {
  jf: "January/February",
  ma: "March/April",
  mj: "May/June",
  ja: "July/August",
  so: "September/October",
  nd: "November/December",
};
const SEASONAL_CODES = { sp: "Spring", su: "Summer", f: "Fall", w: "Winter" };
const DEFAULT_CODES = { ...BIMONTHLY_CODES, ...SEASONAL_CODES };

// Handwoven's pre-2005 index used single-letter-pair month shorthand instead
// of the JF/MA/MJ/SO/ND scheme adopted later — same six bimonthly slots,
// different abbreviations, and no seasonal (quarterly) codes at all back then.
const EARLY_HANDWOVEN_CODES = {
  ja: "January/February",
  mr: "March/April",
  my: "May/June",
  su: "July/August",
  se: "September/October",
  nv: "November/December",
};

// Handwoven's combined history mixes both schemes within the same source
// documents (not cleanly separated by era), and two codes collide in
// meaning between them: "ja" (early: Jan/Feb, default bimonthly: Jul/Aug)
// and "su" (early: Jul/Aug, default seasonal: Summer). Handwoven itself
// never published a Jul/Aug bimonthly issue (confirmed from its own index's
// abbreviation key, which lists only 5 bimonthly slots), and never went
// quarterly before 2024 (confirmed from cover scrape data) — so both can be
// resolved deterministically: "ja" always means Jan/Feb for this series,
// and "su" means Jul/Aug pre-2024, Summer from 2024 on.
const HANDWOVEN_COMBINED_CODES = {
  ...EARLY_HANDWOVEN_CODES,
  jf: "January/February",
  ma: "March/April",
  mj: "May/June",
  so: "September/October",
  nd: "November/December",
  sp: "Spring",
  f: "Fall",
  w: "Winter",
  // "ja" and "su" are resolved dynamically in parseEntries(), not via this
  // static table — see HANDWOVEN_DYNAMIC_CODES below.
};
const HANDWOVEN_DYNAMIC_CODES = new Set(["ja", "su"]);
function resolveHandwovenDynamicCode(codeKey, year) {
  if (codeKey === "ja") return "January/February";
  if (codeKey === "su") return year >= 2024 ? "Summer" : "July/August";
  return null;
}

function buildTagRegex(codes) {
  // Longest codes first so multi-letter codes match before any single-letter
  // code could, and pages may optionally be preceded by "pp." / "p.".
  const alternation = Object.keys(codes)
    .sort((a, b) => b.length - a.length)
    .join("|");
  return new RegExp(
    `\\b(${alternation})(\\d{2})[,:]\\s*(?:pp?\\.\\s*)?((?:cover,?\\s*)?[0-9][0-9,\\-\\u2013\\s]*)`,
    "gi",
  );
}

// The index PDFs' own instructions ("...is abbreviated as JF15, 10-12, which
// indicates the article was published...") contain a literal worked example
// that matches TAG_RE — a false positive that, if it's the first real match
// in the file, drags the entire preamble in as its "title". Filter those out.
const PREAMBLE_MARKERS = [
  "indicates the article was published",
  "abbreviations are used to identify",
  "abbreviation are used to identify",
  "is abbreviated as",
  "continuous page range",
];
function looksLikePreambleNoise(title) {
  if (title.length > 400) return true;
  const lower = title.toLowerCase();
  return PREAMBLE_MARKERS.some((marker) => lower.includes(marker));
}

function normalizeYear(twoDigit) {
  const n = parseInt(twoDigit, 10);
  // These magazines all launched in the 1970s-80s; nothing scraped predates 1970.
  return n >= 70 ? 1900 + n : 2000 + n;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function stripLabelPrefixes(text) {
  // Drop redundant "PieceWork:" / "Handwoven:" / "Spin Off:" magazine-name
  // labels that precede the issue tag in some sections.
  return text.replace(/\b(PieceWork|Handwoven|Spin\s*Off)\s*:?\s*$/i, "").trim();
}

function parseEntries(rawText, codes, tagRe, dynamicResolver) {
  // Collapse to a single line so tags that got PDF-wrapped across two lines
  // (e.g. "...mill. Handwoven: JF23,\n14-17") still match as one tag.
  const flat = rawText.replace(/\s+/g, " ");

  const entries = [];
  let lastIndex = 0;
  let match;
  tagRe.lastIndex = 0;
  while ((match = tagRe.exec(flat)) !== null) {
    const [full, code, yy, pages] = match;
    const titleRaw = flat.slice(lastIndex, match.index);
    const title = stripLabelPrefixes(titleRaw).trim();
    lastIndex = match.index + full.length;

    const codeKey = code.toLowerCase();
    const year = normalizeYear(yy);
    const label = dynamicResolver?.(codeKey, year) ?? codes[codeKey];
    if (!label) continue; // shouldn't happen given the alternation, but be safe
    if (looksLikePreambleNoise(title)) continue;

    entries.push({
      issueKey: `${year}-${slugify(label)}`,
      year,
      issueLabel: `${label} ${year}`,
      title: title || "(untitled entry, continued from previous line)",
      pages: pages.trim(),
    });
  }
  return entries;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const [seriesSlug, ...rawIndexPaths] = args;
  const merge = flags.includes("--merge");
  const codesFlag = flags.find((f) => f.startsWith("--codes="))?.split("=")[1];
  const codes =
    codesFlag === "early-handwoven"
      ? EARLY_HANDWOVEN_CODES
      : codesFlag === "handwoven-combined"
        ? HANDWOVEN_COMBINED_CODES
        : DEFAULT_CODES;
  const dynamicResolver = codesFlag === "handwoven-combined" ? resolveHandwovenDynamicCode : null;
  const tagRe = buildTagRegex(codes);

  if (!seriesSlug || rawIndexPaths.length === 0) {
    console.error(
      "Usage: node scripts/scrape/split-master-index.mjs <series-slug> <raw-index-path> [<raw-index-path> ...] [--codes=early-handwoven|handwoven-combined] [--merge]",
    );
    process.exit(1);
  }

  const rawText = (
    await Promise.all(rawIndexPaths.map((p) => fs.readFile(p, "utf8")))
  ).join("\n\n");
  const entries = parseEntries(rawText, codes, tagRe, dynamicResolver);
  console.log(`Parsed ${entries.length} tagged entries from ${rawIndexPaths.join(", ")}`);

  const outDir = path.resolve("scratch/toc", seriesSlug);
  await fs.mkdir(outDir, { recursive: true });
  const summaryPath = path.resolve("scratch/toc", `${seriesSlug}-issue-summary.json`);

  const byIssue = new Map();
  for (const e of entries) {
    if (!byIssue.has(e.issueKey)) {
      byIssue.set(e.issueKey, { issueLabel: e.issueLabel, year: e.year, lines: new Set() });
    }
    byIssue.get(e.issueKey).lines.add(`${e.title} (p. ${e.pages})`);
  }

  // In merge mode, fold in whatever's already on disk for each issue rather
  // than clobbering it — lets separate source files (e.g. a pre-2005 index
  // and a 2005-2025 index) build up one combined per-issue set.
  if (merge) {
    for (const [issueKey, data] of byIssue) {
      const outPath = path.join(outDir, `${issueKey}.txt`);
      try {
        const existing = await fs.readFile(outPath, "utf8");
        const existingLines = existing.split("\n").slice(2); // drop header + blank line
        for (const line of existingLines) if (line.trim()) data.lines.add(line);
      } catch {
        // no existing file for this issue yet — nothing to merge
      }
    }
  }

  const newSummary = [];
  for (const [issueKey, data] of [...byIssue.entries()].sort()) {
    const outPath = path.join(outDir, `${issueKey}.txt`);
    const header = `${seriesSlug} — ${data.issueLabel}\n\n`;
    const body = [...data.lines].join("\n");
    await fs.writeFile(outPath, header + body, "utf8");
    newSummary.push({ issueKey, issueLabel: data.issueLabel, entryCount: data.lines.size, path: outPath });
  }

  let finalSummary = newSummary;
  if (merge) {
    let existingSummary = [];
    try {
      existingSummary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
    } catch {
      // no existing summary yet
    }
    const byKey = new Map(existingSummary.map((s) => [s.issueKey, s]));
    for (const s of newSummary) byKey.set(s.issueKey, s); // new entries win (already merged above)
    finalSummary = [...byKey.values()].sort((a, b) => (a.issueKey < b.issueKey ? -1 : 1));
  }

  await fs.writeFile(summaryPath, JSON.stringify(finalSummary, null, 2), "utf8");

  console.log(`Wrote ${newSummary.length} per-issue TOC files to ${outDir} (${finalSummary.length} total for series)`);
  console.log(`Wrote summary to ${summaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
