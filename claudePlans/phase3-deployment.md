# Phase 3 — Release 1 Deployment to Railway (PostgreSQL)

This document covers deploying BSWG-OpenLibry to Railway using PostgreSQL as the production
database. It supersedes the generic Phase 3 steps in `openlibry-dev-roadmap.md` and includes
all code changes required to migrate the schema from SQLite to PostgreSQL.

---

## Prerequisites

Before starting, confirm the following are complete:

- [ ] Phase 1 (Google SSO) is committed and working locally
- [ ] Phase 2 (Batch ISBN import) is committed
- [ ] You have a Railway account at [railway.app](https://railway.app)
- [ ] Your GitHub repo (`BSWG-OpenLibry`) is up to date on `main`
- [ ] You have access to Google Cloud Console to update the OAuth redirect URI
- [ ] PostgreSQL is available locally for development (see Step 1)

---

## Step 1 — Set up a local PostgreSQL database

Switching from SQLite to PostgreSQL means your local dev environment needs PostgreSQL too.
The simplest approach is Docker:

```bash
docker run -d \
  --name bswg-postgres \
  -e POSTGRES_DB=openlibry \
  -e POSTGRES_USER=openlibry \
  -e POSTGRES_PASSWORD=localdevpassword \
  -p 5432:5432 \
  postgres:16-alpine
```

Then update `DATABASE_URL` in your `.env.local`:

```
DATABASE_URL="postgresql://openlibry:localdevpassword@localhost:5432/openlibry"
```

> If you already have PostgreSQL installed locally, create a database named `openlibry`
> and set the connection string accordingly.

---

## Step 2 — Update the Prisma schema

Open [prisma/schema.prisma](../prisma/schema.prisma) and change the datasource provider
from `sqlite` to `postgresql`:

```prisma
datasource db {
  provider = "postgresql"
}
```

The connection URL is already supplied at runtime via `prisma.config.mjs` — no other
changes to the schema file are needed.

---

## Step 3 — Create a fresh PostgreSQL migration

If there are existing migrations in `prisma/migrations/` from the SQLite era, remove them:

```bash
rm -rf prisma/migrations
```

Then generate a new baseline migration against your local PostgreSQL database:

```bash
npx prisma migrate dev --name init
```

This creates `prisma/migrations/<timestamp>_init/migration.sql` with a PostgreSQL-compatible
schema. Commit this file — Railway uses it at startup via `prisma migrate deploy`.

Verify the app still starts correctly:

```bash
npm run dev
```

---

## Step 4 — Update the Docker entrypoint

The current [docker-entrypoint.sh](../docker-entrypoint.sh) checks for the existence of a
SQLite file (`/app/database/dev.db`) to decide whether to run `db push` or `migrate deploy`.
That logic does not apply to PostgreSQL. Replace the database initialisation block with a
simple unconditional migration:

```sh
#!/bin/sh
set -e

CUSTOM_DIR="/app/database/custom"
DEFAULTS_LABELS_DIR="/app/defaults/labels"
CUSTOM_LABELS_DIR="$CUSTOM_DIR/labels"

echo "=== OpenLibry entrypoint ==="
echo "DATABASE_URL: $DATABASE_URL"

# Run any pending migrations on every startup.
# For PostgreSQL this is safe and idempotent — already-applied migrations are skipped.
echo "Running database migrations..."
npx prisma migrate deploy

# Ensure the custom templates directory exists
if [ ! -d "$CUSTOM_DIR" ]; then
  echo "Creating custom directory at $CUSTOM_DIR ..."
  mkdir -p "$CUSTOM_DIR"
  echo "Place your guild-specific files here to override defaults." > "$CUSTOM_DIR/README.txt"
fi

# Seed default label sheets into the volume (existing files are never overwritten)
if [ -d "$DEFAULTS_LABELS_DIR" ]; then
  for subdir in sheets templates; do
    mkdir -p "$CUSTOM_LABELS_DIR/$subdir"
    for src in "$DEFAULTS_LABELS_DIR/$subdir"/*.json; do
      [ -f "$src" ] || continue
      dest="$CUSTOM_LABELS_DIR/$subdir/$(basename "$src")"
      if [ ! -f "$dest" ]; then
        cp "$src" "$dest"
        echo "Seeded label file: $dest"
      fi
    done
  done
else
  echo "Warning: defaults labels directory not found — skipping seed."
fi

echo "Custom files in $CUSTOM_DIR:"
ls -1R "$CUSTOM_DIR" 2>/dev/null || echo "(none)"

exec "$@"
```

---

## Step 5 — Update the Dockerfile

The runner stage in [Dockerfile](../Dockerfile) hard-codes a SQLite path as the default
`DATABASE_URL`. Remove that default — Railway will inject the real value via environment
variable, and the entrypoint no longer needs to create `/app/database`:

Remove these two lines from the `runner` stage:

```dockerfile
# Remove this line:
ENV DATABASE_URL="file:/app/database/dev.db"

# Remove this line (no SQLite file to store):
RUN mkdir -p /app/database && chown -R node:node /app
```

Replace with just the permissions line:

```dockerfile
RUN chown -R node:node /app
```

---

## Step 6 — Commit all changes

```bash
git add prisma/schema.prisma prisma/migrations docker-entrypoint.sh Dockerfile
git commit -m "Switch database provider from SQLite to PostgreSQL"
git push origin main
```

---

## Step 7 — Create the Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo** → choose `BSWG-OpenLibry`
3. Railway detects the `Dockerfile` automatically — no extra config needed

---

## Step 8 — Add the PostgreSQL database

1. In your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway provisions a managed PostgreSQL instance and sets `DATABASE_URL` automatically
   in the service's shared environment — you do not need to copy it manually

---

## Step 9 — Set environment variables in Railway

In your Railway service's **Variables** tab, add the following. These map directly from
your `.env.local` — copy the values from there:

```
GOOGLE_CLIENT_ID=<from .env.local>
GOOGLE_CLIENT_SECRET=<from .env.local>
NEXTAUTH_SECRET=<from .env.local>
NEXTAUTH_URL=https://<your-railway-app-url>
AUTH_ENABLED=true
SECURITY_HEADERS=secure
NODE_ENV=production

COVERIMAGE_FILESTORAGE_PATH=/app/images
OPENLIBRY_LOCALE=en
NEXT_PUBLIC_OPENLIBRY_LOCALE=en
LOGIN_SESSION_TIMEOUT=3600
MAX_MIGRATION_SIZE=250mb
DELETE_SAFETY_SECONDS=5
RENTAL_SORT_BOOKS=title_asc
BARCODE_MINCODELENGTH=3
ADMIN_BUTTON_SWITCH=1
GOOGLE_BOOKS_API_KEY=<from .env.local>

SCHOOL_NAME=<from .env.local>
LOGO_LABEL=<from .env.local>
EXTENSION_DURATION_DAYS=<from .env.local>
RENTAL_DURATION_DAYS=<from .env.local>
MAX_EXTENSIONS=<from .env.local>
NUMBER_BOOKS_OVERVIEW=<from .env.local>
NUMBER_BOOKS_MAX=<from .env.local>

RESEND_API_KEY=<from resend.com dashboard>
RESEND_FROM_EMAIL=noreply@weavebrazos.org
REMINDER_RESPONSIBLE_EMAIL=kali.blevins@weavebrazos.org
```

> `DATABASE_URL` is set automatically by Railway from the PostgreSQL service — do not
> add it manually.

> `AUTH_ENABLED` and `SECURITY_HEADERS` must be changed from their local dev values
> (`false`/`insecure`) to `true`/`secure` for production.

> `RESEND_API_KEY` and `RESEND_FROM_EMAIL` enable email notifications when a member
> submits a checkout request. The app functions without them (requests still queue in
> the database), but no notification email will be sent until both are set.
> `REMINDER_RESPONSIBLE_EMAIL` is the destination address — already set to
> `kali.blevins@weavebrazos.org`.

---

## Step 10 — Update the Google OAuth redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services →
   Credentials → your OAuth 2.0 Client
2. Under **Authorized redirect URIs**, add:
   ```
   https://<your-railway-app-url>/api/auth/callback/google
   ```
3. Save

---

## Step 11 — Deploy

Push to `main` if you haven't already — Railway builds and deploys on every push. Watch
the build log in the Railway dashboard. A successful deploy ends with the server listening
on port 3000.

On first startup, `docker-entrypoint.sh` runs `prisma migrate deploy`, which applies the
`init` migration and creates all tables in the Railway PostgreSQL instance.

---

## Step 12 — Load the book collection

With the app live, import the guild's book collection using the admin UI:

1. Navigate to `https://<your-railway-app-url>/admin/import`
2. Upload your ISBN file (`.txt`, `.csv`, or `.xlsx`)
3. Review the column detection and import preview
4. Click **Import** — cover images are fetched and attached automatically
5. Download `failed-isbns.txt` (if any) for manual follow-up

Alternatively, import via the CLI by temporarily pointing your local environment at the
Railway database:

```bash
# In .env.local, set DATABASE_URL to the Railway PostgreSQL connection string
# (available in Railway dashboard under the PostgreSQL service → Connect tab)
node scripts/import-books.mjs my-isbn-list.txt
# Restore DATABASE_URL to your local dev database afterward
```

---

## Post-deployment changes (completed after initial deploy)

### Google SSO — open to any Gmail + email allowlist

The OAuth consent screen was changed from **Internal** to **External** in Google Cloud
Console so any Gmail address can authenticate. To prevent unwanted access, a `signIn`
callback was added to `pages/api/auth/[...nextauth].ts` that checks the signing-in
email against the `LoginUser` table (`active = true`). Only pre-approved emails are
admitted.

A management UI was built at `/admin/loginusers` (linked from the admin dashboard) that
lets you add Gmail addresses, toggle active/inactive, change roles, and delete entries
without touching the database directly.

### Self-service catalog requests

Members can browse `/catalog` without logging in and request available books after
signing in with their Google account (role = `user`). Admins do not see request buttons
— they process checkouts directly via `/rental`.

**How it works:**

1. A member clicks **Request checkout** on a catalog card → a `CheckoutRequest` row is
   created in the database and an email notification is sent to `REMINDER_RESPONSIBLE_EMAIL`
   via Resend.
2. The librarian sees a pending-count badge on the admin dashboard → clicks through to
   `/admin/requests` → approves or denies the request.
3. Approved requests are handled physically — the librarian locates the book and
   processes the actual checkout through the existing `/rental` desk.

**Files added:**

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | `CheckoutRequest` model |
| `prisma/migrations/…_add_checkout_requests/` | Migration applied to production on next deploy |
| `entities/checkoutrequest.ts` | CRUD helpers |
| `lib/email/sendRequestEmail.ts` | Resend notification |
| `pages/api/requests/index.ts` | POST (member) + GET (admin) |
| `pages/api/requests/[id].ts` | PATCH status + DELETE (admin) |
| `pages/api/requests/count.ts` | Pending count for admin badge |
| `pages/admin/requests.tsx` | Librarian queue page |
| `types/next-auth.d.ts` | Extends Session type with `role` |

**Role enforcement (partial):**

The `jwt` and `session` NextAuth callbacks now read `role` from `LoginUser` and
surface it in `session.user.role`. The requests API uses this to enforce access.
Full admin-page guarding (redirecting `role = user` away from `/admin`, `/rental`,
`/book`, etc.) is still a future task — see below.

**Resend sender setup:**

DNS records for `weavebrazos.org` have been added to Resend for domain verification.
Once propagated, `RESEND_FROM_EMAIL=noreply@weavebrazos.org` becomes a valid sender
without requiring a real mailbox.

### Locale baked into Docker build

`NEXT_PUBLIC_OPENLIBRY_LOCALE` is a Next.js build-time variable — it is inlined into the
client bundle during `next build` and cannot be overridden by Railway runtime environment
variables. The Dockerfile `builder` stage now sets it via a Docker `ARG` that defaults to
`en`:

```dockerfile
ARG NEXT_PUBLIC_OPENLIBRY_LOCALE=en
ENV NEXT_PUBLIC_OPENLIBRY_LOCALE=${NEXT_PUBLIC_OPENLIBRY_LOCALE}
```

If a future deployment needs a different locale, set the Railway **Build Variable**
`NEXT_PUBLIC_OPENLIBRY_LOCALE=de` (or `es`). Runtime env vars for this key have no effect.

---

## Release 1 Production Checklist

- [x] Login page loads in English
- [x] Google SSO open to any Gmail account
- [x] Email allowlist enforced via `LoginUser` table and `signIn` callback
- [x] `/admin/loginusers` page available for managing allowed accounts
- [x] `role` field surfaced in NextAuth session (`jwt` + `session` callbacks)
- [x] Self-service catalog request feature deployed (`/catalog`, `/admin/requests`)
- [x] Resend DNS records added for `weavebrazos.org` (awaiting propagation)
- [ ] Your Gmail address added to `LoginUser` (role = `admin`) before first login
- [ ] `RESEND_API_KEY` set in Railway variables
- [ ] `RESEND_FROM_EMAIL=noreply@weavebrazos.org` set in Railway variables (after DNS propagates)
- [ ] Test a checkout request from a non-admin account end-to-end
- [ ] Team members can log in successfully
- [ ] Full book catalog is visible and searchable at `/catalog` without login
- [ ] Staff can check items in and out via `/rental`
- [ ] HTTPS is active (automatic on Railway)
- [ ] Automated database backups are enabled (Railway default — verify in dashboard)
- [ ] `AUTH_ENABLED=true` is confirmed in Railway variables
- [ ] `SECURITY_HEADERS=secure` is confirmed in Railway variables

---

## Future tasks

### Role-based access control (partially implemented)

Steps 1 and 2 below are **done**. Steps 3 and 4 are still pending — all authenticated
users can currently reach `/admin`, `/rental`, `/book`, and `/user` regardless of role.

~~1. Expose the role in the NextAuth JWT~~ ✅ Done — `jwt` and `session` callbacks in
`pages/api/auth/[...nextauth].ts` read `role` from `LoginUser` and surface it as
`session.user.role`.

~~2. Extend the NextAuth session type in `types/next-auth.d.ts`~~ ✅ Done.

3. **Guard admin pages in `getServerSideProps`** (still needed):

```ts
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";

// In getServerSideProps of each admin/staff page:
const session = await getServerSession(context.req, context.res, authOptions);
if (session?.user?.role !== "admin") {
  return { redirect: { destination: "/catalog", permanent: false } };
}
```

Pages that need this guard: `/admin/*`, `/rental`, `/book`, `/user`, `/reports`.

4. **Guard admin API routes** (still needed) — add the same session check to any
   API route a `role = user` member should not reach. The `/api/requests/*` routes
   already enforce this pattern and can serve as a reference.

---

## Ongoing maintenance notes

- **Adding users**: navigate to `/admin/loginusers` to add or disable Gmail addresses.
  Set `role` to `admin` for staff (librarians) and `user` for members who only need
  catalog access and self-service checkout requests.
- **Checkout requests**: navigate to `/admin/requests` to approve or deny pending
  member requests. Approving a request is an acknowledgement only — the librarian
  still processes the physical handoff through `/rental`.
- **Email notifications**: checkout request emails are sent to `REMINDER_RESPONSIBLE_EMAIL`
  via Resend. If no email arrives, check that `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
  are set in Railway and that the Resend domain for `weavebrazos.org` is verified.
- **Database backups**: Railway backs up PostgreSQL daily by default. Verify the retention
  window in the PostgreSQL service settings and test a restore before going live.
- **Local dev**: Keep your local PostgreSQL Docker container running when developing.
  `docker start bswg-postgres` if it has stopped.
- **Schema changes**: Any future Prisma schema changes require a new migration
  (`npx prisma migrate dev --name <description>`) committed to `main` before deploying.
  Railway applies pending migrations automatically on the next deploy via the entrypoint.
