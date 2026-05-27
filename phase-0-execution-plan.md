# Phase 0 Execution Plan — Environment Setup

**Release:** 1 | **Estimated effort:** 0.5 days
**Deliverable:** Working local development instance of stock OpenLibry

---

## Status Check

Prerequisites are already satisfied on this machine:

| Prerequisite | Required | Installed |
|---|---|---|
| Node.js | v18+ | v24.10.0 ✓ |
| Git | any | 2.37.0 ✓ |
| Docker Desktop | any | 29.1.5 ✓ |

---

## Step 1 — Fork OpenLibry to the BSWG GitHub Organization

> **Who:** GitHub account with admin access to the BSWG org
> **Time:** ~5 minutes

1. Go to the upstream OpenLibry repository on GitHub (search "OpenLibry" or ask for the URL from the project lead).
2. Click **Fork** → select the **BSWG org** as the destination.
3. Name the fork `openlibry` (keep the default name).

**Result:** `https://github.com/BSWG-ORG/openlibry` exists and is owned by the org.

---

## Step 2 — Pull the OpenLibry Codebase into This Repo

> **Who:** Developer with write access to BSWG-OpenLibry
> **Time:** ~5 minutes

This repo (`BSWG-OpenLibry`) will be the working development repo. Pull the forked OpenLibry code into it.

```bash
# From the root of this repo (BSWG-OpenLibry/)

# Add the fork as a remote
git remote add openlibry https://github.com/BSWG-ORG/openlibry.git

# Fetch the fork's history
git fetch openlibry

# Merge the fork's main branch, allowing unrelated histories
git merge openlibry/main --allow-unrelated-histories
```

If there are merge conflicts on README.md, keep the BSWG-OpenLibry version.

**Result:** This repo now contains the full OpenLibry codebase alongside the BSWG roadmap files.

---

## Step 3 — Install Dependencies

```bash
npm install
```

Expected: packages install without errors. If you see peer dependency warnings, they are safe to ignore unless `npm install` exits with a non-zero code.

**Result:** `node_modules/` directory is populated.

---

## Step 4 — Configure the Environment File

1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and fill in the minimum values needed to run locally:

   ```env
   # Required to start the dev server
   NEXTAUTH_SECRET=any_random_string_for_local_dev
   NEXTAUTH_URL=http://localhost:3000

   # Leave these blank for now — Google OAuth is configured in Phase 1
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=

   # DATABASE_URL defaults to SQLite for local dev — no changes needed here
   # (Verify this is the case in .env.example; if DATABASE_URL is missing, add:)
   # DATABASE_URL="file:./dev.db"
   ```

3. Verify `.env.local` is in `.gitignore` before committing anything — it must never be committed.

**Result:** `.env.local` exists and the dev server can start without crashing.

---

## Step 5 — Initialize the Database

Prisma needs to create the local SQLite database before the app can run:

```bash
npx prisma migrate dev
```

If prompted for a migration name, enter `initial`.

**Result:** A `prisma/dev.db` SQLite file is created and the schema is applied.

---

## Step 6 — Start the Dev Server and Verify

```bash
npm run dev
```

Open `http://localhost:3000` in a browser.

**Expected:** The OpenLibry home page loads. A login prompt or catalog view appears (no crash, no blank page).

If the server fails to start:
- Check the terminal output for the specific error
- Common issues: missing `.env.local` values, Prisma not migrated, port 3000 already in use (`lsof -i :3000` to check)

---

## Step 7 — Codebase Orientation

Spend 15–20 minutes getting familiar with the structure before Phase 1 begins. Key locations:

| Path | What it is |
|---|---|
| `prisma/schema.prisma` | Database schema — all models (Book, User, Rental, etc.) |
| `pages/api/` | All backend API routes (REST endpoints) |
| `pages/api/auth/` | NextAuth config — this is where Google SSO goes in Phase 1 |
| `pages/` | All front-end pages (each `.js`/`.tsx` file = a route) |
| `components/` | Reusable React components |
| `.env.local` | Local secrets — never commit this |
| `scripts/` | Where the Phase 2 ISBN import script will live |

**Questions to answer during orientation:**
- What does the existing login page look like? (`pages/auth/signin.js` or similar)
- What fields does the `Book` model have? (open `prisma/schema.prisma`)
- Is there already a `Rental` model, or is it named something else?
- Are there any existing API routes for books/rentals? (scan `pages/api/`)

Document your findings in a short note — this context will matter in Phase 1 and Phase 2.

---

## Completion Checklist

- [ ] OpenLibry fork exists under the BSWG GitHub org
- [ ] OpenLibry codebase is merged into this repo (`BSWG-OpenLibry`)
- [ ] `npm install` completes without errors
- [ ] `.env.local` is configured and is NOT committed to git
- [ ] `npx prisma migrate dev` completes without errors
- [ ] `npm run dev` starts and `http://localhost:3000` loads in a browser
- [ ] Codebase orientation complete — key directories understood

---

## What Comes Next

Once this checklist is complete, move directly to **Phase 1 — Google SSO**. The Phase 1 work requires:
- Access to Google Cloud Console
- The organization's Google Workspace admin (to mark the app as internal)

Line those up before finishing Phase 0 so there's no waiting time between phases.
