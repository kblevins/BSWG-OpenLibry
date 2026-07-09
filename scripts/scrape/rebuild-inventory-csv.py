#!/usr/bin/env python3
"""
One-off recovery script: rebuild scratch/magazine-scrape-inventory.csv for
Ply, PieceWork, Spin-Off, and Handwoven after an earlier buggy dedup pass
accidentally collapsed each of those four series down to a single row
(dedup was keyed on series+title, but those series share one generic
literal title value per series -- the real per-issue identity lives in
other columns). The underlying cover images and TOC text files on disk
were never touched, so this reconstructs the CSV from them plus the
per-issue JSON summaries a prior session already produced.

Run once; not meant to be part of the regular scraping pipeline.
"""

import csv
import json
import os
import re

SCRATCH = os.path.join(os.path.dirname(__file__), "..", "..", "scratch")
INVENTORY_PATH = os.path.join(SCRATCH, "magazine-scrape-inventory.csv")


def write_rows(rows):
    with open(INVENTORY_PATH, "a", newline="") as f:
        w = csv.writer(f)
        for r in rows:
            w.writerow(r)


def rebuild_ply():
    per_issue = json.load(open(os.path.join(SCRATCH, "toc", "ply-per-issue.json")))
    by_number = {i["issueNumber"]: i for i in per_issue if i["issueNumber"]}

    cover_dir = os.path.join(SCRATCH, "covers", "ply")
    rows = []
    matched, unmatched_covers = 0, []
    for fname in sorted(os.listdir(cover_dir)):
        # Two eras: "...-issue-<n>-..." (older) and "ply-<n>-..." (newer, #51+)
        m = re.search(r"issue-(\d+)-", fname) or re.search(r"ply-(\d+)-", fname)
        if not m:
            unmatched_covers.append(fname)
            continue
        num = m.group(1)
        cover_path = os.path.join(cover_dir, fname)
        issue = by_number.get(num)
        if issue:
            toc_dir = os.path.join(SCRATCH, "toc", "ply")
            toc_path = os.path.join(toc_dir, f"issue-{int(num):02d}.txt")
            if not os.path.exists(toc_path):
                toc_path = ""
            title = f"PLY Magazine #{num} - {issue.get('issueTopic', '')} ({issue.get('issueDate', '')})"
            rows.append(["Ply", title, num, "", issue.get("issueDate", "").split()[-1] if issue.get("issueDate") else "",
                         cover_path, toc_path, "rebuilt from ply-per-issue.json + covers/ply/"])
            matched += 1
        else:
            unmatched_covers.append(fname)

    write_rows(rows)
    print(f"Ply: {matched} rows written, {len(unmatched_covers)} covers unmatched: {unmatched_covers}")


MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]
SEASONS = ["spring", "summer", "fall", "winter"]


def rebuild_piecework():
    summary = json.load(open(os.path.join(SCRATCH, "toc", "piecework-issue-summary.json")))
    by_key = {i["issueKey"]: i for i in summary}

    cover_dir = os.path.join(SCRATCH, "covers", "piecework")
    rows = []
    matched = 0
    unmatched_covers = []
    used_keys = set()

    for fname in sorted(os.listdir(cover_dir)):
        base = re.sub(r"\.\w+$", "", fname)
        base = base.replace("piecework-", "", 1)
        # e.g. "april-1-2021-digital" / "september-2011-digital" / "september-30-2022-digital"
        m = re.match(r"([a-z]+)(?:-\d+)?-(\d{4})(?:-digital)?", base)
        if not m:
            unmatched_covers.append(fname)
            continue
        month, year = m.group(1), m.group(2)

        candidates = []
        if month in MONTHS:
            idx = MONTHS.index(month)
            # bimonthly issue containing this month, e.g. April -> March/April
            pair_start = idx if idx % 2 == 0 else idx - 1
            pair = f"{MONTHS[pair_start]}-{MONTHS[pair_start+1]}"
            candidates.append(f"{year}-{pair}")
            # seasonal issue this month falls in (quarterly era)
            season_map = {2: "spring", 3: "spring", 4: "spring", 5: "summer",
                          6: "summer", 7: "summer", 8: "fall", 9: "fall",
                          10: "fall", 11: "winter", 0: "winter", 1: "winter"}
            candidates.append(f"{year}-{season_map[idx]}")

        matched_key = next((k for k in candidates if k in by_key), None)
        cover_path = os.path.join(cover_dir, fname)
        if matched_key:
            toc_path = by_key[matched_key]["path"]
            title = f"PieceWork {by_key[matched_key]['issueLabel']}"
            rows.append(["PieceWork", title, "", "", year, cover_path, toc_path,
                         "rebuilt from piecework-issue-summary.json + covers/piecework/"])
            matched += 1
            used_keys.add(matched_key)
        else:
            title = f"PieceWork {month.title()} {year}"
            rows.append(["PieceWork", title, "", "", year, cover_path, "",
                         "rebuilt, no confident TOC match found"])
            unmatched_covers.append(fname)

    # TOC issues with no matched cover
    toc_only = 0
    for key, issue in by_key.items():
        if key not in used_keys:
            rows.append(["PieceWork", f"PieceWork {issue['issueLabel']}", "", "", key[:4],
                         "", issue["path"], "rebuilt, no confident cover match found"])
            toc_only += 1

    write_rows(rows)
    print(f"PieceWork: {matched} matched, {len(unmatched_covers)} cover-only/unmatched, {toc_only} toc-only")


