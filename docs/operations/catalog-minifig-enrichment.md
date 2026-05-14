# Catalog Minifig Enrichment

Brickhunt keeps Rebrickable minifigure data as generated enrichment, separate
from canonical catalog rows and separate from staging-owned curated
presentation fields.

## What It Stores

- `catalog_set_minifig_summaries` stores one aggregate row per catalog set.
- `minifig_count` is the total included minifigure quantity for the set.
- `source_minifig_count` preserves the distinct source count reported by
  Rebrickable when available.
- `catalog_set_minifigs` is present for future normalized minifigure records,
  but the MVP does not populate character/image/detail data yet.

Missing summaries mean unknown. Explicit `minifig_count = 0` means Rebrickable
currently reports no minifigures for that set.

## Sync Commands

```bash
pnpm sync:minifigs:check
pnpm sync:minifigs
```

Required environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REBRICKABLE_API_KEY`
- optional `REBRICKABLE_BASE_URL`
- optional `WEB_BASE_URL` and `WEB_REVALIDATE_SECRET` for targeted set page
  revalidation after write mode changes

Check mode reads Supabase and Rebrickable, reports drift, and writes nothing.
Write mode upserts changed summaries only, so repeated runs are idempotent.
If a Rebrickable request fails for a set, the sync logs the failure count and
does not erase the existing summary.

## Revalidation

When write mode changes a set summary, the sync revalidates only the affected
set detail paths:

- `/sets/<slug>`
- `set:<set_id>`
- `set:<slug>`

Homepage, deals, and theme pages are not revalidated because they do not use
minifigure counts today.

## Ownership

Minifigure enrichment syncs per environment from Rebrickable. It is not part of
`promote/catalog`, and production should not be patched manually outside the
sync unless a production incident requires an explicit reviewed SQL fix.
