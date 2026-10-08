# Kharis On Campus Management

Weekly campus reporting for Kharis On Campus (KOC): attendance, prayer time, evangelism time and outreach outings for every university, with light/dark themes.

Administrators' main overview supports persisted academic years, mid-year reporting through January 31 and full-season reporting, aligned trends, campus/region totals and submitted-week averages, and all numeric campus-feedback outcomes. Historical 2023/2024 figures transcribed from the supplied review PDF appear in a separate reference section; they are not fabricated weekly submissions or academic-year totals. Inactive and in-process campuses remain outside live activity totals. Unknown values remain unknown.

## How it works

- **Frontend:** Next.js (vinext on Vite), React 19, shadcn/ui.
- **Backend:** Supabase project **Kharis** (`yrqkafiqwllkphroztqk`, London region).
  - **Supabase Auth** handles password authentication and sessions (secure cookies). The checked `username-auth` Edge Function adds username-only registration and username/email sign-in.
  - **Postgres + row level security** decide what each person can see. The browser never gets more data than its role allows.
  - Checked database functions (`submit_report`, `admin_update_user`, …), column grants and row level security validate writes and isolate campus data.
- Schema, security rules and functions: `supabase/migrations/`.

## Roles

| Role | Who | Can do |
|---|---|---|
| **Administrator** | Minister Bene, Pastor Awo, Princewill (after email confirmation) | See every campus, enter/edit any week, delete reports, approve campus reps, change anyone's role/status/email |
| **Stats editor** | Taija Lee, Ashley | See every campus, enter/edit weekly stats for any campus |
| **Campus rep** | university representatives | Own campus reports, grades, people and materials, after approval |
| **Cluster lead** | Modupe, Elyon, Lindsay, Naa, Zipporah, Chiedza | Submit conditional cluster reports; read scoped grades/people and review alerts |

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

- **Campus reps:** they sign up at `/signup` with a username, name, university and password, then an admin approves them under **Accounts**. Email is optional.
- **Admins / stats editors:** create the user in Supabase (Authentication → Users → Add user, tick *Auto confirm*). They appear under **Accounts → Pending** with no access; an admin approves them and picks their role.

## Campus workflows

- Weekly reports remain due Friday at **10pm Europe/London**, including BST/GMT. A first submission after that deadline creates an in-app alert for every active admin/editor (currently Taija-lee, Ashley, Minister Bene and Pastor Awo). Editing an existing report does not generate duplicate alerts.
- **Grades:** submit each student's assessment percentage. Scores strictly below 59% notify overall leads and the campus's cluster lead. Recipients use Notifications to mark their alerts as read; unread counts appear in navigation. Notifications are currently in-app, with no email delivery configured.
- **People:** scoped phone/contact records track fellowship and branch attendance and follow-up notes. Archive instead of deleting. Cluster leads can read their cluster's people records and submit or update weekly reports for campuses within that cluster.
- **Quarterly trends:** leadership and cluster accounts compare attendance, prayer, evangelism and outings by calendar quarter across seasons. Unreported data stays unknown.
- **Materials:** admin/editor accounts upload private PDFs up to 20 MiB and 100 pages, for all campuses or one campus. Publishers prepare bounded PNG reading pages before publication. Campus/cluster accounts cannot access either original PDFs or clean page files. The `protected-material-page` Supabase Edge Function checks authorisation for every page, permanently stamps a subtle KOC logo in the bottom-right corner of the image, and delivers only that page with no-store headers. Sessions expire after 15 minutes; page/session limits and private audit records deter bulk extraction. The canvas reader clears on focus loss, print/capture shortcuts and inactivity, with explicit resume. Operating-system screenshots, recording and photographing a screen cannot be reliably blocked. See [protected material deployment and contracts](supabase/PROTECTED_MATERIALS.md).
- **Campus lead profiles:** active administrators can select a university on the UK map or searchable directory to review its assigned lead and open campus statistics. Unknown locations remain in the directory. Contact details are protected by an admin-only RPC. Each campus has at most one active campus lead; statistics stay with the campus when its lead changes. Pending applicants may share a requested campus until approval. Leads can update their own phone, course, study year and biography through a checked self-service RPC.
- **Landing page:** university interest/account requests and existing member sign-in.

Clusters follow the existing campus region data: London (Modupe), Midlands (Elyon), South (Lindsay), North (Naa), South East (Zipporah), West (Chiedza). Existing `West England` campuses map to West. `Colleges` remains unassigned. Campus registration uses usernames; verified email is optional for notifications and recovery. An administrator approves and assigns campus or cluster access under Accounts. Named cluster leads are a roster, not fabricated login accounts.

See [database contracts and test instructions](supabase/WORKFLOWS.md). New migrations are in `supabase/migrations`; keep them in sync with the connected project before publishing the frontend.

## Interface design

See [DESIGN.md](DESIGN.md) for the interface foundations and editable Figma reference. Public, authentication and reporting screens share the warm white, charcoal and gold palette; preview/sample records are never published as live campus statistics.

