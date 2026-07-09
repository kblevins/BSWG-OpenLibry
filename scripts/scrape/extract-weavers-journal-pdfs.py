#!/usr/bin/env python3
"""
Download the Weaver's Journal issue PDFs from the University of Arizona
weaving archive and extract page 1 of each as a cover image.

Written in Python (not Node, unlike the other scripts in this directory)
because cover extraction needs PDF page rasterization, and PyMuPDF
(`pip install pymupdf`) is a self-contained wheel with no system
dependencies (no poppler/tesseract/node-canvas install required).

IMPORTANT: the archive index page (wj.html) only lists issues 32-46
(Spring 1984 - Fall 1987, marked "final issue" there) -- NOT the full
1976-1986 run assumed in earlier research. Issues 1-31 (1976-1983) are
not present on this archive at all.

The PDFs are straight image scans with no text layer (confirmed: page
.get_text() returns empty on every page), so there is no free TOC text
here -- only cover images. TOC text still needs either OCR (a tesseract
install is not available in this environment) or the purchased Camilla
Valley Farm cumulative index.

Usage:
    python3 scripts/scrape/extract-weavers-journal-pdfs.py

Downloads PDFs to scratch/weavers-journal/pdfs/, writes cover images to
scratch/covers/weavers-journal/, and appends rows to scratch/manifest.csv.
"""

import csv
import os
import time
import urllib.request

import fitz  # PyMuPDF

BASE_URL = "https://www2.cs.arizona.edu/patterns/weaving/periodicals/"

# (pdf filename, volume, issue number, season, year)
ISSUES = [
    ("wj_32.pdf", "VIII", 4, 32, "Spring", 1984),
    ("wj_33.pdf", "IX", 1, 33, "Summer", 1984),
    ("wj_34.pdf", "IX", 2, 34, "Fall", 1984),
    ("wj_35.pdf", "IX", 3, 35, "Winter", 1985),
    ("wj_36.pdf", "IX", 4, 36, "Spring", 1985),
    ("wj_37.pdf", "X", 1, 37, "Summer", 1985),
    ("wj_38.pdf", "X", 2, 38, "Fall", 1985),
    ("wj_39.pdf", "X", 3, 39, "Winter", 1986),
    ("wj_40.pdf", "X", 4, 40, "Spring", 1986),
    ("wj_41.pdf", "XI", 1, 41, "Summer", 1986),
    ("wj_42.pdf", "XI", 2, 42, "Fall", 1986),
    ("wj_43.pdf", "XI", 3, 43, "Winter", 1987),
    ("wj_44.pdf", "XI", 4, 44, "Spring", 1987),
    ("wj_45.pdf", "XII", 1, 45, "Summer", 1987),
    ("wj_46.pdf", "XII", 2, 46, "Fall", 1987),
]

SCRATCH = os.path.join(os.path.dirname(__file__), "..", "..", "scratch")
PDF_DIR = os.path.join(SCRATCH, "weavers-journal", "pdfs")
COVER_DIR = os.path.join(SCRATCH, "covers", "weavers-journal")
MANIFEST_PATH = os.path.join(SCRATCH, "manifest.csv")

HEADERS = {"User-Agent": "Mozilla/5.0"}


def download(url, dest_path, attempts=3):
    if os.path.exists(dest_path):
        return
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            with open(dest_path, "wb") as f:
                f.write(data)
            return
        except Exception as err:
            if attempt == attempts - 1:
                raise
            time.sleep(2 * (attempt + 1))


def ensure_manifest_header():
    if not os.path.exists(MANIFEST_PATH):
        os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
        with open(MANIFEST_PATH, "w", newline="") as f:
            csv.writer(f).writerow(
                ["series", "handle", "title", "sourceUrl", "localImagePath"]
            )


def append_manifest_row(handle, title, source_url, local_image_path):
    with open(MANIFEST_PATH, "a", newline="") as f:
        csv.writer(f).writerow(
            ["weavers-journal", handle, title, source_url, local_image_path]
        )


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(COVER_DIR, exist_ok=True)
    ensure_manifest_header()

    failed = []
    for filename, volume, number, issue_num, season, year in ISSUES:
        handle = f"wj-{issue_num}"
        title = f"The Weaver's Journal Vol. {volume}, No.{number} Issue {issue_num} ({season} {year})"
        source_url = BASE_URL + filename
        pdf_path = os.path.join(PDF_DIR, filename)
        cover_path = os.path.join(COVER_DIR, f"{handle}.png")

        try:
            print(f"Downloading {filename} ...")
            download(source_url, pdf_path)

            if not os.path.exists(cover_path):
                doc = fitz.open(pdf_path)
                page = doc[0]
                pix = page.get_pixmap(dpi=200)
                pix.save(cover_path)
                doc.close()
                print(f"  -> cover extracted: {cover_path}")

            append_manifest_row(handle, title, source_url, cover_path)
            time.sleep(1)  # courtesy delay, matching other scrapers in this repo
        except Exception as err:
            print(f"  FAILED: {filename}: {err}")
            failed.append((filename, str(err)))

    if failed:
        failed_path = os.path.join(SCRATCH, "weavers-journal-failed.txt")
        with open(failed_path, "w") as f:
            for filename, err in failed:
                f.write(f"{filename}: {err}\n")
        print(f"\n{len(failed)} failures logged to {failed_path}")

    print(f"\nDone. {len(ISSUES) - len(failed)}/{len(ISSUES)} covers extracted.")


if __name__ == "__main__":
    main()
