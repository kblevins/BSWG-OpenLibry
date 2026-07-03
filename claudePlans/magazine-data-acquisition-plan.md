# Magazine Data Acquisition — Execution Plan

Two-phase plan to populate cover images and table-of-contents (TOC) text for
the magazine collection, minimizing human effort at every step. Builds on
[magazine-support.md](magazine-support.md) (schema/import mechanics) and
[magazine-source-research.md](magazine-source-research.md) (per-title
source research).

- **Phase 1 — Scrape everything that's freely available online.** Zero
  physical handling. Do this first and entirely — it shrinks Phase 2's
  scope before any photography happens.
- **Phase 2 — Photograph and OCR whatever Phase 1 couldn't get.** Designed
  around a single principle: *pre-build the manifest, then never type
  metadata by hand again* — sequence, not data entry, does the matching.

Run Phase 1's scraping and Phase 1's permission requests (Step 1.4)
concurrently — a granted bulk export can eliminate photography work for an
entire title before Phase 2 ever starts.

---

## Phase 1 — Scrape available sources

### Step 1.1 — Build the scraper harness

One reusable script pattern (Node, matching `scripts/import-books.mjs`
conventions), parameterized per source:

- [ ] `scripts/scrape/fetch-index-pdf.mjs` — download a PDF, extract text
      (use `pdf-parse` or similar), write raw text to
      `scratch/toc/<series>-index-raw.txt`. Used for the free master-index
      PDFs (PieceWork, Spin-Off, Handwoven).
- [ ] `scripts/scrape/scrape-shop-covers.mjs` — given a collection/listing
      URL and a CSS selector for product links, walk paginated listing
      pages, follow each product page, download the cover image, and
      append a row to `scratch/manifest.csv` (`series, volume, issue,
      sourceUrl, localImagePath`). Used for Ply, PieceWork, Ornament, and
      the Spin-Off/Handwoven recent-issue shop pages.
- [ ] `scripts/scrape/scrape-article-index.mjs` — paginated HTML table
      scraper for Ply's article index (59 pages) → structured
      `{issue, title, author, topic}` rows, grouped by issue into TOC text.
- Rate-limit every scraper (e.g. 1 request/second, matching the courtesy
  delay already used in `import-books.mjs`) and log failures to a
  `failed.txt` per source rather than halting the run.

### Step 1.2 — Run the Tier 1 sources (easy, no OCR, do first)

| Series | Script | Output |
|---|---|---|
| Ply | `scrape-shop-covers.mjs` + `scrape-article-index.mjs` | Covers (53 issues) + full TOC (1,457 articles) |
| PieceWork | `scrape-shop-covers.mjs` (DiscountMags) + `fetch-index-pdf.mjs` | Cover thumbnails + subject/author index text (1993–2025) |
| Spin-Off | `fetch-index-pdf.mjs` | Master index text (1977–2025) — TOC only, covers are Tier 2 |
| Handwoven | `fetch-index-pdf.mjs` | Master index text (1979–2025) — TOC only, covers are Tier 2 |

- [ ] Run each script, spot-check ~5 rows per source for correctness
      (image not broken, text not garbled) before moving on.
- [ ] These PDF indexes are organized by author/subject, not per-issue —
      write one small transform script
      (`scripts/scrape/index-to-per-issue.mjs`) that groups entries by the
      issue reference embedded in each index line and produces one TOC blob
      per issue. This is the only "logic" step in Phase 1; everything else
      is fetch-and-store.

### Step 1.3 — Run the Tier 2 sources (moderate effort, partial coverage)

| Series | What's gettable | Gap that falls to Phase 2 |
|---|---|---|
| Spin-Off | Covers for ~2023–2026 via shop pages | Older decades (sold as bundled "Collection" downloads — buy once per decade if budget allows, still zero photography) |
| Handwoven | No free cover source | All covers — Phase 2, unless a Zinio/Collection purchase is made |
| Ornament | Current shop-listed issues: cover images + real TOC text on product pages | Older/out-of-print issues not listed in the shop |
| Surface Design Journal | Issuu preview covers (~2013+) | Pre-2013 covers; all TOC (see Step 1.4) |

- [ ] Extend `scrape-shop-covers.mjs` with an optional TOC-text selector for
      sites where the product page itself lists a real TOC (Ornament) —
      capture both in one pass.
- [ ] For Spin-Off/Handwoven "Collection" bundles: this is a purchase
      decision, not an engineering one — flag to the user/guild treasurer
      rather than deciding unilaterally.

### Step 1.4 — Send bulk-export/permission requests now (parallel to 1.2–1.3)

Do this in week 1, not after scraping wraps — a "yes" here removes an
entire title from Phase 2 photography before it starts.

