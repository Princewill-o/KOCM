# KOC authentication emails

These templates match the platform's warm white, charcoal and gold interface. They use inline CSS, presentation tables, a 600px maximum width, live text branding and accessible descriptive links. They do not require remote images or web fonts. Supabase generates the actual single-use action URL through `{{ .ConfirmationURL }}`. Never replace it with a manually assembled token, a dashboard URL or a stored example link.

## Hosted project setup

Templates in Git do **not** automatically update the hosted Supabase Auth configuration. They are prepared here; applying them to the hosted project requires the project's Auth settings or an authorized Supabase Management API connection.

In the Kharis Supabase project's **Authentication → Email Templates** page, choose each template, paste the corresponding complete HTML file into the body, set the subject below, and save.

| Auth template | Subject | HTML file |
| --- | --- | --- |
| Confirm signup | Confirm your KOC email address | `email-templates/confirmation.html` |
| Reset password | Reset your KOC password | `email-templates/recovery.html` |
| Invite user | Your KOC account invitation | `email-templates/invite.html` |

Project: `yrqkafiqwllkphroztqk`. See [Supabase email template settings](https://supabase.com/dashboard/project/yrqkafiqwllkphroztqk/auth/templates) and [official template documentation](https://supabase.com/docs/guides/auth/auth-email-templates).

Check **Authentication → URL Configuration** before testing. Production Site URL is `https://kocm.vercel.app`; redirect allowlists must include the application's actual Auth callback destinations. Preserve existing working redirect settings. These templates use the generated confirmation URL, so the redirect supplied by the app must remain appropriate to each flow. An invitation must land in a flow that lets the invitee set a password; changing this email alone does not implement that flow.

For an authorized Management API update, the corresponding configuration fields are:

- `mailer_subjects_confirmation` and `mailer_templates_confirmation_content`
- `mailer_subjects_recovery` and `mailer_templates_recovery_content`
- `mailer_subjects_invite` and `mailer_templates_invite_content`

Read the existing configuration first and patch only these fields. Do not expose a Management API access token in frontend code, templates or Git.

## What the messages promise

Signup confirmation verifies the email address; it does not approve an ordinary campus or cluster application. The template explicitly says an administrator reviews access. Administrator provisioning for an owner account is a separate backend rule, not something an email grants. Invitations explain that assigned roles determine access and avoid promising an unassigned account is already approved. Recovery changes the password without promising a different role.

The only interpolated field in these files is the Supabase-generated `ConfirmationURL` in quoted link attributes. No user-supplied name, email, metadata or rejection explanation is inserted into HTML. Do not introduce unescaped dynamic content. These authentication emails are separate from the application's account-decision email queue and Edge Function.

## Delivery and verification

Styling an email does not configure delivery. Supabase Auth's hosted email service and custom SMTP settings are separate from the application decision-email sender. A production sender should be configured in **Authentication → SMTP Settings**; follow [Supabase custom SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp). Preserve the configured sender rather than inventing a mailbox.

After applying the templates, use controlled test accounts to verify:

1. A signup email displays correctly on narrow mobile and desktop layouts; its button confirms the address and returns to the expected application page. The account's approval state still matches the database.
2. A password recovery email opens the existing reset flow and allows a new password, without granting additional access.
3. An invitation opens the intended setup flow; the invitee can establish credentials and receives only the assigned role.
4. Button and fallback link use the same generated URL. Old or already-used links fail safely. No generated token/link is added to screenshots, logs, source control or public previews.
5. Gmail and Outlook previews retain readable body text, an obvious gold action button and the safety footer. An email accepted by the SMTP provider is not proof of inbox delivery.

The repository files can be inspected with placeholder text substituted locally for preview. Never test or preview using a real user's confirmation link.

## Automatic reporting summaries

The deployed database job `koc-account-email-delivery` runs every 15 minutes. It queues a single Friday report summary at 23:00 Europe/London for each active administrator with a verified email address. Missing campuses, their lead names, and late submissions are recorded as a snapshot. Placeholder `.example` / `.test` accounts are skipped. The deployed worker sends HTML and plain text from `supabase/functions/account-email-delivery/templates.ts`. SMTP delivery remains unconfigured until the owner supplies a sender and credentials.

Set `SMTP_HOST`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` as Edge Function secrets. Supabase blocks SMTP ports25/587. These function secrets are separate from Supabase Auth's SMTP settings: configure the same service in Auth to send branded confirmation and recovery messages. Store passwords only through secrets/settings, never in source or chat. The cron credential lives encrypted in Vault and is verified by a service-only RPC; gateway JWT verification is disabled only for this function, whose handler requires either that credential or a verified active admin.

## Weekly report reminders and missing submissions

The existing fifteen-minute scheduler checks Friday in `Europe/London`, including BST/GMT. At 20:00 it creates one in-app reminder for each active campus lead whose active campus has no weekly metrics report, and each active cluster lead whose active cluster has no whole-cluster report. It queues a matching branded email only when the lead has a verified real address attached to Auth. Internal `.invalid` aliases and reserved `.example`, `.test`, `example.com`, `example.net` and `example.org` addresses never receive reminder mail. Inactive/in-process campuses, inactive clusters and unassigned reporting responsibilities do not create lead reminders.

At 23:00 the scheduler creates one missing-report alert per reporting scope/week for its responsible lead and each active administrator. The responsible lead receives a separate missing-report email; administrators retain their existing Friday leadership digest, which now also lists missing whole-cluster reports. Missing means no submission, never zero activity. These jobs use the current reporting season and current UK reporting week. The scheduler does not catch up older weeks or send missed timing windows retroactively.

Every email claim rechecks the recipient’s verified Auth address, current role/assignment, active scope and missing submission. Submitting a report or changing the responsible account/scope resolves corresponding in-app alerts and cancels obsolete pending jobs. Before-deadline reminders expire at the Friday deadline; lead jobs also expire when their UK reporting week ends. A submission after a message has already been claimed for SMTP can race with delivery. SMTP acceptance is not a guarantee of inbox delivery.

The delivery worker accepts authenticated `POST {"action":"status"}` and returns `{"configured":true|false}` without claiming or sending any messages. It requires the same active-administrator or worker authentication as ordinary delivery. This reports whether the required SMTP settings exist; it does not test the SMTP connection or inbox placement. SMTP must be configured before queued messages can actually send. QA uses mocked senders and disposable database fixtures; no real reminder emails are sent during tests.
