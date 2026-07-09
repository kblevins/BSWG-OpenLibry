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

## Current status (as of 2026-07-08)

**Complete — covers + TOC/full-text acquired, verified, and in
`scratch/magazine-scrape-inventory.csv`:**
- PieceWork (191 rows), Ply (53 issues), Spin-Off (226 rows, TOC-complete;
  see Tier 2 note on older cover decades), Handwoven (258 rows) — done in
  an earlier session
- WEFT Magazine (6/6 issues, covers + 124-article TOC index)
- The Weaver's Journal (15/15 issues the Univ. of Arizona archive holds,
  #32–46, Spring 1984–Fall 1987 — **not** the full 1976–1986 run originally
  assumed; covers + tesseract-OCR'd TOC)
- Threads Magazine (168/169 issues, #1–169, Oct/Nov 1985–Nov 2013 — issue
  #161 is genuinely absent from the source archive; covers + full OCR text
  already computed by Internet Archive, far more coverage than the
  original research estimated). **Also**: full-issue OCR text wasn't a
  reliable stand-in for a real table of contents on some issues, so pages
  1–6 of every issue (1008 images) are separately saved as
  `scratch/toc-images/threads/<handle>-p<1-6>.png` for visual TOC lookup —
  see the note under Step 1.2 for why (an automatic single-page-detection
  approach was tried and abandoned as unreliable).
- Ornament (128/128 shop-listed single issues, Vol. 13.4–46.4, plus 3
  bundle products kept separately; covers + real per-issue TOC text, both
  pulled from one Squarespace JSON API call — no HTML scraping needed).
  **Note:** an initial bug silently substituted a generic placeholder
  image for 87/131 covers (Squarespace's own fallback for products with
  no "main" image set) — found and fixed same day, all 131 covers are now
  verified real images.

**Tooling installed this session:** Homebrew was already present on this
machine, just not on the shell's PATH (`/opt/homebrew/bin/brew`) —
installed `tesseract` and `poppler` through it, so OCR/PDF tooling is now
available for any future step in this plan. Also installed `pymupdf` via
pip for PDF page rasterization (used for Weaver's Journal and Threads
cover extraction — pure wheel, no system deps needed).

**Deferred, not abandoned:**
- **Shuttle, Spindle & Dyepot** — the guild is pursuing a direct HGA
  contact for a bulk export instead of scraping; skip Phase 1/2 work here
  until that resolves.

**Open disambiguation, pending physical masthead checks by the guild:**
- **"Interweave"** — original 1970s title vs. Interweave Knits, unresolved.
- **"Weaver's Journal" (1982–1995 holdings)** — likely two separate titles
  mixed under one shelf label: *The Weaver's Journal* (Colorado Fiber
  Center, ends Fall 1987, already fully sourced above) and a second,
  distinct magazine, *Weaver's* (XRX Inc., ed. Madelyn van der Hoogt,
  1986–1999) that has **not** been sourced at all yet. See Step 2.7 and
  the "Weaver's (XRX Inc.)" entry in `magazine-source-research.md`. Do not
  start sourcing work for the 1988–1995 portion until this is confirmed.

**Not yet started:**
- **Women in the Arts** (likely NMWA's magazine) — thin online (only
  ~5 years of cover thumbnails, no TOC found anywhere); mostly a
  guild/NMWA-outreach task, not a scraping one.
- **Threads 2013–present** — behind Taunton's paywalled "Threads Insider"
  archive; needs either a paid subscription + scripted retrieval, or
  outreach to Taunton.
- **Ornament pre-Vol.13** (roughly pre-1989) — not listed in the shop at
  all, no known digital source; would need the guild's own physical scans.
- **Surface Design Journal** — not attempted yet; per the research it's
  Issuu-preview covers + a membership-gated "Master Table of Contents,"
  likely needs direct SDA outreach rather than scraping.
- Permission requests to SDA, ACC, Long Thread Media, Taunton, NMWA (see
  Step 1.4 and the tracker at the bottom of this doc) — none sent yet
  except the HGA one, which the guild is handling directly.

See [magazine-source-research.md](magazine-source-research.md) for full
per-title research backing all of the above.

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

