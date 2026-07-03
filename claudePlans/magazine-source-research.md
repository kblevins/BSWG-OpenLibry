# Magazine Cover Image & Table-of-Contents Sourcing Research

Research into whether cover images and table-of-contents (TOC) text can be
programmatically retrieved for each magazine series in the collection.
Feeds into [magazine-support.md](magazine-support.md) (Step 3/4: bulk import
of TOC text and cover images).

Assumption per series: holdings from the beginning of the series (or 1976)
to present.

---

## Summary table

| Magazine | Status | Cover images | TOC text | Verdict |
|---|---|---|---|---|
| PieceWork | Active (Long Thread Media) | Easy — DiscountMags predictable URLs, free thumbnails | Free PDF subject/author indexes 1993–2025 (real text) + Ravelry per-issue pages | **Easy scrape, no OCR** |
| Spin-Off | Active (Long Thread Media) | Moderate — shop pages for recent issues; older issues sold as bundled decade "Collections" | One free searchable master-index PDF, 1977–2025, real text | **TOC easy; covers moderate** |
| Shuttle, Spindle & Dyepot | Active (HGA) | Not available — gated behind paywalled third-party flip-book viewer (Watkins Printing); pre-2007 has no digital source at all | Same paywall; no public index exists | **Not available** — ask HGA directly, or scan own physical copies |
| American Craft | ACC still active; print ended Winter 2026 | Partial — 1999–2011 digitized (digital.craftcouncil.org), but site 403s automated fetches; **2012–2017 (your actual holdings) not in the free archive** | Not confirmed/likely absent | **Not really available for your range** — ToS forbids bulk reproduction; contact ACC archives |
| Ply | Active (now "PLYtogether") | Easy — stable Shopify CDN URLs per issue | Excellent — public 1,457-article searchable index at plymagazine.com/ply-article-index/ | **Easy scrape, no OCR** |
| Handwoven | Active (Long Thread Media) | Moderate — no stable free archive; needs purchased PDFs or shop thumbnails | Free PDF master index, 1979–2025, real text | **TOC easy; covers moderate/paid** |
| Fiber Arts | Ceased 2011 | Not available — no Internet Archive, HathiTrust, or Google Books holdings found | Not available — no per-issue index anywhere; only WorldCat bibliographic-level metadata | **Not available** — still in copyright; would need own physical scans |
| "Interweave" | Ambiguous — likely the 1970s flagship title, possibly conflated with Interweave Knits (print ended 2024) | Thin/inconsistent, commerce-page scraping only | No real TOC source found; would require buying + OCR-ing individual PDFs | **Not available as-is** — clarify which specific title is meant first |
| "Weft" | Ambiguous — likely *The Weaver's Journal* (defunct 1986) or the newer *WEFT Magazine* (active, 2023–) | Weaver's Journal: scanned PDFs exist (Univ. of Arizona archive) but image-only, no text layer, in-copyright. WEFT Magazine: modern site, scrapable | WEFT Magazine has a real searchable HTML index; Weaver's Journal only has a purchasable index of unconfirmed format | **Depends entirely on which title** — check physical issues to disambiguate |
| Ornament | Active | Moderate — shop product pages have images, but not all historical issues listed | Good — current back-issue product pages list real TOC text, but only for issues still in the shop | **Possible with scraping, incomplete for older issues** |
| Surface Design Journal | Active (SDA) | Partial — free Issuu previews back to ~2013, member-gated before that | SDA publishes a "Master Table of Contents" (2012–present), format unconfirmed, likely member-gated | **Possible with real effort** — ask SDA directly for a bulk export |

---

## Per-title detail

### PieceWork
- **Publisher/status:** Interweave Press → Long Thread Media (2019 acquisition). Still actively publishing.
- **Cover images:** DiscountMags (discountmags.com/magazine/piecework-digital/back-issues) lists 182 issues 1993–present, each with a cover thumbnail at a predictable URL pattern. Free to view thumbnails; full issue paywalled ($9.99/issue). Zinio also has issue-level pages, subscriber-gated.
- **TOC/index text:** Free downloadable PDF indexes at pieceworkmagazine.com/piecework-indexes/ — Subject Index (Mar 1993–Jan 2015), Author Index (same range), Combined Author/Subject Index (Jan/Feb 2015–Winter 2025). Real text, not scans, covering the entire back-catalog, organized by subject/author rather than per-issue TOC. Ravelry has per-issue source pages (e.g. ravelry.com/patterns/sources/piecework-summer-2021) listing patterns/projects as text, full detail needs free Ravelry login.
- **Access notes:** Cover thumbnails and PDF indexes freely accessible. Full-issue content paywalled. Respect ToS/robots and rate limits on DiscountMags/Zinio/Ravelry before automating at volume.
- **Sources:** pieceworkmagazine.com, pieceworkmagazine.com/piecework-indexes/, discountmags.com/magazine/piecework-digital/back-issues, ravelry.com/patterns/sources/piecework-summer-2021

