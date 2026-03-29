# Pricing History

This document describes the current 30-day Dutch price-history slice for set-detail pages.

## Current Scope

- region: Netherlands only
- currency: `EUR` only
- condition: `new` only
- current commerce-enabled set scope only
- one daily history point per set
- no alerts
- no multi-region UI
- no homepage pricing changes

## Storage

Historical pricing points are stored in Supabase Postgres in:

- `public.pricing_daily_set_history`

Storage horizon:

- daily pricing rows are stored indefinitely for now
- no retention window is enforced in the current MVP slice

Migration:

- `supabase/migrations/20260329134500_pricing_daily_set_history.sql`

Primary key:

- `(set_id, region_code, currency_code, condition, recorded_on)`

## Write Path

- `apps/commerce-sync` continues to generate the current snapshot-backed price panel artifacts
- in `write` mode, the same sync run now also upserts one daily history point per commerce-enabled set through `libs/pricing/data-access-server`
- the daily history point is built from the current headline price-panel snapshot for that set

Required server env for `write` mode:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Check mode behavior:

- `pnpm sync:commerce:check` still checks generated artifacts only
- it does not write to Supabase

## Read Path

- the current price panel remains snapshot-backed
- the 30-day history chart and additive summary metrics are browser read surfaces
- the current UI reads the last 30 days for the chart and 30-day average/low/high summary
- the current price panel also derives tracked low, tracked high, tracked since, and current-vs-tracked deltas from the full stored history for that set
- browser reads use the existing browser-safe Supabase configuration and the public select policy on `pricing_daily_set_history`

Future scope note:

- later product metrics such as “lowest tracked price” or “highest tracked price” can be derived from the full stored history without changing today’s storage shape

Required browser env for the set-detail history chart:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Operator Expectations

1. Apply the new Supabase migration before expecting history to render.
2. Keep `pnpm sync:commerce:check` in the normal drift-review workflow.
3. Run `pnpm sync:commerce` with Supabase server env configured when you want to write daily history points.
4. Expect the history chart to remain empty until at least one successful `write` run has recorded a point for a commerce-enabled set.
5. Expect the first recorded point to show a “History is building” 30-day summary state until more daily rows exist.
6. Even with one tracked row, the current price panel can still show tracked-since and tracked-range context from the stored history table.