def rebuild_handwoven():
    summary = json.load(open(os.path.join(SCRATCH, "toc", "handwoven-issue-summary.json")))
    by_key = {i["issueKey"]: i for i in summary}

    cover_dir = os.path.join(SCRATCH, "covers", "handwoven")
    rows = []
    matched = 0
    unmatched_covers = []
    used_keys = set()

    for fname in sorted(os.listdir(cover_dir)):
        base = re.sub(r"\.\w+$", "", fname)
        m = re.match(r"\d{4}-\d+-handwoven-(?P<desc>[a-z-]+)-(?P<year>\d{4})$", base)
        cover_path = os.path.join(cover_dir, fname)
        if not m:
            unmatched_covers.append(fname)
            rows.append(["Handwoven", fname, "", "", "", cover_path, "",
                         "rebuilt, filename didn't match expected pattern"])
            continue
        desc, year = m.group("desc"), m.group("year")
        key = f"{year}-{desc}"
        if key in by_key:
            toc_path = by_key[key]["path"]
            title = f"Handwoven {by_key[key]['issueLabel']}"
            rows.append(["Handwoven", title, "", "", year, cover_path, toc_path,
                         "rebuilt from handwoven-issue-summary.json + covers/handwoven/"])
            matched += 1
            used_keys.add(key)
        else:
            title = f"Handwoven {desc.replace('-', '/').title()} {year}"
            rows.append(["Handwoven", title, "", "", year, cover_path, "",
                         "rebuilt, no confident TOC match found (likely pre-index or combined season issue)"])
            unmatched_covers.append(fname)

    toc_only = 0
    for key, issue in by_key.items():
        if key not in used_keys:
            rows.append(["Handwoven", f"Handwoven {issue['issueLabel']}", "", "", key[:4],
                         "", issue["path"], "rebuilt, no confident cover match found"])
            toc_only += 1

    write_rows(rows)
    print(f"Handwoven: {matched} matched, {len(unmatched_covers)} cover-only/unmatched, {toc_only} toc-only")


def rebuild_spinoff():
    summary = json.load(open(os.path.join(SCRATCH, "toc", "spinoff-issue-summary.json")))
    by_key = {i["issueKey"]: i for i in summary}

    cover_dir = os.path.join(SCRATCH, "covers", "spinoff")
    rows = []
    matched = 0
    unmatched_covers = []
    used_keys = set()

    for fname in sorted(os.listdir(cover_dir)):
        base = re.sub(r"\.\w+$", "", fname)
        cover_path = os.path.join(cover_dir, fname)
        m = re.search(r"spin-off-(?P<season>spring|summer|fall|winter)-(?P<year>\d{4})", base)
        if m:
            season, year = m.group("season"), m.group("year")
            key = f"{year}-{season}"
            if key in by_key:
                toc_path = by_key[key]["path"]
                title = f"Spin-Off {by_key[key]['issueLabel']}"
                rows.append(["Spin-Off", title, "", "", year, cover_path, toc_path,
                             "rebuilt from spinoff-issue-summary.json + covers/spinoff/"])
                matched += 1
                used_keys.add(key)
                continue
        # Bundled "Collection Download" covers (decade/year bundles) or unmatched:
        # keep as their own row, not paired to a single issue's TOC
        year_m = re.search(r"(\d{4})", base)
        year = year_m.group(1) if year_m else ""
        rows.append(["Spin-Off", f"Spin-Off {fname}", "", "", year, cover_path, "",
                     "rebuilt, bundle/collection cover or no confident single-issue TOC match"])
        unmatched_covers.append(fname)

    toc_only = 0
    for key, issue in by_key.items():
        if key not in used_keys:
            rows.append(["Spin-Off", f"Spin-Off {issue['issueLabel']}", "", "", key[:4],
                         "", issue["path"], "rebuilt, no confident cover match found"])
            toc_only += 1

    write_rows(rows)
    print(f"Spin-Off: {matched} matched, {len(unmatched_covers)} cover-only/bundle, {toc_only} toc-only")


if __name__ == "__main__":
    rebuild_ply()
    rebuild_piecework()
    rebuild_handwoven()
    rebuild_spinoff()