- [ ] **HGA** (Shuttle, Spindle & Dyepot) — request a bulk export or
      temporary elevated access to the Watkins Printing digital archive for
      cataloging purposes, citing the guild's HGA membership if applicable.
- [ ] **Surface Design Association** — request the "Master Table of
      Contents" files directly and ask about a cover-image bulk export.
- [ ] **American Craft Council archives** — ask specifically about the
      2012–2017 gap (not covered by their existing digitization), and
      whether digital.craftcouncil.org access can be granted for
      programmatic/bulk retrieval for a nonprofit guild library.
- [ ] **Long Thread Media** (PieceWork/Spin-Off/Handwoven publisher) —
      optional: ask if they'll grant a one-time archival export instead of
      per-issue scraping/purchase for the cover-image gaps. Low cost to ask,
      could shrink Step 1.3's Phase-2 fallout.
- [ ] Track responses in a simple table at the bottom of this doc so Phase
      2 scoping (Step 2.1) reflects whatever comes back.

### Step 1.5 — Load scraped data into the database

- [ ] Covers: reuse the Step 4 script design from `magazine-support.md`
      (`scripts/import-magazine-covers.mjs`) — feed it `scratch/manifest.csv`
      instead of a hand-built mapping.
- [ ] TOC text: extend the Excel import path (`magazine-support.md` Step 3)
      or, simpler for a one-time bulk load, write directly via
      `prisma.book.update` keyed by the same manifest — skip the Excel
      round-trip since this is scripted data, not a spreadsheet a human is
      curating.
- [ ] After load, run a quick completeness report (per series: issues
      expected vs. issues with a cover / issues with TOC text) — this
      becomes the exact shortfall list Phase 2 works from.

**Effort estimate:** almost entirely unattended script runtime; the human
time is writing ~3 scraper scripts once (reusable across sources) plus a
few minutes of spot-checking output and sending 3–4 emails.

---

## Phase 2 — Photograph & OCR the remainder

Applies to: Fiber Arts (all issues), Shuttle Spindle & Dyepot (all issues,
unless Step 1.4 changes this), American Craft 2012–2017, "Interweave" and
"Weft" (pending title disambiguation), and whatever completeness report
from Step 1.5 shows as missing for the other titles.

The core idea for minimizing human effort: **do the data-entry once, before
touching a single magazine — as physical ordering, not typing.** Every
photo's identity comes from its position in a pre-sorted stack matched to a
pre-built manifest, not from anyone reading a magazine and typing its
title/date into a form.

### Step 2.1 — Build the shortfall manifest

- [ ] From Step 1.5's completeness report, produce
      `scratch/phase2-manifest.csv`: one row per issue still needed, with
      columns `bookId, series, volume, issue, expectedCoverPath,
      expectedTocPath` (the last two blank, to be filled by capture).
- [ ] Sort this manifest to match your physical shelf order (by series,
      then chronologically) — this sort order becomes the capture order.
      **Physically arrange the magazines in this exact order before
      starting.** This single step is what eliminates all per-issue data
      entry later.

### Step 2.2 — Capture setup (minimize touches per issue)

- [ ] Use a phone/tablet in a fixed overhead copy-stand (or any stable
      mount — a tripod with a phone clamp works) with consistent, even
      lighting (a window with indirect light or two desk lamps at 45°
      angles is enough — avoid glare on glossy covers).
- [ ] Use a batch-capable scanning app (Adobe Scan, Google Drive's
      "Scan," Microsoft Lens, or similar) in **multi-page batch mode**,
      which auto-detects edges/crops and exports a numbered sequence
      (`Doc_001.jpg`, `Doc_002.jpg`, …) without per-shot naming.
- [ ] Fixed shot pattern per issue, **in manifest order, no gaps, no
      skipping**: shot 1 = cover, shot 2 = table-of-contents page (or, for
      older issues with no dedicated TOC page, the masthead/first editorial
      page — whatever lists article titles). Exactly 2 photos per issue,
      always in that order — this fixed cadence is what lets a script
      re-associate photos with manifest rows purely by position.
- [ ] Do NOT stop to rename, tag, or review during capture — batch first,
      process after. Reviewing mid-batch is the single biggest source of
      wasted time in a task like this.

### Step 2.3 — Split & match script

- [ ] `scripts/photos/split-and-match.mjs`: reads the exported image
      sequence + `phase2-manifest.csv`, pairs images 2-at-a-time
      (cover/TOC), and assigns each pair to the next manifest row in order.
      Writes `<bookId>-cover.jpg` and `<bookId>-toc.jpg` into
      `scratch/phase2-processed/`.
- [ ] Sanity check built into the script: if the image count isn't exactly
      `2 × manifest rows`, fail loudly with the mismatch count rather than
      silently misaligning everything downstream (a single skipped/duplicate
      photo would otherwise shift every subsequent issue's data onto the
      wrong book record).
