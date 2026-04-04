# Wishlist Alert Emails

This document covers the first real email delivery flow for wishlist deal alerts.

Current scope:

- one email type
- one provider: Resend
- one explicit server-side job path
- no notification center
- no push delivery

## Render Production Shape

Run wishlist alert delivery as its own Render job, not inside the API service.

Recommended production shape:

- service type: separate Render scheduled job or manually triggered job
- suggested name: `wishlist-alerts-production`
- keep it separate from `apps/api`, `catalog-sync`, and `commerce-sync`
- use the same repository root and install strategy as the existing Render jobs
- keep job notifications enabled at `Only failure notifications`

Controlled rollout posture:

- first run `--check` manually in production
- then run `--send` manually with a small cap
- only add a recurring schedule after the manual run logs and Resend delivery look healthy

## What Sends

The sender looks for signed-in users who:

- have `wishlistDealAlerts` enabled
- still have wishlist sets saved
- have at least one newly notifiable wishlist alert candidate

The candidate logic reuses the existing wishlist alert foundations:

- `new-best-price`
- `price-improved-since-save`
- `strong-deal-now`

## Duplicate Prevention

Duplicate sends are prevented by persisted per-user notification state in `public.wishlist_alert_notification_states`.

For each user and set, the sender stores:

- `last_notified_kind`
- `last_notified_at`

The send flow only emails candidates that are still `isNewlyNotifiable` under the existing cooldown and supersession rules.

Current behavior:

- the same set and signal does not re-email during the cooldown window
- a stronger signal can supersede a weaker previously sent signal
- notification state is only updated after a successful email send

## Required Env Vars

The flow requires the normal server Supabase env plus Resend sender config.

Required:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `WEB_BASE_URL`

Optional but recommended:

- `RESEND_FROM_NAME`
  Defaults to the product name when omitted.
- `WISHLIST_ALERT_EMAIL_MAX_SENDS`
  Optional safety cap for how many recipient emails the job may send in one run.
  Useful for the first production sends.

`WEB_BASE_URL` should point to the production web host so email links resolve back to the live product.

## Run Commands

Preview candidates without sending:

```bash
pnpm alerts:wishlist:check
```

Send real emails through Resend:

```bash
pnpm alerts:wishlist:send
```

Direct Nx equivalents:

```bash
pnpm nx run wishlist-alerts:run -- --check
pnpm nx run wishlist-alerts:run -- --send
```

Run a capped send manually:

```bash
pnpm alerts:wishlist:send -- --max-emails=25
```

The CLI flag wins over `WISHLIST_ALERT_EMAIL_MAX_SENDS` when both are present.

## Recommended Render Commands

Build command:

```bash
pnpm nx run wishlist-alerts:build
```

Manual production dry run:

```bash
pnpm alerts:wishlist:check
```

First controlled production send:

```bash
pnpm alerts:wishlist:send -- --max-emails=25
```

After rollout confidence is high, remove or raise the cap intentionally and only then enable a recurring schedule.

## Logging And Guardrails

Every run logs:

- mode
- provider
- recipient count
- recipients with active candidates
- selected email count
- deferred email count
- alert candidate counts
- notification state write count
- duration

Current guardrails:

- `--check` is the dry-run path and never sends email
- `--send` only sends newly notifiable candidates
- per-user notification state prevents repeat sends for the same signal inside cooldown
- `--max-emails` or `WISHLIST_ALERT_EMAIL_MAX_SENDS` can cap a run for controlled rollout
- the job warns when `--send` runs without a cap
- the job warns when candidates are deferred because the cap was reached

## Current Limitations

- only one transactional wishlist alert email exists today
- the sender is production-runnable now, but recurring automation should wait until the first manual production sends are reviewed
- auth emails remain separate and should stay configured in Supabase auth
- there is no unsubscribe center yet beyond the in-product `wishlistDealAlerts` preference
