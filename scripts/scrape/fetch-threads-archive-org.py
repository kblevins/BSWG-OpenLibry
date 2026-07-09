#!/usr/bin/env python3
"""
Pull Threads Magazine covers and full-text OCR from the Internet Archive
item "threads_magazine" (archive.org/details/threads_magazine).

Unlike most titles in this collection, this single IA item bundles 169
individual issues (Oct/Nov 1985 - Nov 2013) as separate files rather than
one item per issue -- confirmed via the item's /metadata endpoint, which
lists a `<title>.pdf` (full scanned issue) and `<title>_djvu.txt` (full
OCR text, already run by IA, no OCR needed on our end) per issue.

Two-phase to keep bandwidth sane: the djvu.txt files are tiny (~51MB for
all 168 issues combined) and are pulled for every issue unconditionally.
The main PDFs are large (~3GB combined) and are only used transiently --
downloaded one at a time, page 1 rendered to a cover PNG via PyMuPDF, then
the PDF is deleted (we don't need to retain multi-hundred-MB scans, just
the cover + already-free OCR text).

Usage:
    python3 scripts/scrape/fetch-threads-archive-org.py [--covers-only N]

    --covers-only N   only download+extract covers for the first N issues
                       (for a quick spot-check before running the full set)

Writes scratch/covers/threads/<handle>.png and scratch/toc/threads/<handle>.txt,
and appends rows to scratch/manifest.csv.
"""

import csv
import os
import re
import sys
import time
import urllib.request

import fitz  # PyMuPDF

ITEM = "threads_magazine"
METADATA_URL = f"https://archive.org/metadata/{ITEM}"
DOWNLOAD_BASE = f"https://archive.org/download/{ITEM}"

SCRATCH = os.path.join(os.path.dirname(__file__), "..", "..", "scratch")
COVER_DIR = os.path.join(SCRATCH, "covers", "threads")
TOC_DIR = os.path.join(SCRATCH, "toc", "threads")
PDF_TMP_DIR = os.path.join(SCRATCH, "threads-pdf-tmp")
MANIFEST_PATH = os.path.join(SCRATCH, "manifest.csv")

HEADERS = {"User-Agent": "Mozilla/5.0"}


def fetch_url(url, dest_path=None, attempts=3):
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
            if dest_path:
                with open(dest_path, "wb") as f:
                    f.write(data)
                return None
            return data
        except Exception as err:
            if attempt == attempts - 1:
                raise
            time.sleep(2 * (attempt + 1))


def parse_issue(pdf_filename):
    # "Threads Magazine 01 - Premier Issue - Oct Nov 1985.pdf"
    m = re.match(r"Threads Magazine (\d+) - (.+)\.pdf$", pdf_filename)
    if not m:
        return None
    number = int(m.group(1))
    rest = m.group(2)
    return {"number": number, "label": rest, "handle": f"threads-{number:03d}"}


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
            ["threads", handle, title, source_url, local_image_path]
        )


def main():
    covers_only_n = None
    if "--covers-only" in sys.argv:
        covers_only_n = int(sys.argv[sys.argv.index("--covers-only") + 1])

    os.makedirs(COVER_DIR, exist_ok=True)
    os.makedirs(TOC_DIR, exist_ok=True)
    os.makedirs(PDF_TMP_DIR, exist_ok=True)
    ensure_manifest_header()

    print(f"Fetching {METADATA_URL} ...")
    meta = fetch_url(METADATA_URL)
    import json

    meta = json.loads(meta)
    files = meta["files"]

    # Only the primary per-issue PDFs (skip the "_text.pdf" alternate variant)
    pdf_files = [
        f["name"]
        for f in files
        if f["name"].endswith(".pdf") and not f["name"].endswith("_text.pdf")
    ]
    issues = [i for i in (parse_issue(p) for p in pdf_files) if i]
    issues.sort(key=lambda i: i["number"])
    print(f"Found {len(issues)} issues (numbers {issues[0]['number']}-{issues[-1]['number']})")

    if covers_only_n:
        issues = issues[:covers_only_n]
        print(f"--covers-only set: limiting to first {len(issues)} issues")

    failed = []
    for issue in issues:
        handle = issue["handle"]
        label = issue["label"]
        pdf_name = f"Threads Magazine {issue['number']:02d} - {label}.pdf"
        djvu_name = f"Threads Magazine {issue['number']:02d} - {label}_djvu.txt"
        title = f"Threads Magazine #{issue['number']} - {label}"

        toc_path = os.path.join(TOC_DIR, f"{handle}.txt")
        cover_path = os.path.join(COVER_DIR, f"{handle}.png")
        pdf_url = f"{DOWNLOAD_BASE}/{pdf_name.replace(' ', '%20')}"

        try:
            # Full OCR text -- cheap, always pulled
            if not os.path.exists(toc_path):
                djvu_url = f"{DOWNLOAD_BASE}/{djvu_name.replace(' ', '%20')}"
                fetch_url(djvu_url, toc_path)
                print(f"  {handle}: OCR text saved ({os.path.getsize(toc_path)} bytes)")

            # Cover -- download PDF transiently, extract page 1, delete PDF
            if not os.path.exists(cover_path):
                pdf_tmp_path = os.path.join(PDF_TMP_DIR, f"{handle}.pdf")
                print(f"  {handle}: downloading PDF for cover extraction...")
                fetch_url(pdf_url, pdf_tmp_path)

                doc = fitz.open(pdf_tmp_path)
                pix = doc[0].get_pixmap(dpi=150)
                pix.save(cover_path)
                doc.close()
                os.remove(pdf_tmp_path)
                print(f"  {handle}: cover extracted")

            append_manifest_row(handle, title, pdf_url, cover_path)
            time.sleep(1)
        except Exception as err:
            print(f"  FAILED: {handle}: {err}")
            failed.append((handle, str(err)))

    if failed:
        failed_path = os.path.join(SCRATCH, "threads-failed.txt")
        with open(failed_path, "w") as f:
            for handle, err in failed:
                f.write(f"{handle}: {err}\n")
        print(f"\n{len(failed)} failures logged to {failed_path}")

    print(f"\nDone. {len(issues) - len(failed)}/{len(issues)} issues processed.")


if __name__ == "__main__":
    main()