### Spin-Off
- **Publisher/status:** Long Thread Media. Active (issues confirmed through Summer 2026).
- **Cover images:** shop.longthreadmedia.com/collections/spin-off-magazines has ~222 product pages with predictable URLs (`/products/spin-off-[season]-[year]`) but reliably covers only roughly 2023–2026; older issues sold as bundled "Collection Download" products (e.g. "Spin-Off 1991-1992 Collection," $24.99/8 issues), so cover scraping needs per-collection handling for older decades. Ravelry also has per-issue pages, coverage across all ~45 years not guaranteed.
- **TOC/index text:** Official Spin Off Index — single combined searchable PDF (subject + author) covering 1977 through Fall 2025, split into decade sections, at spinoffmagazine.com/spin-off-index-2011-2020/. Real extractable text, close to a de facto TOC for the whole run (article/subject titles + issue references, not full per-issue TOC pages).
- **Access notes:** Cover images and index PDF freely accessible, no login observed. Full back-issue content paywalled (individual purchase or $99.99/yr Digital All Access), scanned images not text — bulk text extraction of full content would need OCR.
- **Sources:** spinoffmagazine.com/library/, spinoffmagazine.com/spin-off-index-2011-2020/, shop.longthreadmedia.com/collections/spin-off-magazines, ravelry.com/patterns/sources/spin-off-magazine-website

### Shuttle, Spindle & Dyepot
- **Publisher/status:** Handweavers Guild of America (HGA), handweavers.org / weavespindye.org. Still actively published, quarterly, not merged/renamed.
- **Cover images:** Not freely available in bulk. Issues live on a third-party "digital edition" flip-book platform (digital.watkinsprinting.com), members-only, JS-rendered/login-walled — automated fetches returned empty content. Digital archive (2007+) gated behind HGA membership login.
- **TOC/index text:** The Watkins viewer advertises direct links from a contents page to articles and full-text search within an issue, implying real text exists inside the paywalled viewer. No consolidated public index found; HGA has historically sought a volunteer to build a cumulative index. No WorldCat article-level index, no fan-maintained index.
- **Access notes:** Everything of value (2007–present) sits behind HGA member login; pre-2007 (1976–2006) has no identified digital source at all. Automated bulk retrieval would require authenticated scraping of a third-party vendor's platform — likely against HGA/Watkins ToS.
- **Verdict:** Not available for bulk programmatic retrieval. Realistic path: manual/OCR digitization of the library's own physical holdings, or a direct permission-based request to HGA for a bulk export.
- **Sources:** weavespindye.org/ssd/, digital.watkinsprinting.com, en.wikipedia.org/wiki/Handweavers_Guild_of_America, librarything.com/nseries/28773/Shuttle-Spindle-Dyepot

