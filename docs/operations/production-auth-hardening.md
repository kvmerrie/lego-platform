# Production Auth Hardening

This document describes what should be considered production-ready for the auth model that is currently implemented in the product:

- primary sign-in: email and password
- first social sign-in: Google
- secondary fallback: magic link email
- password recovery: email reset flow through `/auth/callback`

It applies to the existing architecture only:

- Supabase Auth remains the account provider for email and password, Google OAuth, password recovery, and the secondary magic-link email flow
- `apps/web` stays browser-driven for sign-in
- `apps/api` stays the bearer-token verification and persistence boundary
- `/api/v1/session` and the current owned or wanted flows remain unchanged

Use this document alongside:

- `docs/operations/supabase-auth-foundation.md`
- `docs/operations/mvp-deployment-runbook.md`
- `docs/operations/mvp-production-rollout-checklist.md`
- `docs/operations/mvp-operator-troubleshooting.md`

## Current Production Risk Areas

The most fragile parts of the current auth model are still the email-dependent parts:

- account confirmation email delivery
- password reset email delivery
- magic-link fallback delivery
- rate limiting on repeated auth email requests

The recent production fragility was most likely caused by repeated fallback email requests hitting Supabase auth email limits while still using the default or lightly configured mail path.

That is consistent with Supabase’s own production guidance:

- Supabase recommends using a custom SMTP server for auth emails in production so mail comes from a trusted domain and you control deliverability.
- Supabase documents a default resend window for `/auth/v1/otp` and separate email-send limits that make repeated rapid retries a bad fit for live validation.

Official sources:

- [Supabase Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase passwordless email docs](https://supabase.com/docs/guides/auth/auth-email-passwordless)

## Production-Ready Auth For This Product

The current product should be considered production-ready only when all of these are true:

1. Email and password auth is enabled in Supabase for the production project.
2. Google is either fully configured and tested in Supabase or intentionally disabled in production.
3. Custom SMTP is configured in Supabase Auth.
4. Production auth emails come from a domain the team controls.
5. Production site URL and redirect URLs point at the production web origin.
6. Email confirmation, password recovery, Google OAuth, and magic-link fallback all return through `/auth/callback` on that same origin.
7. Real external email addresses can complete sign-up, sign-in, and password reset successfully.
8. The team understands and accepts the resend window and auth rate-limit behavior for email-based flows.
9. The current UI messaging about resend timing, recovery, and unavailable providers is visible and calm for users.

## Primary Account Flows

The production account experience should be validated in this order:

1. Email and password sign-up
2. Email confirmation handoff through `/auth/callback`
3. Email and password sign-in
4. Password reset email and new-password completion
5. Google sign-in if the provider is enabled
6. Magic-link fallback only after the primary flows are already healthy

Operational guidance:

- treat email and password as the main readiness gate
- treat Google as optional per environment, but only if it is clearly disabled or clearly working
- treat magic link as a fallback path, not the main production login experience

## Google Provider Readiness

Google should only be surfaced in production when all of these are true:

1. The Google provider is enabled in Supabase Auth.
2. The correct production OAuth client credentials are configured in Supabase.
3. The production web origin and `/auth/callback` URL are allowed in the Google OAuth client.
4. A real production browser can complete the Google redirect and return with an authenticated `/api/v1/session`.

If any of those are missing:

- disable the Google provider for that environment
- do not rely on partially configured Google login during rollout validation

## Password Recovery Readiness

Password recovery is now part of the real account model and should be treated as production-critical.

Production expectations:

1. A signed-out collector can request a reset email successfully.
2. The reset email arrives from the expected production sender identity.
3. The reset link lands on `/auth/callback`.
4. The collector is returned to `/account?auth=reset-password`.
5. The browser can save a new password successfully.
6. The collector can sign in afterward with the new password.

## Custom SMTP

Custom SMTP is the recommended production posture for the whole implemented auth model.

Why:

- it improves deliverability and sender trust
- it avoids relying on Supabase’s built-in mailer for real user traffic
- it gives the team better control over confirmation, reset, and fallback magic-link email behavior

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

This product can keep the same auth flow, but it should not rely on the default mailer as the long-term production posture.

## Rate Limits And Resend Expectations

Supabase’s current production docs note:

- a default 60-second resend window for OTP or magic-link sends on `/auth/v1/otp`
- configurable auth rate limits in the Supabase dashboard
- separate email-send limits that are tighter without your own SMTP setup

Operational expectation for the current auth model:

- users should not be encouraged to retry rapidly
- operators validating production should wait at least about one minute before repeating confirmation, reset, or magic-link email requests
- repeated rapid retries are expected to trigger rate limiting even when the system is otherwise healthy

Current product UX expectation:

- after an email send attempt, the UI should guide the user to wait before requesting another email
- if rate limiting happens, the UI should explain that an email was sent recently and the user should wait before retrying

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
3. Create or use one real external test account for email and password sign-in.
4. Confirm account confirmation email arrives from the expected production sender identity.
5. Confirm the confirmation handoff lands on `/auth/callback` and returns to the intended page.
6. Confirm email and password sign-in authenticates `/api/v1/session`.
7. Trigger one password reset email and complete the reset flow successfully.
8. If Google is enabled, confirm Google sign-in authenticates `/api/v1/session`.
9. Trigger one controlled magic-link fallback sign-in and verify the calmer resend UX copy and successful delivery.
10. Confirm owned or wanted toggles persist correctly.
11. Confirm profile save still works.
12. Confirm sign-out returns the session to anonymous state.

Recommended test inboxes:

- one consumer mailbox
- one team-controlled mailbox on a different provider

## Small MVP Guardrails

Without changing the architecture, keep these guardrails in place:

- do not promise instant resend availability in the UI
- avoid repeated rapid retry instructions in runbooks
- prefer calm user-facing copy that explains when to wait
- prefer password sign-in and password reset during operator validation before falling back to magic-link email
- keep browser auth env and server auth env clearly separated

## Failure Interpretation

Use `docs/operations/mvp-operator-troubleshooting.md` for the fast triage flow.

Auth-specific interpretation reminders:

- sign-in unavailable in the web UI usually means missing browser-safe Supabase envs, not a broken public catalog route
- email confirmation, reset, or magic-link resend errors are often expected healthy behavior under repeated retry attempts
- email and password failing while `/api/v1/session` stays anonymous usually points at auth-provider config, not catalog code
- Google sign-in failures usually point at provider enablement, OAuth client config, or redirect URL mismatch before deeper code issues
- emails arriving but leaving the session anonymous usually point at callback URL, site URL, or redirect URL mistakes before deeper code issues

## What This MVP Still Defers

This hardening pass does not introduce:

- SSR or cookie auth
- MFA for end users
- broader account-management features

Those are later improvements. The current goal is to make the implemented email and password model, Google provider path, password recovery, and magic-link fallback reliable enough for real users.
