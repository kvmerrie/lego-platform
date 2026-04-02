# Commerce Sync Validation Plan

This checklist validates the current Dutch-market pricing and affiliate slice whenever the reviewed set allowlist or merchant inputs change.

The current reviewed commerce slice covers `24` curated Dutch set-detail pages.

## 1. Safe Local Run

1. Start from a branch without unrelated pricing or affiliate changes.
2. Run `pnpm sync:commerce:check`.
3. Review any generated diff before writing artifacts.
4. Run `pnpm sync:commerce` only after the diff looks intentional.
5. Run:
   - `pnpm nx run pricing-data-access-server:test`
   - `pnpm nx run affiliate-data-access-server:test`
   - `pnpm nx run pricing-data-access:test`
   - `pnpm nx run affiliate-data-access:test`
   - `pnpm nx run web:build`

## 2. Files To Review

- `libs/pricing/data-access/src/lib/pricing-observations.generated.ts`
- `libs/pricing/data-access/src/lib/price-panel-snapshots.generated.ts`
- `libs/pricing/data-access/src/lib/pricing-sync-manifest.generated.ts`
- `libs/affiliate/data-access/src/lib/affiliate-offers.generated.ts`
- `libs/affiliate/data-access/src/lib/affiliate-sync-manifest.generated.ts`

## 3. Validation Expectations

Confirm that:

- only `NL` observations are present
- only `EUR` observations are present
- only `new` condition offers are present
- every enabled set id has a price panel snapshot
- every enabled set id has affiliate offer snapshots
- merchant ids are unique
- merchant display ranks are unique within `NL`
- outbound URLs stay on the expected merchant host
- outbound URLs point to reviewed direct product pages, not synthesized set-id slugs

## 4. Expected Failure Signals

`Duplicate affiliate merchant id`

- merchant config needs cleanup before writing artifacts

`Duplicate affiliate display rank`

- two merchants share the same Dutch ordering slot

`Duplicate pricing observation`

- one set and merchant pair was seeded more than once

`No valid price panel snapshot was produced`

- an enabled set has no eligible Dutch new-condition price data

`No valid affiliate offer snapshot was produced`

- an enabled set has no offer rows after merchant/config validation

`Generated commerce artifacts are stale`

- check mode found a meaningful artifact diff that should be reviewed

## 5. Rollback

If the generated artifacts are not acceptable:

1. Do not commit them.
2. Restore the generated files to the last known-good committed state.
3. Fix curation, pricing seeds, or merchant config before rerunning.

## 6. Readiness For Commerce Slice Changes

Only accept a reviewed-set slice expansion when:

- check mode is clean or the artifact diff is intentionally accepted
- the Dutch merchant allowlist is stable
- each enabled set has at least one useful price panel snapshot and at least one useful offer card
- the web build still succeeds with the current static route model
