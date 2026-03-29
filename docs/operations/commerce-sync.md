# Commerce Sync

This repository keeps the first pricing and affiliate slice snapshot-backed. The public web app reads generated Dutch-market buy guidance through `libs/pricing/data-access` and `libs/affiliate/data-access`; it does not call merchants at request time.

See also:

- `docs/operations/pricing-history.md`

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

Curated local inputs currently live in:

- `apps/commerce-sync/src/lib/commerce-sync-curation.ts`
- `libs/pricing/data-access-server/src/lib/pricing-reference-values.ts`
- `libs/pricing/data-access-server/src/lib/pricing-observation-seeds.ts`
- `libs/affiliate/data-access-server/src/lib/merchant-config.ts`

This phase intentionally uses a very small, operator-reviewed allowlist:

- featured set ids only
- `LEGO NL`
- `bol`
- `Intertoys`

Example boilerplate:

- `.env.sync.example`

The current commerce sync slice does not require external feed secrets, but `write` mode now also persists daily price-history rows and therefore needs the normal server-side Supabase credentials:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

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

Check mode rebuilds the Dutch commerce artifacts in memory and fails if committed generated files would change.

```bash
pnpm sync:commerce:check
```

Use check mode before overwriting artifacts when reviewing changes.

## Operator Notes

- The current slice is set-detail only.
- No runtime merchant calls and no click tracking are included.
- The current snapshot-backed price panel remains unchanged.
- `pnpm sync:commerce` now also writes one daily Dutch price-history point per commerce-enabled set into Supabase Postgres.
- Those daily history rows are stored indefinitely for now; the current UI reads only the latest 30 days.
- `pnpm sync:commerce:check` remains a generated-artifact drift check only and does not write history rows.
- Merchant allowlist, disclosure copy, reference pricing, and enabled set scope remain curated locally.
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
- use `pnpm sync:commerce:check` manually or in CI when you want an artifact drift review without writing history rows
