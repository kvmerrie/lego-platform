# Wishlist Alert Emails

This document covers the first real email delivery flow for wishlist deal alerts.

Current scope:

- one email type
- one provider: Resend
- one explicit server-side run path
- no notification center
- no push delivery

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

Optional but recommended:

- `RESEND_FROM_NAME`
  Defaults to the product name when omitted.
- `WEB_BASE_URL`
  Used for wishlist and set links in emails.
  Defaults to the configured local web runtime URL when omitted.

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

## Current Limitations

- only one transactional wishlist alert email exists today
- the sender runs as an explicit command, not a full scheduler platform
- auth emails remain separate and should stay configured in Supabase auth
- there is no unsubscribe center yet beyond the in-product `wishlistDealAlerts` preference