- [ ] Run in small batches (e.g. 25–50 issues at a time) rather than one
      giant session — makes a miscount easy to isolate and re-shoot.

### Step 2.4 — OCR the TOC images

- [ ] Use **Tesseract** (via `tesseract.js` or a local Tesseract CLI call)
      as the default — free, runs locally, no data leaves the guild's
      machine, and printed magazine text (not handwriting) is exactly what
      it's good at.
- [ ] `scripts/photos/ocr-toc.mjs`: runs Tesseract over every
      `<bookId>-toc.jpg`, writes raw text to
      `scratch/phase2-processed/<bookId>-toc.txt`, and captures Tesseract's
      per-word confidence score, writing an average confidence per image to
      the manifest.
- [ ] Optional escalation, only if Tesseract's confidence is poor on a
      meaningful chunk of images (e.g. small/stylized fonts in older
      issues): re-run just the low-confidence subset through Google Cloud
      Vision OCR (~$1.50/1,000 images) instead of switching everything —
      keeps cost near zero while fixing the worst cases.
- [ ] Light cleanup pass (regex, not manual): strip running headers/footers
      and page numbers that OCR picks up as noise, matching whatever
      boilerplate pattern is common to that series' TOC page layout.

### Step 2.5 — Targeted human review (not full review)

- [ ] Auto-flag any image below an OCR confidence threshold (e.g. 70%) into
      a `needs-review.csv` — this is the only text a human reads, not every
      TOC.
- [ ] Spot-check a fixed small sample (e.g. 10 issues per series, not 10%
      of everything if a series has hundreds) for cover-image
      crop/orientation correctness, independent of OCR confidence.
- [ ] For flagged low-confidence TOC images: hand-correct just those, or
      accept imperfect OCR text as "good enough for search" (a few garbled
      words in a TOC-search index rarely matter — err toward accepting
      unless the text is unusable) rather than manually retyping.

### Step 2.6 — Ingest into the database

- [ ] `scripts/photos/import-phase2-batch.mjs`: single script that, per
      manifest row, copies `<bookId>-cover.jpg` to
      `COVERIMAGE_FILESTORAGE_PATH/<bookId>.jpg` (matching the existing
      convention from `pages/api/book/cover/[id].ts`) and writes the OCR'd
      (and cleaned) text to `Book.tableOfContents` via
      `prisma.book.update`.
- [ ] Run per batch (matching Step 2.3's batch size) immediately after each
      shoot/OCR cycle rather than waiting for the entire collection —
      surfaces mismatches early while the physical stack order is still
      fresh/re-checkable.

### Step 2.7 — Disambiguate "Interweave" and "Weft" before shooting either

- [ ] Pull the physical issues cataloged as each and check the masthead/
      cover date against the candidates identified in
      `magazine-source-research.md` (original 1970s "Interweave" vs.
      Interweave Knits; *The Weaver's Journal* vs. modern *WEFT Magazine*).
- [ ] Once confirmed, route each to Phase 1 (if it turns out to be the
      actively-scrapable modern title) or Phase 2 (if it's the
      out-of-print/no-digital-source title) accordingly — this check costs
      minutes and could remove one or both titles from the photography
      workload entirely.

---

## Effort summary

| Phase | Human effort | What does the work |
|---|---|---|
| 1.1–1.3 (scrape) | Write ~3 reusable scripts once; a few minutes spot-checking | Scripts (unattended runtime) |
| 1.4 (permission requests) | ~30 min writing 3–4 emails | Guild/publisher staff, whenever they respond |
| 1.5 (load) | A few minutes reviewing the completeness report | Scripts |
| 2.1 (manifest + physical sort) | One-time sort of the physical stack into shelf order | You, once, upfront — this is the step that pays for everything downstream |
| 2.2 (capture) | 2 photos/issue, no per-item typing | You (or any volunteer — no cataloging knowledge needed, just "next in the stack") |
| 2.3–2.4 (split/OCR) | None — fully scripted | Scripts |
| 2.5 (review) | Only flagged low-confidence items + small spot-check sample | You |
| 2.6 (ingest) | None — fully scripted | Scripts |
| 2.7 (disambiguation) | ~10 minutes checking two titles' physical mastheads | You |

---

## Permission-request tracker

| Contact | Requested | Response | Effect on Phase 2 scope |
|---|---|---|---|
| HGA (Shuttle Spindle & Dyepot) | — | — | If granted: removes ~all SS&D issues from photography |
| Surface Design Association | — | — | If granted: removes/reduces SDJ TOC + cover photography |
| American Craft Council archives | — | — | If granted: removes 2012–2017 American Craft from photography |
| Long Thread Media | — | — | If granted: reduces Spin-Off/Handwoven cover photography |

*(Fill in as responses arrive — this table drives what actually needs to
be shot in Step 2.1.)*
