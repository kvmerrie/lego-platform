# Production Auth Hardening

This document describes what should be considered production-ready for the current magic-link fallback flow. Email and password is now the primary account path, but the fallback email flow still needs to stay dependable.

It applies to the existing architecture only:

- Supabase Auth remains the provider for the secondary magic-link email flow
- `apps/web` stays browser-driven for sign-in
- `apps/api` stays the bearer-token verification and persistence boundary
- `/api/v1/session` and the current owned or wanted flows remain unchanged

Use this document alongside:

- `docs/operations/supabase-auth-foundation.md`
- `docs/operations/mvp-deployment-runbook.md`
- `docs/operations/mvp-production-rollout-checklist.md`
- `docs/operations/mvp-operator-troubleshooting.md`

## What Broke In Production Validation

The recent production fragility was most likely caused by repeated passwordless email requests hitting Supabase auth email limits while still using the default or lightly configured mail path.

That is consistent with Supabase’s own production guidance:

- Supabase recommends using a custom SMTP server for auth emails in production so mail comes from a trusted domain and you control deliverability.
- Supabase documents a default resend window for `/auth/v1/otp` and separate email-send limits that make repeated rapid retries a bad fit for live validation.

Official sources:

- [Supabase Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase passwordless email docs](https://supabase.com/docs/guides/auth/auth-email-passwordless)

## Production-Ready Auth For This MVP

The current MVP should be considered production-ready only when all of these are true:

1. Custom SMTP is configured in Supabase Auth.
2. Production auth emails come from a domain the team controls.
3. Production site URL and redirect URLs point at the production web origin.
4. Passwordless email links return through `/auth/callback` on that same origin.
5. Real external email addresses can complete sign-in successfully.
6. The team understands and accepts the resend window and auth rate-limit behavior.
7. The current UI messaging about resend timing is visible and calm for users.

## Custom SMTP

Custom SMTP is the recommended production posture for this MVP.

Why:

- it improves deliverability and sender trust
- it avoids relying on Supabase’s built-in mailer for real user traffic
- it gives the team better control over production auth email behavior

Setup expectations:

1. Configure SMTP in the Supabase dashboard under Auth email settings.
2. Use a production sender identity on the same domain family as the product if possible.
3. If the SMTP provider supports link tracking, disable link rewriting for auth emails.
   - Supabase explicitly warns that link tracking can deform or rewrite confirmation links.

Important boundary:

- SMTP credentials do not belong in the repo’s app env files
- SMTP is configured inside Supabase, not in `apps/web` or `apps/api` runtime env vars

## Supabase Built-In Mailer Limitations

For real production usage, the built-in mailer should be treated as insufficient for reliable public launch validation.

Reasons:

- lower trust and deliverability control
- email-send limitations documented by Supabase
- harder validation when multiple team members retry sign-in rapidly

This MVP can keep the same auth flow, but it should not rely on the default mailer as the long-term production posture.

## Rate Limits And Resend Expectations

Supabase’s current production docs note:

- a default 60-second resend window for OTP or magic-link sends on `/auth/v1/otp`
- configurable auth rate limits in the Supabase dashboard
- separate email-send limits that are tighter without your own SMTP setup

Operational expectation for this MVP:

- users should not be encouraged to retry rapidly
- operators validating production should wait at least about one minute before resend attempts
- repeated rapid retries are expected to trigger rate limiting even when the system is otherwise healthy

Current product UX expectation:

- after a send attempt, the UI should guide the user to wait before requesting another link
- if rate limiting happens, the UI should explain that a link was sent recently and the user should wait before retrying

## Production Env And Secret Boundaries

These env boundaries remain unchanged:

Browser-safe only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Not stored in repo app env files:

- SMTP host, username, password, and related provider secrets

Those SMTP settings should live in Supabase’s auth email configuration, not in Vercel env, Render env, or tracked env boilerplate files in this repository.

## Production Validation After SMTP Is Configured

Run this validation on production after custom SMTP is configured:

1. Confirm Supabase auth site URL is the production web origin.
2. Confirm Supabase auth redirect URLs include `https://<production-web-host>/auth/callback`.
3. Request sign-in for at least one real external email address.
4. Confirm the email arrives from the expected production sender identity.
5. Confirm the sign-in link lands on `/auth/callback` and then returns to the intended production page.
6. Confirm `/api/v1/session` becomes authenticated after sign-in.
7. Confirm owned or wanted toggles persist correctly.
8. Confirm profile save still works.
9. Confirm sign-out returns the session to anonymous state.
10. Wait at least about one minute before testing resend behavior.
11. Trigger one controlled resend and verify the calmer UX copy and successful delivery.

Recommended test inboxes:

- one consumer mailbox
- one team-controlled mailbox on a different provider

## Small MVP Guardrails

Without changing the architecture, keep these guardrails in place:

- do not promise instant resend availability in the UI
- avoid repeated rapid retry instructions in runbooks
- prefer calm user-facing copy that explains when to wait
- keep browser auth env and server auth env clearly separated

## Failure Interpretation

Use `docs/operations/mvp-operator-troubleshooting.md` for the fast triage flow.

Auth-specific interpretation reminders:

- sign-in unavailable in the web UI usually means missing browser-safe Supabase envs, not a broken public catalog route
- resend or rate-limit errors are often expected healthy behavior under repeated retry attempts
- sign-in links arriving but leaving the session anonymous usually point at callback URL, site URL, or redirect URL mistakes before deeper code issues

## What This MVP Still Defers

This hardening pass does not introduce:

- new auth providers
- password auth
- SSR or cookie auth
- MFA for end users
- broader account-management features

Those are later improvements. The current goal is simply to make the existing passwordless email flow reliable enough for real MVP users.
