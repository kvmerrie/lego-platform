# Commerce Sync

This repository keeps the first pricing and affiliate slice snapshot-backed. The public web app reads generated Dutch-market buy guidance through `libs/pricing/data-access` and `libs/affiliate/data-access`; it does not call merchants at request time.

See also:

- `docs/operations/pricing-history.md`
- `docs/operations/mvp-operator-troubleshooting.md`

## Current Scope

- market: Netherlands only
- currency: `EUR` only
- condition: `new` only
- runtime path: `apps/commerce-sync`
- server-only support:
  - `libs/pricing/data-access-server`
  - `libs/affiliate/data-access-server`
- generated pricing artifacts:
  - `libs/pricing/data-access/src/lib/pricing-observations.generated.ts`
  - `libs/pricing/data-access/src/lib/price-panel-snapshots.generated.ts`
  - `libs/pricing/data-access/src/lib/pricing-sync-manifest.generated.ts`
- generated affiliate artifacts:
  - `libs/affiliate/data-access/src/lib/affiliate-offers.generated.ts`
  - `libs/affiliate/data-access/src/lib/affiliate-sync-manifest.generated.ts`

## Current Inputs

The operational commerce source of truth now lives in Supabase:

- `commerce_merchants`
- `commerce_offer_seeds`
- `commerce_offer_latest`

What remains local on purpose:

- `libs/pricing/data-access-server/src/lib/pricing-reference-values.ts`
- `libs/affiliate/data-access-server/src/lib/merchant-config.ts`

Those local files now act as reference pricing and merchant presentation or host metadata.
They are no longer the source of active seed URLs.

## Commerce Backoffice Foundation

Brickhunt now also has a first commerce backoffice in the Angular admin app.

What moved into Supabase:

- `commerce_merchants`
- `commerce_offer_seeds`
- `commerce_offer_latest`

What that backoffice owns:

- merchant CRUD
- set-to-merchant seed URLs
- basic coverage and stale or broken seed visibility

What still remains intentionally snapshot-backed:

- the public web app still reads generated pricing and affiliate artifacts
- the sync job now rebuilds those artifacts from Supabase-managed seeds and latest fetched offer state

Treat the admin + Supabase tables as the operational source of truth for the commerce layer.

This phase intentionally uses a very small, operator-reviewed allowlist:

- a small reviewed set allowlist drawn from the current public curated catalog
- `LEGO NL`
- `bol`
- `Intertoys`

Example boilerplate:

- `.env.sync.example`

The current commerce sync slice needs the normal server-side Supabase credentials for both read and write flows:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`write` mode also needs outbound network access to merchant product pages.

## Run The Sync

From the workspace root:

```bash
pnpm sync:commerce
```

Or directly:

```bash
pnpm nx run commerce-sync:run
```

## Check Mode

Check mode rebuilds the Dutch commerce artifacts from the current Supabase commerce state in memory and fails if committed generated files would change.

```bash
pnpm sync:commerce:check
```

Use check mode before overwriting artifacts when reviewing changes.

For local-hook clarity, the same deterministic artifact-only path is also available as:

```bash
pnpm sync:commerce:local:check
```

This check does not call merchants and does not write Supabase latest or history rows.

## Operator Notes

- The current slice is set-detail only.
- No runtime merchant calls and no click tracking are included.
- The current snapshot-backed price panel remains unchanged for the public app.
- `pnpm sync:commerce` now also writes one daily Dutch price-history point per commerce-enabled set into Supabase Postgres.
- Those daily history rows are stored indefinitely for now; the current UI reads only the latest 30 days.
- `pnpm sync:commerce` refreshes every active Supabase seed, updates `commerce_offer_latest`, and updates `validation_status` plus `last_verified_at` on the seed itself.
- `pnpm sync:commerce:check` and `pnpm sync:commerce:local:check` remain generated-artifact drift checks only and do not write latest or history rows.
- Merchant presentation metadata and reference pricing remain curated locally.
- Active merchant and seed scope now come from Supabase, not from local seed files.
- If a stable merchant product page cannot be verified for a seed, keep the seed reviewable in admin instead of guessing a replacement URL.
- Technical workflow only: merchant approvals, affiliate terms, and legal review still require manual business validation outside the repo.

## Production Scheduling

Commerce sync is safe to run repeatedly in production.

Why it is idempotent:

- generated pricing and affiliate artifacts are deterministic
- artifact writers only overwrite files when the rendered output actually changes
- daily price-history writes use an upsert keyed by `(set_id, region_code, currency_code, condition, recorded_on)`, so reruns on the same day update the same row instead of creating duplicates

Recommended production schedule:

- every 6 hours

Recommended Render scheduled job command:

```bash
pnpm sync:commerce
```

Render scheduled job notes:

- run this as a scheduled background job, not as an always-on service
- keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` scoped to the scheduled job only
- use `pnpm sync:commerce:local:check` in local hooks or fast local review
- use `pnpm sync:commerce:check` manually or in CI when you want an artifact drift review without refreshing merchants
- a healthy scheduled job should log one `start` line, one line per refreshed seed with merchant, seed id, set id, and status, and one `end` line with refresh, offer, and history counts; if it never reaches `end`, treat the run as failed and inspect Render logs before retrying

## Troubleshooting Notes

Use `docs/operations/mvp-operator-troubleshooting.md` for the fast triage flow.

Common commerce sync interpretations:

- `Generated commerce artifacts are stale` means artifact drift was detected and needs review
- `pnpm sync:commerce:check` does not write history rows; only `pnpm sync:commerce` does
- missing Supabase write envs on the scheduled job will surface as history-write failures even when artifact generation itself is healthy
