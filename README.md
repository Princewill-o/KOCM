# Kharis On Campus Management

Weekly campus reporting for Kharis On Campus (KOC): attendance, prayer time, evangelism time and outreach outings for every university, with light/dark themes.

## How it works

- **Frontend:** Next.js (vinext on Vite), React 19, shadcn/ui.
- **Backend:** Supabase project **Kharis** (`yrqkafiqwllkphroztqk`, London region).
  - **Supabase Auth** handles login, sign-up, sessions (secure cookies), password reset and email changes.
  - **Postgres + row level security** decide what each person can see. The browser never gets more data than its role allows.
  - Checked database functions (`submit_report`, `admin_update_user`, …), column grants and row level security validate writes and isolate campus data.
- Schema, security rules and functions: `supabase/migrations/`.

## Roles

| Role | Who | Can do |
|---|---|---|
| **Administrator** | Minister Bene, Pastor Awo | See every campus, enter/edit any week, delete reports, approve campus reps, change anyone's role/status/email |
| **Stats editor** | Taija Lee, Ashley | See every campus, enter/edit weekly stats for any campus |
| **Campus rep** | university representatives | Own campus reports, grades, people and materials, after approval |
| **Cluster lead** | Modupe, Elyon, Lindsay, Naa, Zipporah, Chiedza | Read assigned cluster statistics, grades and people; review alerts |

Everyone can update their own name and password under **My profile**. Administrators can change their own email directly; others confirm a new email from their inbox (or ask an admin to set it on the **Accounts** page).

## Reporting rules (enforced in the database)

- One report per campus per week; the week ends on a Friday, deadline **10pm UK time** (BST/GMT handled).
- A week opens at midnight on the Saturday before. Future weeks can't be filled in.
- Saved after the deadline → recorded as **late**. Unreported weeks show as **missing**, never as zero.
- Re-saving a week updates it; every save is kept in `report_audit`.
- Season: 18 Sep 2026 – 28 May 2027 (`public.seasons`).

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # reporting, access, grades, contacts and trend tests
npm run test:database # disposable local PostgreSQL migration / RLS tests
npm run typecheck
npm run build
```

The Supabase URL and publishable key are in `lib/supabase.ts` (they are safe to ship to browsers; security comes from RLS).

## Supabase dashboard settings to check

- **Authentication → URL Configuration:** set *Site URL* to the live address of this app, and add `http://localhost:5173/**` plus the live URL with `/**` to *Redirect URLs* — needed for sign-up confirmation and password-reset links.
- **Authentication → Emails:** the built-in email sender is rate-limited; add your own SMTP before inviting lots of campus reps.

## Adding accounts

- **Campus reps:** they sign up at `/signup`, confirm their email, then an admin approves them under **Accounts**.
- **Admins / stats editors:** create the user in Supabase (Authentication → Users → Add user, tick *Auto confirm*). They appear under **Accounts → Pending** with no access; an admin approves them and picks their role.

## Campus workflows

- Weekly reports remain due Friday at **10pm Europe/London**, including BST/GMT. A first submission after that deadline creates an in-app alert for every active admin/editor (currently Taija-lee, Ashley, Minister Bene and Pastor Awo). Editing an existing report does not generate duplicate alerts.
- **Grades:** submit each student's assessment percentage. Scores strictly below 59% notify overall leads and the campus's cluster lead. Recipients use Notifications to mark their alerts as read; unread counts appear in navigation. Notifications are currently in-app, with no email delivery configured.
- **People:** scoped phone/contact records track fellowship and branch attendance and follow-up notes. Archive instead of deleting. Cluster leads can read their cluster's records; they cannot edit campus submissions.
- **Quarterly trends:** leadership and cluster accounts compare attendance, prayer, evangelism and outings by calendar quarter across seasons. Unreported data stays unknown.
- **Materials:** admin/editor accounts upload private PDFs up to 20 MiB and 100 pages, for all campuses or one campus. Publishers prepare bounded PNG reading pages before publication. Campus/cluster accounts cannot access either original PDFs or clean page files. The `protected-material-page` Supabase Edge Function checks authorisation for every page, permanently stamps the reader identity/session/time into the image, and delivers only that page with no-store headers. Sessions expire after 15 minutes; page/session limits and private audit records deter bulk extraction. The canvas reader clears on focus loss, print/capture shortcuts and inactivity, with explicit resume. Operating-system screenshots, recording and photographing a screen cannot be reliably blocked. See [protected material deployment and contracts](supabase/PROTECTED_MATERIALS.md).
- **Campus map:** 24 sourced university reference locations are provided, with OpenStreetMap attribution. They are not confirmed KOC meeting venues. Ambiguous locations remain unset; administrators edit coordinates, meetings, contact address and cluster on the map page. Natural Earth supplies the UK boundary.
- **Landing page:** university interest/account requests and existing member sign-in.

Clusters follow the existing campus region data: London (Modupe), Midlands (Elyon), South (Lindsay), North (Naa), South East (Zipporah), West (Chiedza). Existing `West England` campuses map to West. `Colleges` remains unassigned. Real campus/cluster accounts need verified email addresses: use signup, then an administrator approves and assigns their campus or cluster under Accounts. Named cluster leads are a roster, not fabricated login accounts.

See [database contracts and test instructions](supabase/WORKFLOWS.md). New migrations are in `supabase/migrations`; keep them in sync with the connected project before publishing the frontend.