## Account administration and report records

Administrators use **Accounts & access** to approve or decline applications and explicitly save role/status/scope changes. Campus and cluster assignments are required for those roles. Decisions are audited privately; the database serialises access changes to preserve at least one active administrator. Declining an application queues a rejection email with the administrator’s reason; repeat saves do not duplicate a decision. Later approval cancels unsent rejection jobs.

Rejection and reporting email delivery use the `account-email-delivery` Edge Function. Configure `SMTP_HOST`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` in Supabase Edge Function secrets. Use a verified sender and implicit TLS; hosted Supabase blocks outgoing ports 25 and 587. No credentials belong in frontend variables or source control. Missing configuration leaves messages queued. The UI shows pending/sending/sent/failed/cancelled states and permits explicit retry. Sent means SMTP accepted the recipient, not guaranteed inbox delivery. Each batch claims at most three messages; failed attempts have a one-minute backoff and a five-attempt cap. A ten-minute lease permits recovery after interrupted delivery; SMTP cannot guarantee exactly-once delivery if sending succeeds before recording the result. The database scheduler retries deliverable queued messages every 15 minutes.

The explicitly requested `okubep@gmail.com` account has a one-time, seven-day admin invitation bound to its Auth UUID. Its admin role stays pending until Supabase verifies the email. The confirmation link opens `/update-password` to let the owner choose their password. Other signups cannot grant themselves admin via user-editable metadata.

Administrators can download a saved weekly report from **Campuses → weekly reports → PDF**. The PDF includes campus/cluster, reporting season, all submitted metrics and notes, submitter UUID, exact timestamps and late status. The record reflects the latest saved report; the audit retains earlier changes. PDF export uses only reports returned by the existing scoped queries. Cluster leads submit the same campus report format within their assigned cluster; administrators see those records immediately.

### Friday leadership emails

A `pg_cron` job runs every 15 minutes. At 23:00 on Friday in `Europe/London`, it queues exactly one summary per active administrator with a verified real email address, for the current season. The summary lists campuses without a submitted report and reports first submitted late by that snapshot; zero-valued submitted reports are not missing. Campus lead names and submitter names help admins follow up. BST/GMT transitions are tested. Placeholder `.example`/`.test` addresses and unverified accounts are excluded. The 23:00 snapshot does not continually change for later submissions; admins can view live records on the platform.

The scheduler credential is generated server-side and encrypted in Supabase Vault. The Edge Function gateway permits cron requests but its handler verifies the worker credential or a signed-in active administrator before accessing the queue. Browser roles cannot read the credential or call worker RPCs. SMTP setup remains required for actual delivery. HTML and plaintext messages share KOC branding; see [email templates and hosted setup](supabase/EMAILS.md).

## Password recovery

The hosted Auth Site URL is `https://kocm.vercel.app`. Exact `/update-password` and `/dashboard` redirect URLs are configured for the two existing Vercel sites and localhost:5173. Recovery requests redirect to the current app’s `/update-password`; the browser waits for Supabase’s callback/session exchange before showing the new-password form. Invalid or expired callbacks offer a new-link action. Open PKCE recovery links in the same browser that requested them, and use the newest email. App signup/reset forms require at least 12 characters. Never record or commit account passwords.

### Grace and landing components

The public page includes an Apply here signup link, liquid glass buttons, animated marker underlines and a manual community photo slider. The slider supports previous/next, direct selection, arrow keys and swipe; animations respect reduced-motion preferences.

Grace uses the `grace-chat` Supabase Edge Function to call Groq’s `openai/gpt-oss-20b` model with public KOC guidance and a short conversation history. Suggested questions use the verified FAQ bank directly. The UI labels AI replies and FAQ fallbacks honestly; missing configuration, quota exhaustion and provider errors leave the FAQ assistant usable. Grace has no access to private campus records and cannot approve accounts, reset passwords or submit reports. Chat history stays in component memory and clears on reload; model requests send the entered message and recent conversation to Groq.

To activate model replies, keep the Groq account on its Free plan and save `GROQ_API_KEY` in Supabase Edge Function secrets. Never put it in frontend variables or source control. Deploy the Grace migration and function before the frontend. The service-only quota function limits requests globally and by hashed client identity; its private counters contain no questions or chat transcripts. Limits are conservative safeguards, not a guarantee that an external provider’s free allowance will never change. Provider failures never trigger a paid fallback.

## Cluster report submissions

