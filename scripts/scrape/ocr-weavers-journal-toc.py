#!/usr/bin/env python3
"""
OCR the table-of-contents page of each downloaded Weaver's Journal PDF.

Depends on `scripts/scrape/extract-weavers-journal-pdfs.py` having already
downloaded the PDFs into scratch/weavers-journal/pdfs/.

Confirmed by visual inspection of two issues (first, #32, and last, #46,
spanning both TOC layouts used across the run): page index 2 (the 3rd
page of the PDF) is always the full table-of-contents page. Page 0 is
usually a full-page ad, page 1 varies (ad or cover-story teaser).

Requires tesseract (installed via `brew install tesseract`) and PyMuPDF
(`pip install pymupdf`, already used by the extract script).

Usage:
    python3 scripts/scrape/ocr-weavers-journal-toc.py

Writes raw OCR text to scratch/toc/weavers-journal/wj-<n>.txt and a
rendered PNG of the TOC page (for spot-checking) to
scratch/toc/weavers-journal/wj-<n>-toc-page.png.
"""

import os
import subprocess
import sys

import fitz  # PyMuPDF

TOC_PAGE_INDEX = 2  # 0-indexed; confirmed page 3 of every issue's PDF

SCRATCH = os.path.join(os.path.dirname(__file__), "..", "..", "scratch")
PDF_DIR = os.path.join(SCRATCH, "weavers-journal", "pdfs")
TOC_DIR = os.path.join(SCRATCH, "toc", "weavers-journal")

TESSERACT_BIN = "/opt/homebrew/bin/tesseract"


def main():
    os.makedirs(TOC_DIR, exist_ok=True)

    pdfs = sorted(f for f in os.listdir(PDF_DIR) if f.endswith(".pdf"))
    if not pdfs:
        print(f"No PDFs found in {PDF_DIR} -- run extract-weavers-journal-pdfs.py first")
        sys.exit(1)

    confidences = []
    for filename in pdfs:
        handle = filename.replace(".pdf", "").replace("wj_", "wj-")
        pdf_path = os.path.join(PDF_DIR, filename)
        png_path = os.path.join(TOC_DIR, f"{handle}-toc-page.png")
        txt_path = os.path.join(TOC_DIR, f"{handle}.txt")

        doc = fitz.open(pdf_path)
        if TOC_PAGE_INDEX >= doc.page_count:
            print(f"{filename}: fewer than {TOC_PAGE_INDEX + 1} pages, skipping")
            doc.close()
            continue

        # Higher DPI than the cover extraction -- OCR accuracy benefits
        # from more resolution on body text than a cover image does.
        pix = doc[TOC_PAGE_INDEX].get_pixmap(dpi=300)
        pix.save(png_path)
        doc.close()

        result = subprocess.run(
            [TESSERACT_BIN, png_path, "stdout"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"{filename}: tesseract failed: {result.stderr}")
            continue

        with open(txt_path, "w") as f:
            f.write(result.stdout)

        word_count = len(result.stdout.split())
        print(f"{filename} -> {txt_path} ({word_count} words)")

    print(f"\nDone. OCR'd {len(pdfs)} issues into {TOC_DIR}")


if __name__ == "__main__":
    main()