### American Craft
- **Publisher/status:** American Craft Council (ACC), est. 1941 as *Craft Horizons*, renamed 1979. Print edition discontinued as of Winter 2026 (moved to digital-only on craftcouncil.org). ACC itself remains active.
- **Cover images:** ACC Library Digital Collections at digital.craftcouncil.org (CONTENTdm-style, collection p15785coll2) digitized the entire *Craft Horizons* run (1941–1979) plus *American Craft* through 2011 (2024 push added 1991–2011). **2012–2017 (the library's actual holdings) does not appear to be in this digitized archive** — only reachable via ACC's paywalled "Past Issues"/purchase pages, not built for bulk access.
- **TOC/article text:** No confirmed full-text-searchable index; digital.craftcouncil.org returned 403 to automated fetch (bot-blocking). No JSTOR/Internet Archive/HathiTrust presence found.
- **Access notes:** ACC Terms of Use explicitly prohibit reproduction, mass downloading, storing, or redistributing site material.
- **Verdict:** Possible with scraping/OCR only for 1999–2011 (pending ToS permission); 2012–2017 not evidently available at all. Recommend contacting ACC's library/archives directly for a bulk export or licensing arrangement.
- **Sources:** digital.craftcouncil.org, craftcouncil.org/library/archives, craftcouncil.org/articles/more-issues-of-american-craft-now-available-online, craftcouncil.org/terms-of-use, onlinebooks.library.upenn.edu/webbin/serial?id=americancraft

### Ply
- **Publisher/status:** Independent, Jacey Boggs Faulkner. Active — now part of "PLYtogether" bundle (with WEFT, PURL). Issues confirmed through Spring/Summer 2026 (issue #53).
- **Cover images:** Stable Shopify CDN URLs via the back-issues shop, one product page per issue (`plytogether.com/products/ply-[number]-[theme]-[season-year]`, also subscribe.plymagazine.com/shop/back-issues). 53 issues listed — straightforward to scrape the collection page for product links then pull cover image URLs.
- **TOC/article text:** plymagazine.com/ply-article-index/ — searchable database of 1,457 articles across all issues, with author, title, issue number/date/topic, linked to source issue. Effectively a text-searchable TOC for the whole back catalog. Paginated HTML (59 pages, `?listpage=1..59&instance=1`), no JSON API but easy to scrape sequentially. Individual issue pages themselves only have thematic descriptions, not full TOCs — the article index is the real TOC source.
- **Access notes:** Cover images and article index publicly browsable, no login needed. Full article text paywalled behind purchase. Scrape politely/rate-limited; consider emailing PLY as a courtesy given it's a small indie publisher.
- **Verdict:** Possible with straightforward scraping, no OCR needed.
- **Sources:** plytogether.com/collections/ply-magazine-back-issues, subscribe.plymagazine.com/shop/back-issues, plymagazine.com/ply-article-index/

### Handwoven
- **Publisher/status:** Long Thread Media (formerly Interweave Press), since 1979. Active (issues through Winter 2025/2026 confirmed).
- **Cover images:** No stable public API/archive. Long Thread Media sells yearly digital "Collections" (shop.longthreadmedia.com/collections/handwoven-magazines); subscribers get full digital back-issue access via Zinio. No stable per-issue cover-image URL pattern found — would need extraction from purchased/subscribed PDFs.
- **TOC/index text:** Free downloadable, real-text PDF indexes at handwovenmagazine.com/index/ — combined author+subject master index 1979–2025, plus separate 1979–2004 and 2005–2011/2012–2025 indexes. Organized by author/subject/pattern rather than per-issue layout, but effectively contains article-level metadata for the whole back-catalog. Trivially machine-readable (PDF text extraction, no OCR). Mirrored by local guilds (e.g. triangleweavers.org).
- **Access notes:** Full digital issues/covers paywalled behind subscription or per-year purchase; no free bulk archive of issue PDFs or covers. Index PDFs are free/public.
- **Verdict:** TOC easy (free PDFs, direct text extraction). Covers possible but not free/bulk — requires purchase/subscription or manual thumbnail saving.
- **Sources:** handwovenmagazine.com/index/, shop.longthreadmedia.com/collections/handwoven-magazines, triangleweavers.org (mirrored index PDF)

### Fiber Arts
- **Publisher/status:** Founded 1975 by Rob Pulleyn/Kate Mathews (Fiberarts Inc./Altamont Press), first issue Jan/Feb 1976, Asheville NC from 1979. Acquired by Interweave Press. Ceased with the **Summer 2011** issue — Interweave cited insufficient financial support; no acquirer took over the title. (Interweave itself was later acquired by F+W Media in Aug 2012, after Fiberarts had already shut down.) Editorial archive (correspondence, artist statements, production files 1970–2001) donated to Colorado State University's Morgan Library Archives & Special Collections.
- **Cover images / TOC:** No digitization found anywhere —
  - **Internet Archive:** No `sim_fiberarts` or `pub_fiberarts` collection exists; advanced-search API returns 49 items for "fiberarts"/"fiber arts", none are magazine issues (all books/anthologies/guild videos). Zero issue-level coverage.
  - **HathiTrust:** No digitized issues found; catalog/Bibliographic API queries return no records for this title's OCLC number (3301202).
  - **Google Books:** No evidence of scanned magazine issues (only unrelated books with "fiber arts" in the title).
  - **WorldCat:** Standard serial bibliographic record only (OCLC #3301202) — title/publisher/subject headings/library holdings, zero article-level indexing.
  - **Library databases (Art Full Text, Art Index, ARTbibliographies Modern):** No confirmed coverage found.
  - **Fan/community indexes:** None found.
- **Access/legal notes:** Still under U.S. copyright (post-1978 serial; rights likely held by Thrums LLC/Long Thread Media as Interweave's successor). Archive.org and HathiTrust both restrict bulk/automated download of in-copyright material even where scans exist (neither has any here regardless). No clean bulk-download path exists.
- **Verdict:** Not available online in any form. Only path: your own physical scans (covers + TOC pages), or a direct licensing conversation with Long Thread Media/Thrums LLC. Facts (titles, issue TOC entries) aren't copyrightable if you manually transcribe them, but scraping cover art/full text would need permission.
- **Sources:** archives.colostate.edu/repositories/2/resources/163, source.colostate.edu/fiberarts-editorial-archives-donated-morgan-library, fiberfocus.blogspot.com/2011/06/fiberarts-magazine-bites-dust-call-to.html, en.wikipedia.org/wiki/F+W, fiberartnow.net (unofficial spiritual successor, separate publication), worldcat.org/title/fiberarts/oclc/3301202

### "Interweave"
- **Identification (ambiguous, ~60% confidence):** Most likely the original 1970s flagship "Interweave" quarterly (fiber/textile arts, founded fall 1975 by Linda Ligon, Loveland CO), which spawned Spin-Off (1977) and Handwoven (1979) before giving way to those titles and later Interweave Knits (~1996–2024, print ended Spring 2024). **Recommend confirming with the physical issues/catalog which specific title is meant** — feasibility differs drastically.
- **Cover images:** Only reliably available for the Interweave Knits era via interweave.com product pages and scattered Internet Archive items (e.g. archive.org/details/Interweave_Knits_2016-01). No cover archive found for the original 1970s–80s title. No image API/RSS — would mean page-by-page commerce-site scraping.
- **TOC/article text:** interweave.com product pages have only marketing blurbs and a short featured-projects list, not a full TOC — real TOC text would require purchasing/downloading each PDF and OCR/parsing.
- **Access notes:** interweave.com is a commerce site (~$5–8/issue); bulk scraping plus buying hundreds of PDFs likely violates ToS and is cost-prohibitive. Some Internet Archive items are lending/borrow-restricted.
- **Verdict:** Not available as-is; possible only with heavy manual/OCR work, and only for the Interweave Knits era. Clarify the exact title first.
- **Sources:** interweave.com, archive.org/details/Interweave_Knits_2016-01, archive.org/details/InterweaveKnitsCollection2010

### "Weft"
- **Identification (ambiguous, two strong candidates):**
  - *The Weaver's Journal* (1976–1986, Boulder CO area, later renamed *Weavers*) — likely if the catalog entry is old/informal.
  - *WEFT Magazine* (weftmagazine.com, launched ~2023 by Jacey Boggs) — literal title match, likely if the catalog entry is recent.
  - Weaker candidates: *Warp and Weft* (1947–1985, Robin & Russ Handweavers — revival site appears expired/hijacked, do not use), regional guild newsletters.
  - **Recommend checking the physical issue date first** — this alone resolves the ambiguity.
- **The Weaver's Journal:** Defunct (ended 1986). University of Arizona's "Digital Archive of Periodicals Related to Weaving" (www2.cs.arizona.edu/patterns/weaving/wj.html) has a predictable per-issue PDF URL pattern (`.../wj_<n>.pdf`) — scriptable, but scans are image-only, no OCR text layer. A purchasable "Ten Year Cumulative Index" exists via Camilla Valley Farm/Hill Creek Fiber Studio, format unconfirmed. Still in copyright, rights likely held by Long Thread Media as an Interweave successor — no confirmed reuse rights.
- **WEFT Magazine:** Active, quarterly. Modern subscription site, no open API found; images likely scrapable per-issue but behind subscriber gating for full content. Has a genuinely searchable HTML index (weftmagazine.com/index/, ~124 articles, filterable) — real text, easy scrape.
- **Verdict:** Weaver's Journal — possible with OCR (scans exist but no text layer, unclear reuse rights). WEFT Magazine — easy scrape for TOC text, covers likely scrapable pending ToS/gating check. Confirm which title the guild actually owns before investing engineering effort.
- **Sources:** www2.cs.arizona.edu/patterns/weaving/wj.html, weftmagazine.com/index/

### Ornament
- **Publisher/status:** Ornament Magazine LLC (founded 1974 as *The Bead Journal*, retitled 1978), San Marcos CA. Still actively publishing quarterly print as of 2026 (Vol. 46.x). Also runs a paid digital community add-on ("Ornament Behind the Covers," $14.99/yr, on Circle.so).
- **Cover images:** Shop pages (ornamentmagazine.org/shop/back-issue/, individual product pages) show 3–4 cover/product photos each, but no direct static image URLs exposed in fetched HTML — would need Shopify CDN asset inspection per issue. Not all back issues listed (some sold out); coverage of the 1970s–2010s archive uncertain from the shop alone.
- **TOC/article text:** Individual back-issue product pages list a real table of contents (feature articles, department names) as page text, not images — scrapable as structured text per issue currently listed in the shop. Full article body text paywalled behind PDF/print purchase or the Behind-the-Covers subscription.
- **Access notes:** Standard e-commerce site, blanket copyright notice (1974–2026), no specific scraping prohibition confirmed but should be checked directly before bulk retrieval.
- **Verdict:** Possible with scraping, not a clean API. Covers moderate effort/incomplete coverage; TOC scrapable as real text but only for issues still listed in the shop — older/out-of-print issues may need OCR of physical copies.
- **Sources:** ornamentmagazine.org, en.wikipedia.org/wiki/Ornament_(magazine), ornamentmagazine.org/shop/back-issue/, ornamentmagazine.org/ornament-online

### Surface Design Journal
- **Publisher/status:** Surface Design Association (surfacedesign.org), active nonprofit, publishing SDJ quarterly since the 1970s.
- **Cover images:** No open API/RSS. Issuu (issuu.com/surfacedesignorg) hosts free public "sample issue" previews (cover + a few pages) for many issues back to ~2013 — coverage/consistency across the full back-catalog unverified. SDA member digital-journal page shows cover thumbnails back to Spring 2011, but full access requires SDA member login (OAuth-gated).
- **TOC/index text:** SDA publishes a "Master Table of Contents" (Volume I: Spring 2012–Winter 2021; Volume II: Spring 2022–present), searchable by topic/artist/technique/material — best lead, format (PDF vs. embedded viewer) and membership requirement not confirmed. No per-issue machine-readable TOC or library-database (JSTOR/EBSCO) indexing found.
- **Access notes:** Full digital journal content is member-only. Issuu's ToS generally prohibits scraping/bulk downloading. Any bulk retrieval of member-gated content needs SDA's explicit permission.
- **Verdict:** Possible with real effort, not an easy API. Recommend requesting the Master TOC files and a cover-image bulk export directly from SDA staff rather than scraping.
- **Sources:** surfacedesign.org/journal/about-the-journal, surfacedesign.org/journal/digital-journal-new, issuu.com/surfacedesignorg

---

## Key takeaways

1. **Ply, PieceWork, and the TOC sides of Spin-Off/Handwoven are genuinely easy** — free, real text, no OCR, low legal risk for metadata-only use (titles/authors/subjects, not full article text or paywalled cover art).
2. **Fiber Arts and Shuttle, Spindle & Dyepot are dead ends online** — nothing digitized is publicly reachable for either. If the guild holds physical copies, scanning those is the only realistic path.
3. **American Craft's 2012–2017 range (the library's actual holdings) isn't covered** by ACC's own digitization effort, which stops at 2011.
4. **"Interweave" and "Weft" are ambiguous catalog entries** — feasibility swings wildly depending on which specific publication is meant. Check the physical issues (masthead, dates) before investing engineering effort.
5. **Copyright/ToS applies throughout.** Most publishers' full issue content is paywalled and copyrighted; free indexes are metadata (titles/authors/subjects) and safe to use for cataloging. Bulk-scraping paywalled cover art or full article text risks ToS/copyright issues. For membership-gated sources (HGA, SDA), asking the organization directly for a bulk export is both safer and more likely to succeed than scraping.
