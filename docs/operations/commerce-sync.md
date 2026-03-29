# Commerce Sync

This repository keeps the first pricing and affiliate slice snapshot-backed. The public web app reads generated Dutch-market buy guidance through `libs/pricing/data-access` and `libs/affiliate/data-access`; it does not call merchants at request time.

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

The current commerce sync slice does not require external secrets, but the shared sync example file documents the operator-side Rebrickable variables used by the catalog workflow and leaves room for future operator-only sync secrets.

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
- No runtime merchant calls, no click tracking, no price history, and no database persistence are included.
- Merchant allowlist, disclosure copy, reference pricing, and enabled set scope remain curated locally.
- Technical workflow only: merchant approvals, affiliate terms, and legal review still require manual business validation outside the repo.
