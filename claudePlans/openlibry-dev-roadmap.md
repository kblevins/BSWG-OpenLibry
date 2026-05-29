# OpenLibry Custom Development Roadmap

## Overview

This roadmap covers all development work required to extend OpenLibry into a full-featured library and equipment management system for your organization. Work is organized into two releases: a lean **Release 1** that gets a working system in front of your team quickly, and a full-featured **Release 2** that completes the remaining functionality.

OpenLibry is built on **Next.js**, uses **Prisma ORM** with a **SQLite or PostgreSQL** database, and uses **NextAuth.js** for authentication — a modern, well-documented stack with strong community support.

---

## Tech Stack Reference

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (React) | Pages + API routes in one project |
| Database ORM | Prisma | Schema-first, type-safe queries |
| Database | SQLite (dev) / PostgreSQL (prod) | Easy to swap between the two |
| Authentication | NextAuth.js | Google OAuth built in |
| Email | Resend or SendGrid | Free tiers sufficient (Release 2) |
| Hosting | Railway.app | Docker-based, ~$0–5/month |
| ISBN Lookup | Open Library API | Free, no API key required |

---

---

# RELEASE 1 — Working System for Your Team
### Goal: Google login + full collection loaded + deployed for team access
### Estimated total effort: 3–4.5 days

Release 1 gives your team something real to use: they can log in with their Google accounts, browse the full catalog, and check items in and out. The goal is to validate the tool with real users before investing in the more complex features of Release 2.

---

## Phase 0 — Environment Setup
**Estimated effort: 0.5 days**

Before writing any code, get the development environment running locally.

### Tasks
1. Install prerequisites: Node.js (v18+), Git, Docker Desktop
2. Fork the OpenLibry repository on GitHub to your organization's account
3. Clone your fork locally: `git clone https://github.com/YOUR_ORG/openlibry`
4. Install dependencies: `npm install`
5. Copy `.env.example` to `.env.local` and fill in required values
6. Run the dev server: `npm run dev` — verify it loads at `http://localhost:3000`
7. Explore the existing codebase: note the `/pages/api/` routes, `/prisma/schema.prisma`, and `/components/` directories

### Deliverable
Working local development instance of stock OpenLibry.

---

## Phase 1 — Google SSO
**Estimated effort: 1–2 days**

This is the highest-priority feature and the easiest to implement. NextAuth.js has Google OAuth as a first-class supported provider.

### Prerequisites
- A Google account with access to Google Cloud Console
- Your organization's Google Workspace admin access (to mark the app as internal)

### Tasks

**1. Create Google OAuth credentials**
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create a new project: "Library System"
- Navigate to APIs & Services → Credentials → Create OAuth Client ID
- Application type: Web application
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google` (dev)
  - `https://yourdomain.com/api/auth/callback/google` (prod — add this now, you'll need it in Phase 3)
- Copy the Client ID and Client Secret

**2. Configure NextAuth**

In `/pages/api/auth/[...nextauth].js` (or `.ts`), add the Google provider:

```javascript
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  // Optional: restrict sign-in to your organization's domain
  callbacks: {
    async signIn({ account, profile }) {
      if (account.provider === "google") {
        return profile.email_verified &&
               profile.email.endsWith("@yourdomain.com");
      }
      return true;
    },
  },
});
```

**3. Add environment variables**

In `.env.local`:
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
NEXTAUTH_SECRET=a_random_secret_string
NEXTAUTH_URL=http://localhost:3000
```

**4. Update the login UI**

Find the sign-in page (likely `/pages/auth/signin.js`) and add or replace the login button with a Google sign-in button. NextAuth handles the redirect automatically.

**5. Optional: hide the local login form**

If you want Google to be the only login method, remove or hide the email/password form from the sign-in page.

### Deliverable
Users can sign in with their Google Workspace accounts. No separate library password needed.

---

## Phase 2 — Batch ISBN Import
**Estimated effort: 1–2 days**

Allow staff to import the full collection at once from a file of ISBNs collected by barcode scanner, rather than entering books one by one.

### Offline ISBN Collection (before running the import)

Collect your ISBNs offline using any of these methods:
- **Barcode scanner app**: Use an app like Barcode to Sheet (Android) or Swipe (iOS) that saves scanned ISBNs to a CSV or text file
- **Bluetooth scanner + phone**: Pair a $30 Bluetooth scanner with your phone's notes app — each scan outputs the ISBN as a line of text
- **Result**: A plain `.txt` file with one ISBN per line

### Create the Import Script

Create `/scripts/import-books.mjs`:

```javascript
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function fetchBookData(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url);
  const data = await res.json();
  const key = `ISBN:${isbn}`;
  if (!data[key]) return null;

  const book = data[key];
  return {
    title: book.title || "Unknown Title",
    author: book.authors?.[0]?.name || "Unknown Author",
    isbn: isbn,
    publisher: book.publishers?.[0]?.name || null,
    publishYear: book.publish_date ? parseInt(book.publish_date) : null,
    coverImageUrl: book.cover?.medium || null,
  };
}

