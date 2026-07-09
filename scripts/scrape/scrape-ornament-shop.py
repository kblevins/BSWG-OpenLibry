#!/usr/bin/env python3
"""
Scrape Ornament Magazine's back-issue shop (Squarespace commerce) for cover
images and TOC text.

Squarespace product listing pages expose a `?format=json` endpoint with
structured data per product -- no HTML scraping needed. Each item includes
`assetUrl` (a direct CDN cover-image URL) and `excerpt` (real HTML text
listing Features/Departments -- effectively the issue's table of contents,
not just a marketing blurb). Confirmed complete via `pageSize: 999` vs.
131 items returned (fewer than pageSize means no further pages exist).

Usage:
    python3 scripts/scrape/scrape-ornament-shop.py

Downloads covers to scratch/covers/ornament/<urlId>.jpg, TOC text (HTML
tags stripped) to scratch/toc/ornament/<urlId>.txt, and appends rows to
scratch/manifest.csv.
"""

import csv
import os
import re
import time
import urllib.request
import json

LISTING_URL = "https://www.ornamentmagazine.org/shop/back-issue?format=json"

SCRATCH = os.path.join(os.path.dirname(__file__), "..", "..", "scratch")
COVER_DIR = os.path.join(SCRATCH, "covers", "ornament")
TOC_DIR = os.path.join(SCRATCH, "toc", "ornament")
MANIFEST_PATH = os.path.join(SCRATCH, "manifest.csv")

HEADERS = {"User-Agent": "Mozilla/5.0"}


def fetch_url(url, dest_path=None, attempts=3):
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
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


def html_to_text(html):
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&nbsp;", " ")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


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
            ["ornament", handle, title, source_url, local_image_path]
        )


def main():
    os.makedirs(COVER_DIR, exist_ok=True)
    os.makedirs(TOC_DIR, exist_ok=True)
    ensure_manifest_header()

    print(f"Fetching {LISTING_URL} ...")
    raw = fetch_url(LISTING_URL)
    data = json.loads(raw)
    items = data["items"]
    page_size = data["collection"].get("pageSize")
    print(f"Found {len(items)} items (pageSize={page_size} -- "
          f"{'complete, no pagination needed' if len(items) < page_size else 'MAY BE TRUNCATED, check pagination'})")

    failed = []
    success = 0
    for item in items:
        handle = item["urlId"]
        title = item["title"]
        source_url = f"https://www.ornamentmagazine.org{item['fullUrl']}"
        # The product record's top-level assetUrl is unreliable -- for
        # items where no "main" image was explicitly set in Squarespace,
        # it points at a generic placeholder graphic (a diagonal-line
        # "no image" icon, always exactly 2102 bytes) on static1.squarespace.com
        # instead of the real cover. The real image is always the first
        # entry of the product's attached media list, items[0].assetUrl,
        # which matches the top-level assetUrl when that IS set correctly
        # -- so prefer items[0] unconditionally rather than trying to
        # detect the placeholder by size/content.
        nested_items = item.get("items") or []
        asset_url = nested_items[0]["assetUrl"] if nested_items else item.get("assetUrl")
        excerpt = item.get("excerpt", "")

        try:
            cover_path = ""
            if asset_url:
                ext = os.path.splitext(asset_url.split("?")[0])[1] or ".jpg"
                cover_path = os.path.join(COVER_DIR, f"{handle}{ext}")
                if not os.path.exists(cover_path):
                    fetch_url(asset_url, cover_path)

            toc_text = html_to_text(excerpt)
            toc_path = os.path.join(TOC_DIR, f"{handle}.txt")
            if toc_text:
                with open(toc_path, "w") as f:
                    f.write(toc_text)
            else:
                toc_path = ""

            if cover_path:
                append_manifest_row(handle, title, source_url, cover_path)

            print(f"  ✓ {title}")
            success += 1
            time.sleep(0.5)
        except Exception as err:
            print(f"  ✗ {handle}: {err}")
            failed.append((handle, str(err)))

    if failed:
        failed_path = os.path.join(SCRATCH, "ornament-failed.txt")
        with open(failed_path, "w") as f:
            for handle, err in failed:
                f.write(f"{handle}: {err}\n")
        print(f"\n{len(failed)} failures logged to {failed_path}")

    print(f"\nDone. {success}/{len(items)} items processed.")


if __name__ == "__main__":
    main()
