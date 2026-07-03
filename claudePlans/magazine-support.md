# Magazine Support — Implementation Plan

Adds magazine issues to the library catalog as first-class `Book` records with
structured volume/issue metadata, a bulk cover-image workflow, and full-text
search over table-of-contents (TOC) text via Postgres full-text search.

Scale assumption: several hundred issues, each with a non-trivial TOC text
blob — too much to ship to every browser via the existing client-side
itemsjs search (`hooks/useBookSearch.ts`), so TOC search gets a server-side
Postgres FTS endpoint instead of piggybacking on `extraSearchableFields`.

---

## Decisions

- **One `Book` row per issue.** Reuses existing rental/checkout/audit
  machinery as-is. No new `Periodical`/`Series` table — `title` stays the
  series name (e.g. "Guild Gazette"), volume/issue become their own columns
  instead of being encoded into the title string.
- **TOC search is server-side (Postgres FTS)**, additive to the existing
  client-side itemsjs search — title/author/subtitle/isbn instant search on
  the catalog page is untouched.
- **Cover images reuse the existing per-book upload/serving path**
  (`pages/api/book/cover/[id].ts`, `pages/api/images/[id].ts`), bulk-filled
  by a new script rather than new upload UI.

---

## Step 1 — Schema migration

Add to `Book` in `prisma/schema.prisma`:

```prisma
model Book {
  // ...existing fields...
  magazineVolume    String?
  magazineIssue     String?
  tableOfContents   String?
}
```

- [ ] Add the three fields above
- [ ] Generate migration: `npx prisma migrate dev --name add_magazine_fields`
- [ ] Add a raw-SQL follow-up migration (Prisma doesn't manage `tsvector`
      generated columns) to add FTS support:

```sql
ALTER TABLE "Book" ADD COLUMN "tocSearchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("tableOfContents", '') || ' ' || coalesce("title", ''))
  ) STORED;

CREATE INDEX "Book_tocSearchVector_idx" ON "Book" USING GIN ("tocSearchVector");
```

  Place this as `prisma/migrations/<timestamp>_add_toc_search_vector/migration.sql`
  (write the SQL by hand since Prisma schema can't express generated columns).

- [ ] Update `entities/BookType.ts` with `magazineVolume?`, `magazineIssue?`,
      `tableOfContents?` (omit `tocSearchVector` — it's DB-internal, never
      read/written through Prisma client the normal way).

---

## Step 2 — Book form / display

- [ ] `components/book/BookEditForm.tsx` — add `magazineVolume`,
      `magazineIssue`, and a multiline `tableOfContents` text field. Keep
      these optional so the form still works for non-magazine items.
- [ ] `components/book/BookSummaryCard.tsx` — if `magazineVolume`/
      `magazineIssue` are set, render "Vol. X, No. Y" under the title.
- [ ] Decide display convention: `title` = series name only, volume/issue
      shown separately (not concatenated into `title` at write time). This
      keeps `title` stable for "all issues of this series" filtering later.

---

## Step 3 — Bulk import: Excel path (metadata + TOC text)

- [ ] `lib/utils/xlsColumnsMapping.ts` — add to `xlsbookcolumns`:
      `{ key: "magazineVolume", header: "Volume" }`,
      `{ key: "magazineIssue", header: "Issue" }`,
      `{ key: "tableOfContents", header: "Table of Contents" }`
- [ ] `pages/api/excel/index.ts` — in the book-import `forEach`, map the new
      columns through: `magazineVolume: b["Volume"]`, `magazineIssue: b["Issue"]`,
      `tableOfContents: b["Table of Contents"]`. No other changes needed —
      the generated `tocSearchVector` column populates automatically on
      insert since it's `GENERATED ALWAYS`.
- [ ] Confirm the German-pinned worksheet name (`"Book List"`) and header
      strings stay consistent with existing Cypress fixtures — check
      `cypress/fixtures` for any hardcoded column list that needs updating.

This gives a working bulk-import path for hundreds of issues: prepare one
Excel row per issue (title, volume, issue, TOC text, ISBN/ISSN if used),
import through the existing `/admin` Excel import UI.

---

## Step 4 — Bulk cover images

New script `scripts/import-magazine-covers.mjs`, modeled on
`scripts/import-books.mjs`:

- Input: a directory of cover images named by a stable external key (e.g.
  barcode, ISSN+issue code — whatever's printed on the physical issue), and
  a CSV/JSON mapping produced from the Excel import (`externalKey -> id`,
  either exported manually or by adding an `externalKey` lookup column to
  the import).
- For each image: resolve `bookId` from the mapping, copy/rename the file to
  `COVERIMAGE_FILESTORAGE_PATH/<bookId>.jpg` (matching the exact convention
  `pages/api/book/cover/[id].ts` already uses).
- Log unmatched files (key not found) the same way `import-books.mjs` logs
  failed ISBNs to a file for manual follow-up.

- [ ] Decide the stable external key before running the Excel import (needed
      to build the mapping afterward) — recommend adding an `ISBN`-column-style
      "External Key" field to the import row for this purpose, since `Book`
      has no dedicated field for it otherwise.
- [ ] Write and test the script against a handful of sample files locally
      before running against the full batch.
- [ ] No changes needed to `pages/api/images/[id].ts` — it already serves by
      `<id>.jpg` convention.

---

## Step 5 — Server-side TOC full-text search API

New endpoint `pages/api/search/toc.ts`:

```ts
// GET /api/search/toc?q=<query>&limit=20
```

- [ ] Use `prisma.$queryRaw` with `to_tsquery`/`plainto_tsquery` and
      `ts_rank` against `tocSearchVector`, e.g.:

```sql
SELECT id, title, "magazineVolume", "magazineIssue",
       ts_rank("tocSearchVector", query) AS rank,
       ts_headline('english', "tableOfContents", query,
         'MaxFragments=2, MaxWords=15') AS snippet
FROM "Book", plainto_tsquery('english', $1) query
WHERE "tocSearchVector" @@ query
ORDER BY rank DESC
LIMIT $2;
```

- [ ] Sanitize/validate `q` (non-empty, reasonable max length) before passing
      into `plainto_tsquery` — `plainto_tsquery` already treats input as
      plain text (not tsquery syntax), so this is safe from injection as
      long as it's passed as a bound parameter, not string-concatenated.
- [ ] Return `{ id, title, magazineVolume, magazineIssue, rank, snippet }[]`
      — the `ts_headline` snippet lets the UI show *why* a result matched
      without shipping the full TOC text.
- [ ] Add corresponding `errorLogger`/`businessLogger` calls and a
      `LogEvents` entry, matching the pattern in every other API route.

---

## Step 6 — Frontend: TOC search UI

- [ ] Add a "Search table of contents" input, either as a second search box
      on `pages/catalog.tsx` or a dedicated `/catalog/magazines` view —
      debounce (reuse the `debounce` package already used in
      `useBookSearch.ts`) and call `/api/search/toc`.
- [ ] Render results as a distinct list (id, title, vol/issue, snippet with
      highlighted match) linking to the book detail page — separate from the
      instant client-side title/author search so the two don't get confused
      (TOC search is a server round-trip, not instant-as-you-type against
      the in-memory index).
- [ ] Keep the existing `useBookSearch` untouched — do not add
      `tableOfContents` to `extraSearchableFields`, since that would ship
      full TOC text to the browser for every catalog load, which is exactly
      what the server-side route avoids.

---

## Step 7 — Tests

- [ ] Cypress: extend excel-import fixtures/e2e test with a magazine row
      (volume/issue/TOC columns) if `cypress/e2e` covers the import flow.
- [ ] API test (or manual `curl`) for `/api/search/toc` covering: match
      found, no match, empty query rejected.
- [ ] Manual verification: import a small batch of magazine issues, run the
      cover-image script against sample files, confirm covers render via
      `pages/api/images/[id].ts`, and confirm a TOC search returns expected
      snippets.

---

## Rollout order

1. Schema migration (Step 1) — deploy first, backward compatible (all new
   fields nullable).
2. Excel import + form changes (Steps 2–3) — start entering/importing
   magazine metadata and TOC text.
3. Cover script (Step 4) — run once enough issues exist with a resolvable
   external key.
4. Search API + UI (Steps 5–6) — ship once there's enough TOC text imported
   to be worth searching.
