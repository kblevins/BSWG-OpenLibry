/**
 * Batch ISBN import script
 *
 * Usage:
 *   node scripts/import-books.mjs <isbn-file.txt>
 *
 * The file should contain one ISBN per line. Hyphens and spaces are stripped.
 * Books are looked up via the Open Library API. Any ISBNs not found are written
 * to failed-isbns.txt for manual entry.
 *
 * Requires DATABASE_URL to be set (or defaults to the local SQLite dev.db).
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function fetchBookData(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const key = `ISBN:${isbn}`;
  if (!data[key]) return null;

  const book = data[key];
  return {
    title: book.title || "Unknown Title",
    author: book.authors?.[0]?.name || "Unknown Author",
    isbn,
    publisherName: book.publishers?.[0]?.name ?? null,
    publisherDate: book.publish_date ?? null,
    imageLink: book.cover?.medium ?? null,
    renewalCount: 0,
    rentalStatus: "available",
  };
}

async function importFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const isbns = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim().replace(/[-\s]/g, ""))
    .filter((line) => /^\d{9,13}[\dXx]?$/.test(line));

  if (isbns.length === 0) {
    console.error("No valid ISBNs found in file.");
    process.exit(1);
  }

  console.log(`Found ${isbns.length} ISBNs. Starting import…\n`);

  let success = 0;
  let skipped = 0;
  const failed = [];

  for (const isbn of isbns) {
    // Skip duplicates already in the library
    const existing = await prisma.book.findFirst({ where: { isbn } });
    if (existing) {
      console.log(`  – ${isbn}: already in library, skipped`);
      skipped++;
      continue;
    }

    const bookData = await fetchBookData(isbn);
    if (bookData) {
      await prisma.book.create({ data: bookData });
      success++;
      console.log(`  ✓ ${bookData.title}`);
    } else {
      failed.push(isbn);
      console.log(`  ✗ ${isbn}: not found in Open Library`);
    }

    // Be polite to the Open Library API
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(
    `\nDone: ${success} imported, ${skipped} skipped, ${failed.length} not found.`,
  );

  if (failed.length > 0) {
    fs.writeFileSync("failed-isbns.txt", failed.join("\n"));
    console.log(
      `\nFailed ISBNs saved to failed-isbns.txt — add these manually via the admin UI.`,
    );
  }

  await prisma.$disconnect();
}

if (!process.argv[2]) {
  console.error("Usage: node scripts/import-books.mjs <isbn-file.txt>");
  process.exit(1);
}

importFromFile(process.argv[2]).catch((err) => {
  console.error(err);
  process.exit(1);
});