Cluster leads use **Cluster report** in place of their weekly statistics form. The form follows the referenced [Microsoft cluster form](https://forms.cloud.microsoft/pages/responsepage.aspx?id=ktmX28Fl60WkrVF3jBeQnwiKGvS9Z0BLia2mFC7kl_lUMDk4SDRINDk2MUZYOElBUkhaVTBURTNaNyQlQCN0PWcu&route=shorturl): whole-cluster or individual-campus reporting across sessions, evangelism, prayer, follow-up, core-team meetings and incidents. Conditional hidden answers are discarded.

**Review answers → Submit report** calls `submit_cluster_report`. The database checks active cluster assignment, campus scope and every required conditional answer, stores server-sourced lead name/email and submission time, and notifies active administrators. A stable request ID prevents duplicate retries. Success is shown only after the server confirms persistence. Drafts remain memory-only; leaving before submission loses the draft.

Admins/editors read saved records under **Campuses → Weekly report → Submitted cluster reports**; cluster leads see their cluster records beneath their form. **Refresh reports** loads new submissions. Admin alerts link to the report view. Campus accounts cannot access cluster reports. No Microsoft form responses are sent. This format stores separate records rather than overwriting campus weekly statistics; its deadline summaries and PDF export are not yet implemented.

## Usernames and optional email

Sign-in accepts a username or an existing real account email. The public signup page creates a pending campus account and detailed lead application through the `lead-application` Edge Function; Supabase holds an opaque internal identifier that is never shown as a contact email or used for outbound mail. Usernames are unique, case-insensitive, and use 3–30 letters, numbers or underscores. Members choose/change their username in My profile. Existing email logins keep working.

An account without real email can sign in and receive in-app alerts. Email notifications and password recovery need a verified real address. Adding an email to a username-only account requires its current password and a confirmation link delivered through configured SMTP. Missing sender configuration returns an explicit error without changing identity. The server confirms only the inaccessible internal identifier, never the user's new email. Existing real-email changes retain Supabase's native confirmation flow. No global confirmation setting is weakened.

## Campus lifecycle and trainee directory

The supplied 2026 campus list was imported into the connected database: 49 campuses, 37 active, 9 inactive, 3 in process. All remain visible to administrators; inactive/in-process campuses are excluded from reporting scopes, summary totals, weekly coverage, quarterly charts and statistics exports. Historical reports remain retained. The assigned account can still identify its inactive university.

The 38 supplied trainee records, including portraits, course, year, grade label and training attendance, live in an admin-only roster. The directory distinguishes this dated snapshot from an approved primary account. Training attendance is not campus activity status. Multiple trainees at a university are preserved rather than choosing a primary lead automatically. These imported roster records are not login accounts: one primary campus lead must be selected before creating/approving its actual login. Source names, grades and portraits are not committed to public code or assets.

University marks are bundled from observed official website assets with source URLs in `lib/university-brands.json`. University colours accent campus screens while retaining shared light/dark tokens. Where a verified mark is unavailable, an initials fallback is displayed rather than a substituted partner or award logo.


## Campus weekly feedback and lead applications

Campus leads use the five-section [KOC Weekly Feedback Form](https://forms.office.com/e/wrPiKQia13) adaptation: general session details, prayer, evangelism, church attendance and incidents. Name and university come from the authenticated account. Holy Ghost baptism and zero evangelism have conditional questions; hidden answers are discarded. The database validates counts, active campus scope, reporting week and the Friday 22:00 Europe/London deadline. Late reasons are required when received after the deadline. The supplementary outreach-outings field preserves the existing platform metric.

A confirmed submission stores an immutable `campus_weekly_feedback` snapshot and updates existing weekly metrics, audits and late alerts transactionally. Attendance excludes the lead to match the source form. Full incident text (up to 4,000 characters) remains in the snapshot; existing metric notes retain the first 2,000 characters. The linked metric record cannot be hard-deleted while a feedback snapshot references it. Latest 100 feedback snapshots are readable in Weekly report by existing authorized scopes. Retry IDs prevent duplicate writes; changing answers starts a new submission. Cluster and administrator/editor metric forms retain their separate workflows. No Microsoft responses are submitted by this application.

`/signup` is a tailored trainee application, because both supplied links refer to the same weekly form. Applicants select one of the existing universities (including inactive/in-process entries) or propose a university and city. They provide course/year, motivation, experience, availability, campus plan and optional phone, then review before submitting. Email is optional; username and a password of at least 12 characters are required. The checked public Edge Function creates an opaque internal Auth identity and persists the application through service-only RPCs. New universities enter the directory as in process and do not count in statistics. No applicant is automatically approved or assigned as an active primary lead.

Every saved application notifies active administrators in-app and appears under Accounts & access and its chosen university's Campus lead profile. Application answers are available only to their applicant and active administrators. Account approval and campus lifecycle are separate admin decisions; campus profiles offer an explicit status save that refreshes active statistics scopes. Email delivery still requires a verified real recipient and configured sender.

University branding covers all 48 named institutions/campus entries, with a neutral badge for the generic Colleges group. [Official asset provenance](public/university-brands/SOURCES.md) records each source. The [map research](docs/map-location-provenance.md) covers all 48 named university reference points. The UK outline and pins share a Mercator projection; nearby pins are never geographically displaced. Whole UK, London and selected-campus zoom controls aid navigation. Colleges has no invented location. Reference points do not claim to be confirmed KOC fellowship venues.