async function importFromFile(filePath) {
  const isbns = fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  console.log(`Importing ${isbns.length} ISBNs...`);

  let success = 0, failed = [];

  for (const isbn of isbns) {
    const bookData = await fetchBookData(isbn);
    if (bookData) {
      await prisma.book.create({ data: bookData });
      success++;
      console.log(`✓ ${bookData.title}`);
    } else {
      failed.push(isbn);
      console.log(`✗ ISBN not found: ${isbn}`);
    }
    // Rate limit: be polite to the Open Library API
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone: ${success} imported, ${failed.length} failed`);
  if (failed.length) {
    fs.writeFileSync("failed-isbns.txt", failed.join("\n"));
    console.log("Failed ISBNs saved to failed-isbns.txt — add these manually");
  }
}

importFromFile(process.argv[2]);
```

**Usage:**
```bash
node scripts/import-books.mjs my-isbn-list.txt
```

> **Coverage note**: The Open Library API covers ~90–95% of mainstream published books. A `failed-isbns.txt` file will be created for any that aren't found — add those manually through the OpenLibry UI.

### Optional: Admin UI for Import

If non-technical staff will be running imports, add a simple admin page at `/pages/admin/import.js` with a file upload field that accepts a `.txt` file of ISBNs and calls the import logic via an API route. This avoids needing command-line access.

### Deliverable
The full book collection is loaded into the system. Staff can browse, search, and check items in and out.

---

## Phase 3 — Release 1 Deployment
**Estimated effort: 0.5–1 day**

Deploy to Railway so your team can access the system from any browser.

### Steps

**1. Prepare for production**
```bash
# Generate a strong NEXTAUTH_SECRET
openssl rand -base64 32
```

**2. Set up Railway**
- Create an account at [railway.app](https://railway.app)
- Create a new project and connect your GitHub repository
- Add a PostgreSQL database service to the project
- Copy the `DATABASE_URL` from Railway's PostgreSQL service into your environment variables

**3. Set environment variables in Railway's dashboard**
```
DATABASE_URL=<from Railway PostgreSQL service>
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=<generated above>
NEXTAUTH_URL=https://<your-railway-app-url>
NODE_ENV=production
```

**4. Update Google OAuth redirect URI**
- Return to Google Cloud Console → APIs & Services → Credentials
- Add your Railway production URL to Authorized redirect URIs:
  `https://<your-railway-app-url>/api/auth/callback/google`

**5. Deploy**
- Push your code to the `main` branch on GitHub
- Railway automatically builds and deploys on every push

**6. Run the ISBN import against production**
- Update `DATABASE_URL` in your local `.env.local` to point to the Railway PostgreSQL instance temporarily
- Run `node scripts/import-books.mjs my-isbn-list.txt`
- Restore `DATABASE_URL` to your local dev database afterward

### Release 1 Production Checklist
- [ ] Team members can log in with Google Workspace accounts
- [ ] Full book catalog is visible and searchable
- [ ] Staff can check items in and out
- [ ] HTTPS is active (automatic on Railway)
- [ ] Automated database backups are enabled (Railway default)

### Deliverable
A live, accessible system your team can evaluate with real data. Share the Railway URL and collect feedback before starting Release 2.

---

---

# RELEASE 2 — Full Feature Completion
### Goal: Equipment tracking, patron reservations, automated notifications, fee tracking
### Estimated total effort: 7–12 days

Release 2 adds all remaining features identified in your requirements. These are built on top of the deployed Release 1 system — your team continues using the live system throughout development, and Release 2 features are deployed incrementally as they're completed.

---

## Phase 4 — Equipment Item Type
**Estimated effort: 1–2 days**

Extend the data model to distinguish books from equipment, and adjust the UI accordingly.

### Database Changes

In `prisma/schema.prisma`, add an `itemType` field to the existing `Book` model:

```prisma
model Book {
  id              Int      @id @default(autoincrement())
  title           String
  author          String?
  isbn            String?
  itemType        ItemType @default(BOOK)
  rentalFee       Float?   // null = free lending
  feeDescription  String?  // e.g. "$5/day for AV equipment"
  // ... existing fields
}

enum ItemType {
  BOOK
  EQUIPMENT
}
```

After editing the schema, run:
```bash
npx prisma migrate dev --name add_equipment_type
npx prisma generate
```

### UI Changes

1. **Add item form**: Add an "Item Type" dropdown (Book / Equipment). When Equipment is selected, show a rental fee field and hide ISBN-related fields.
2. **Catalog display**: Add a filter or tab to browse Books separately from Equipment.
3. **Staff item view**: Show a "Rental fee" badge on equipment items so staff can reference it during checkout.

### Deliverable
System supports both books and equipment as distinct item types, with optional fee information on equipment.

---

## Phase 5 — Patron Reservations/Holds
**Estimated effort: 3–5 days**

Allow patrons to reserve an item that is currently checked out, and automatically notify them when it becomes available.

### Database Changes

Add a `Reservation` model to `prisma/schema.prisma`:

```prisma
model Reservation {
  id          Int               @id @default(autoincrement())
  createdAt   DateTime          @default(now())
  status      ReservationStatus @default(PENDING)
  userId      Int
  bookId      Int
  user        User              @relation(fields: [userId], references: [id])
  book        Book              @relation(fields: [bookId], references: [id])
}

enum ReservationStatus {
  PENDING      // waiting for item to be returned
  NOTIFIED     // patron has been told it's available
  FULFILLED    // patron checked it out
  CANCELLED
}
```

Run migration: `npx prisma migrate dev --name add_reservations`

### API Routes to Create

Create the following files in `/pages/api/reservations/`:

- `POST /api/reservations` — create a reservation for an item
- `GET /api/reservations` — list all reservations (staff view)
- `GET /api/reservations/user/[id]` — list a patron's reservations
- `PATCH /api/reservations/[id]` — update status (staff: mark fulfilled/cancelled)
- `DELETE /api/reservations/[id]` — cancel a reservation

### Logic: Trigger Notification on Return

In the existing check-in API route (wherever an item is marked as returned), add logic after the return is processed:

```javascript
// After marking item as returned:
const nextReservation = await prisma.reservation.findFirst({
  where: { bookId: itemId, status: "PENDING" },
  orderBy: { createdAt: "asc" },
});

if (nextReservation) {
  await sendAvailabilityNotification(nextReservation);
  await prisma.reservation.update({
    where: { id: nextReservation.id },
    data: { status: "NOTIFIED" },
  });
}
```

### UI Changes

1. **Item detail page**: Add a "Reserve this item" button if the item is currently checked out.
2. **Patron dashboard**: Add a "My Reservations" section showing status of holds.
3. **Staff dashboard**: Add a reservations queue view showing pending holds per item.

### Deliverable
Patrons can place holds on checked-out items and will be notified when the item becomes available.

---

## Phase 6 — Automated Email Notifications
**Estimated effort: 2–3 days**

Send automated emails for: reservation available, due date reminders, and overdue notices.

### Email Provider Setup

Sign up for [Resend](https://resend.com) (recommended — generous free tier, excellent Next.js support). Add to `.env.local` and Railway dashboard:

```
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=library@yourdomain.com
CRON_SECRET=a_random_secret_for_the_cron_endpoint
```

Install the client:
```bash
npm install resend
```

### Create an Email Utility

Create `/lib/email.js`:

```javascript
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDueDateReminder(user, item, dueDate) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `Reminder: "${item.title}" is due ${dueDate}`,
    html: `
      <p>Hi ${user.name},</p>
      <p>This is a reminder that <strong>${item.title}</strong> is due back
      on <strong>${dueDate}</strong>.</p>
      <p>Please return or renew it before then to avoid late fees.</p>
    `,
  });
}

export async function sendOverdueNotice(user, item, daysOverdue) { ... }
export async function sendAvailabilityNotification(reservation) { ... }
```

### Scheduled Job (Daily Cron)

Create `/pages/api/cron/notifications.js`:

```javascript
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Items due tomorrow — send reminder
  const dueSoon = await prisma.rental.findMany({
    where: { dueDate: { gte: today, lte: tomorrow }, returned: false },
    include: { user: true, book: true },
  });
  for (const rental of dueSoon) {
    await sendDueDateReminder(rental.user, rental.book, rental.dueDate);
  }

  // Overdue items — send notice
  const overdue = await prisma.rental.findMany({
    where: { dueDate: { lt: today }, returned: false },
    include: { user: true, book: true },
  });
  for (const rental of overdue) {
    const daysOverdue = Math.floor((today - rental.dueDate) / 86400000);
    await sendOverdueNotice(rental.user, rental.book, daysOverdue);
  }

  res.status(200).json({ ok: true });
}
```

**Trigger daily** using Railway's built-in cron service — add a cron job in your Railway project that calls `https://your-app/api/cron/notifications` with the `Authorization: Bearer <CRON_SECRET>` header on a daily schedule.

### Deliverable
Patrons receive automatic emails: one day before due date, when overdue, and when a reserved item becomes available.

---

## Phase 7 — Fee Tracking for Equipment
**Estimated effort: 0.5–1 day**

Since payment is handled externally through your Square/Stripe store, this phase only tracks which rentals have fees outstanding and lets staff mark them paid.

### Database Changes

Add fee tracking to the rental/loan model:

```prisma
model Rental {
  // ... existing fields
  feeAmount   Float?
  feePaid     Boolean  @default(false)
  feePaidAt   DateTime?
  feeNotes    String?   // e.g. "Paid via Square, receipt #12345"
}
```

Run migration: `npx prisma migrate dev --name add_fee_tracking`

### UI Changes

1. **Staff checkout flow for equipment**: When checking out an equipment item with a rental fee, display the fee amount and auto-populate it on the rental record.
2. **Staff rental view**: Add a "Mark as paid" button on rentals with outstanding fees, plus a notes field for the Square/Stripe payment reference.
3. **Outstanding fees report**: A simple staff-facing page listing all unpaid equipment rental fees.

### Deliverable
Staff can track equipment rental fees and mark them paid after the patron pays through the external store.

---

## Phase 8 — Release 2 Deployment
**Estimated effort: minimal — ~1 hour**

By this point Railway is already configured. Release 2 deploys the same way Release 1 did: push to `main` on GitHub and Railway builds and deploys automatically.

### Steps
1. Merge all Release 2 feature branches into `main`
2. Add any new environment variables to Railway dashboard (`RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`)
3. Set up the Railway cron job for daily notifications
4. Push to `main` — Railway deploys automatically
5. Verify each feature on the live system with a test user

### Release 2 Production Checklist
- [ ] Equipment items can be added and checked out
- [ ] Patrons can place holds on checked-out items
- [ ] Test email received for due date reminder
- [ ] Test email received for overdue notice
- [ ] Test email received when reserved item becomes available
- [ ] Equipment rental fee appears correctly on checkout
- [ ] Staff can mark fees as paid
- [ ] Outstanding fees report is accessible

---

---

## Full Roadmap Summary

### Release 1 — Core System
| Phase | Feature | Effort |
|---|---|---|
| 0 | Environment setup | 0.5 days |
| 1 | Google SSO | 1–2 days |
| 2 | Batch ISBN import | 1–2 days |
| 3 | Deploy Release 1 to Railway | 0.5–1 day |
| **R1 Total** | | **3–5.5 days** |

### Release 2 — Full Features
| Phase | Feature | Effort |
|---|---|---|
| 4 | Equipment item type | 1–2 days |
| 5 | Patron reservations | 3–5 days |
| 6 | Automated email notifications | 2–3 days |
| 7 | Fee tracking | 0.5–1 day |
| 8 | Deploy Release 2 | ~1 hour |
| **R2 Total** | | **6.5–11 days** |

| **Grand Total** | | **~10–16.5 days** |

---

## Skill Prerequisites

| Skill | Required For | Level Needed |
|---|---|---|
| JavaScript / TypeScript | All phases | Intermediate |
| React / Next.js | UI changes (phases 2, 4–7) | Intermediate |
| Prisma ORM | Database changes (phases 4–5, 7) | Beginner — very readable syntax |
| Git | All phases | Basic |
| SQL basics | Understanding schema changes | Helpful but not required |
| Docker | Railway handles this for you | None needed |

---

## Ongoing Maintenance

- **OpenLibry releases**: check the GitHub repo monthly for upstream updates — merge periodically
- **Email deliverability**: monitor bounce rates in your Resend dashboard (Release 2+)
- **Database backups**: Railway automated backups run daily by default — verify weekly
- **Google OAuth**: credentials don't expire, but review Cloud Console settings annually
- **Dependency updates**: run `npm audit` quarterly and update packages with known vulnerabilities
