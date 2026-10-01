# Kharis On Campus Management

Weekly campus reporting for Kharis On Campus (KOC): attendance, prayer time, evangelism time and outreach outings for every university, with light/dark themes.

## How it works

- **Frontend:** Next.js (vinext on Vite), React 19, shadcn/ui.
- **Backend:** Supabase project **Kharis** (`yrqkafiqwllkphroztqk`, London region).
  - **Supabase Auth** handles login, sign-up, sessions (secure cookies), password reset and email changes.
  - **Postgres + row level security** decide what each person can see. The browser never gets more data than its role allows.
  - All writes go through checked database functions (`submit_report`, `admin_update_user`, …) — nobody can write to the tables directly.
- Schema, security rules and functions: `supabase/migrations/`.

## Roles

| Role | Who | Can do |
|---|---|---|
| **Administrator** | Minister Bene, Pastor Awo | See every campus, enter/edit any week, delete reports, approve campus reps, change anyone's role/status/email |
| **Stats editor** | Taija Lee, Ashley | See every campus, enter/edit weekly stats for any campus |
| **Campus rep** | added later via Sign up | See and report for their own university only, after an admin approves them |

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
npm test           # reporting-calendar tests
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