| Series | Script | Output | Status |
|---|---|---|---|
| Ply | `scrape-shop-covers.mjs` + `scrape-article-index.mjs` | Covers (53 issues) + full TOC (1,457 articles) | ✅ Done |
| PieceWork | `scrape-shop-covers.mjs` (DiscountMags) + `fetch-index-pdf.mjs` | Cover thumbnails + subject/author index text (1993–2025) | ✅ Done |
| Spin-Off | `fetch-index-pdf.mjs` | Master index text (1977–2025) — TOC only, covers are Tier 2 | ✅ Done |
| Handwoven | `fetch-index-pdf.mjs` | Master index text (1979–2025) — TOC only, covers are Tier 2 | ✅ Done |
| WEFT Magazine | `scrape-shopify-covers.mjs` (Shopify, `plytogether.com/collections/weft-magazine-back-issues`) + `scrape-ply-article-index.mjs` (generalized, against `www.weftmagazine.com/index/`) | Covers (6 issues) + full TOC (124 articles, 6 issues) | ✅ Done |
| Threads (#1–169, 1985–2013) | `scripts/scrape/fetch-threads-archive-org.py` (Python/PyMuPDF) — pull `archive.org/details/threads_magazine`'s per-issue PDFs + pre-computed OCR text (no OCR needed, IA already ran it) | Covers (168/169 issues, #161 absent from source) + full OCR text | ✅ Done |

- [ ] Run each script, spot-check ~5 rows per source for correctness
      (image not broken, text not garbled) before moving on.
- [x] WEFT: **done 2026-07-08.** `scrape-shopify-covers.mjs` ran unmodified
      against the PLYtogether collection (6/6 covers). Generalized
      `scrape-ply-article-index.mjs` to take a series-slug + URL argument
      (was hardcoded to Ply) and ran it against `www.weftmagazine.com/index/`
      (note the `www` — the bare domain 301-redirects) — 124/124 articles,
      grouped into 6 per-issue TOC files. Both paths appended to
      `scratch/magazine-scrape-inventory.csv`. Title complete.
- [x] Threads: **done 2026-07-08.** Skipped the "diff against holdings first" step — the local dev database is empty (real holdings data lives on Railway, not accessible from this machine), so instead pulled everything IA has, same approach as the other completed titles; matching to actual holdings happens at DB-import time. Wrote `scripts/scrape/fetch-threads-archive-org.py` (Python/PyMuPDF, not Node, for the same PDF-rasterization reason as the Weaver's Journal script). Discovered via the item's `/metadata` endpoint that IA's `threads_magazine` item covers **169 issues (#1–169, Oct/Nov 1985–Nov 2013)** — far more than the original research estimated ("early issues only"). Pulled the pre-computed OCR full text (`_djvu.txt`, ~51MB total, cheap) for all issues, and for covers downloaded each scanned PDF transiently (~3GB combined, not retained), extracted page 1 via PyMuPDF, then deleted the PDF. 168/168 succeeded (issue #161 is genuinely absent from the archive, not a failure). Ran as a backgrounded ~20+ minute job. Both paths appended to `scratch/magazine-scrape-inventory.csv`.
- [x] Threads TOC page images: **done 2026-07-08 (user request, follow-up).** The full-issue OCR text above wasn't a good enough substitute for an actual table of contents on some issues. Tried automatic single-page TOC detection (score OCR lines matching a "44 Industry Tips" page-number pattern) through **three rounds of fixes** — bounding matched numbers by the issue's real page count to reject ad/price false positives, then tie-breaking toward the earliest page — but a 6-issue random spot-check still showed **50% of picks were wrong** (ad pages and department articles produce similar number-density patterns often enough to fool a best-guess algorithm). **Abandoned single-page auto-detection.** Final approach, `scripts/scrape/save-threads-toc-page-range.py`: save pages 1–6 of every issue as separate images instead of guessing one — confirmed the real TOC always falls in that range — so a human picks the right one visually. 1008 images (168 × 6) saved to `scratch/toc-images/threads/`. This required a 4th full ~3GB PDF re-download pass; each of the prior 3 was spent chasing the single-page heuristic before it was abandoned as unreliable.
- [x] **Inventory CSV recovery note:** while adding Threads' rows, a duplicate-row cleanup pass on `magazine-scrape-inventory.csv` used the wrong dedup key and briefly collapsed Handwoven/PieceWork/Ply/Spin-Off down to 1 row each (those series share one generic literal `title` per series, unlike Threads/WEFT/Weaver's Journal). No source files were lost — covers and TOC text were untouched on disk — and the CSV was rebuilt via a new one-off script, `scripts/scrape/rebuild-inventory-csv.py`, using the per-issue JSON summaries a prior session had generated. Verified via spot-checks (random sample of reconstructed rows all resolve to real, correctly-sized files) and by confirming the "no confident match" gaps line up with the pre-existing `*-missing-*.txt` files. Final counts: Handwoven 258, PieceWork 191, Ply 53, Spin-Off 226 rows.
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
| Ornament | ✅ Done — all 128 shop-listed single issues (Vol. 13.4–46.4) | Issues before Vol. 13 not listed in the shop, no known digital source |
| Surface Design Journal | Issuu preview covers (~2013+) | Pre-2013 covers; all TOC (see Step 1.4) |
| The Weaver's Journal | Covers — extract page 1 from each of the ~46 Univ. of Arizona scanned PDFs (`www2.cs.arizona.edu/patterns/weaving/periodicals/wj_<n>.pdf`), no purchase or photography needed | TOC text — PDFs have no text layer; either OCR the scans directly (lower confidence) or purchase + OCR the 24-page Camilla Valley Farm "Ten Year Cumulative Index" (small one-time cost, not yet digitized anywhere) |
| Threads (2013–present, i.e. after IA's #1–169 coverage) | Taunton back-issue/shop pages for covers | Full text behind paywalled "Threads Insider" archive (blocks automated fetch) — ask Taunton about a bulk export before deciding to pay+scrape |
| Women in the Arts | nmwa.org cover thumbnails, Winter 2021–present only | Everything else — no TOC found for any era; older covers not digitized anywhere found |

- [x] Ornament: **done 2026-07-08.** Turned out not to need the planned
      `scrape-shop-covers.mjs` extension at all — the shop is Squarespace
      commerce, not Shopify, and Squarespace's `?format=json` endpoint on
      the listing page returns full structured data (cover URL + real
      HTML TOC) per item in one call, no per-product-page fetch needed.
      Wrote `scripts/scrape/scrape-ornament-shop.py` — 131/131 items
      processed (128 single issues + 3 multi-issue bundle products, kept
      separate rather than force-matched to one issue). Confirmed the
      single JSON call was complete (items returned < declared pageSize).
      **Bug found and fixed same day:** the top-level `assetUrl` field
      silently returned a generic "no image" placeholder (diagonal lines,
      always exactly 2102 bytes) for 87/131 items instead of erroring —
      those products just don't have a "main" image set in Squarespace's
      admin, even though a real cover exists elsewhere in the record
      (`item.items[0].assetUrl`, which matches top-level `assetUrl` for the
      44 items that were already correct). Deleted the 87 exactly-2102-byte
      files and re-ran with the fixed field; all 131 are now verified real
      covers. **Lesson for future scrapers on this pattern:** don't trust a
      single top-level image field without checking file size/dimensions
      on at least a sample — a broken download here failed silently
      (200 OK, valid small JPEG) rather than throwing.
- [ ] For Spin-Off/Handwoven "Collection" bundles: this is a purchase
      decision, not an engineering one — flag to the user/guild treasurer
      rather than deciding unilaterally.
- [x] `scripts/scrape/extract-weavers-journal-pdfs.py` — **done
      2026-07-08.** Written in Python/PyMuPDF (self-contained pip wheel)
      rather than Node/`pdftoppm`. Downloaded all 15 PDFs the archive
      actually hosts (issues #32–46, Spring 1984–Fall 1987 — the archive
      does **not** have issues #1–31/1976–1983, correcting the original
      research's "full run" assumption) and extracted page 1 of each as a
      cover PNG into `scratch/covers/weavers-journal/`. 15/15 succeeded,
      spot-checked.
- [x] `scripts/scrape/ocr-weavers-journal-toc.py` — **done 2026-07-08.**
      Installed tesseract + poppler via Homebrew, confirmed page index 2
      is reliably the TOC page across both TOC layouts used in the run
      (checked first and last issue), rendered it at 300dpi and OCR'd with
      tesseract. 15/15 succeeded (193–565 words each), spot-checked
      against source images — high quality, article titles/authors all
      correctly readable. Both cover and TOC paths appended to
      `scratch/magazine-scrape-inventory.csv` for the 15 issues. **This
      title is fully complete.**
- [ ] The Camilla Valley Farm cumulative index purchase (Weaver's Journal)
      is a purchase decision like the Collection bundles above — flag to
      the user/treasurer rather than buying unilaterally.

### Step 1.4 — Send bulk-export/permission requests now (parallel to 1.2–1.3)

Do this in week 1, not after scraping wraps — a "yes" here removes an
entire title from Phase 2 photography before it starts.

- [x] **HGA** (Shuttle, Spindle & Dyepot) — **owner is contacting HGA
      directly** (existing membership relationship), so this is off the
      engineering task list; no scraping/photography effort should go into
      SS&D until that request resolves one way or the other.
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
- [ ] **Taunton Press** (Threads) — optional: ask about a bulk export or
      research/nonprofit access to the "Threads Insider" full-text archive
      for years outside Internet Archive's coverage, instead of paying for
      a subscription and scraping the reader UI.
- [ ] **NMWA** (Women in the Arts) — ask their library/publications team
      about back-issue access beyond the ~5 years shown on nmwa.org; there
      is no free path for older issues otherwise.
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

Applies to: Fiber Arts (all issues), Shuttle Spindle & Dyepot (**deferred**
pending the HGA request, not scheduled for photography yet), American Craft
2012–2017, "Interweave" (pending title disambiguation), Women in the Arts
(everything older than ~2021, pending NMWA outreach), and whatever
completeness report from Step 1.5 shows as missing for the other titles.
WEFT Magazine and The Weaver's Journal do **not** belong here — WEFT is
Tier 1 (Step 1.2) and The Weaver's Journal is Tier 2 (Step 1.3, PDF
extraction) since both have already-digitized source material.

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

### Step 2.7 — Disambiguate "Interweave" and "Weaver's Journal" (1988–1995 portion) before shooting either

- [ ] Pull the physical issues cataloged as "Interweave" and check the
      masthead/cover date against the candidates identified in
      `magazine-source-research.md` (original 1970s "Interweave" vs.
      Interweave Knits). ("Weft" no longer needs this check — confirmed as
      two separate held titles, WEFT Magazine and The Weaver's Journal,
      both already routed to Phase 1 above.)
- [ ] Pull physical issues from the guild's "Weaver's Journal" holdings
      dated 1988–1995 and check the masthead/publisher line: "Colorado
      Fiber Center" means it's actually *The Weaver's Journal* (already
      fully sourced, done above — shouldn't exist past Fall 1987 though,
      so this would be surprising), while "XRX Inc." or an editor credit
      to Madelyn van der Hoogt confirms it's the separate title *Weaver's*
      (1986–1999, not yet sourced at all). See the "Weaver's (XRX Inc.)"
      entry in `magazine-source-research.md`.
- [ ] Once confirmed, route each to Phase 1 (if it turns out to be an
      actively-scrapable/digitized title) or Phase 2 (if it's
      out-of-print/no-digital-source) accordingly — this check costs
      minutes and could remove a title from the photography workload
      entirely, or could open up a whole new sourcing research pass for
      *Weaver's* (XRX) if that's what the 1988–1995 issues turn out to be.

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
| HGA (Shuttle Spindle & Dyepot) | Owner contacting directly (in progress) | — | If granted: removes ~all SS&D issues from photography |
| Surface Design Association | — | — | If granted: removes/reduces SDJ TOC + cover photography |
| American Craft Council archives | — | — | If granted: removes 2012–2017 American Craft from photography |
| Long Thread Media | — | — | If granted: reduces Spin-Off/Handwoven cover photography |
| Taunton Press (Threads) | — | — | If granted: removes non-IA-year Threads photography/OCR |
| NMWA (Women in the Arts) | — | — | If granted: removes pre-2021 Women in the Arts photography |

*(Fill in as responses arrive — this table drives what actually needs to
be shot in Step 2.1.)*
