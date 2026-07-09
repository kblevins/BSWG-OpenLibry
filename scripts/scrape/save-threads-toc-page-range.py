#!/usr/bin/env python3
"""
Save a small range of early pages (indices 1-6) as images for each Threads
Magazine issue, so a human can glance at a handful of thumbnails and pick
out the real table-of-contents page -- instead of an algorithm guessing
one exact page.

Superseded a per-issue single-page auto-detection heuristic (scored lines
that look like "44 Industry Tips" TOC entries) that turned out to only be
~50% reliable on spot-check even after two rounds of fixes: pages full of
small numbers in a similar density (department articles referencing page
footers, classified/price-heavy ad pages) kept out-scoring the real TOC
often enough that it wasn't trustworthy unattended. Every sample checked
across the whole run had its real TOC somewhere in pages 1-6 (0-indexed),
usually 2-5, so saving that whole range removes the guessing.

Usage:
    python3 scripts/scrape/save-threads-toc-page-range.py

Writes scratch/toc-images/threads/<handle>-p<N>.png for page indices 1-6
of every issue. Downloads each issue's PDF transiently (deleted after).
"""

import json
import os
import re
import time
import urllib.request

import fitz  # PyMuPDF

ITEM = "threads_magazine"
DOWNLOAD_BASE = f"https://archive.org/download/{ITEM}"

SCRATCH = os.path.join(os.path.dirname(__file__), "..", "..", "scratch")
TOC_TEXT_DIR = os.path.join(SCRATCH, "toc", "threads")
TOC_IMAGE_DIR = os.path.join(SCRATCH, "toc-images", "threads")
PDF_TMP_DIR = os.path.join(SCRATCH, "threads-pdf-tmp")

HEADERS = {"User-Agent": "Mozilla/5.0"}

PAGE_RANGE = range(1, 7)  # 0-indexed pages 1-6, i.e. printed pages ~2-7


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
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def parse_issue_number(handle):
    m = re.match(r"threads-(\d+)$", handle)
    return int(m.group(1)) if m else None


def main():
    os.makedirs(TOC_IMAGE_DIR, exist_ok=True)
    os.makedirs(PDF_TMP_DIR, exist_ok=True)

    txt_files = sorted(f for f in os.listdir(TOC_TEXT_DIR) if f.endswith(".txt"))
    print(f"Found {len(txt_files)} issues")

    meta = json.loads(fetch_url(f"https://archive.org/metadata/{ITEM}"))
    by_number = {}
    for f in meta["files"]:
        if f["name"].endswith(".pdf") and not f["name"].endswith("_text.pdf"):
            m = re.match(r"Threads Magazine (\d+) - ", f["name"])
            if m:
                by_number[int(m.group(1))] = f["name"]

    failed = []
    done = 0

    for txt_file in txt_files:
        handle = txt_file.replace(".txt", "")
        number = parse_issue_number(handle)

        expected_paths = [
            os.path.join(TOC_IMAGE_DIR, f"{handle}-p{p}.png") for p in PAGE_RANGE
        ]
        if all(os.path.exists(p) for p in expected_paths):
            done += 1
            continue

        pdf_name = by_number.get(number)
        if not pdf_name:
            failed.append((handle, "no matching PDF filename found"))
            continue

        try:
            pdf_url = f"{DOWNLOAD_BASE}/{pdf_name.replace(' ', '%20')}"
            pdf_tmp_path = os.path.join(PDF_TMP_DIR, f"{handle}.pdf")
            fetch_url(pdf_url, pdf_tmp_path)

            doc = fitz.open(pdf_tmp_path)
            for p in PAGE_RANGE:
                if p >= doc.page_count:
                    continue
                image_path = os.path.join(TOC_IMAGE_DIR, f"{handle}-p{p}.png")
                if os.path.exists(image_path):
                    continue
                pix = doc[p].get_pixmap(dpi=200)
                pix.save(image_path)
            doc.close()
            os.remove(pdf_tmp_path)

            print(f"  {handle}: saved pages {list(PAGE_RANGE)}")
            done += 1
            time.sleep(1)
        except Exception as err:
            print(f"  FAILED: {handle}: {err}")
            failed.append((handle, str(err)))

    if failed:
        path = os.path.join(SCRATCH, "threads-toc-page-range-failed.txt")
        with open(path, "w") as f:
            for handle, err in failed:
                f.write(f"{handle}: {err}\n")
        print(f"\n{len(failed)} failures logged to {path}")

    print(f"\nDone. {done}/{len(txt_files)} issues processed.")


if __name__ == "__main__":
    main()
