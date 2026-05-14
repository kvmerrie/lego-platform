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
pnpm sync:minifigs -- --limit 100
pnpm sync:minifigs -- --after-set-id 10316 --limit 100
```

Required environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REBRICKABLE_API_KEY`
- optional `REBRICKABLE_BASE_URL`
- optional `WEB_BASE_URL` and `WEB_REVALIDATE_SECRET` for targeted set page
  revalidation after write mode changes

Check mode reads Supabase and Rebrickable, reports drift, and writes nothing.
By default, check and write mode process a conservative batch of 100 sets. Do
not run a full all-set check casually; use `--all` only when you intentionally
want to query every catalog set.

Write mode upserts changed summaries only, so repeated runs are idempotent. If
a Rebrickable request fails for a set, the sync logs the failure count and does
not erase the existing summary.

Useful options:

- `--limit <n>`: process at most `n` sets. Default: 100.
- `--all`: process all selected sets.
- `--after-set-id <id>`: resume after the last processed catalog set id.
- `--set-id <id>` or `--set-ids <id,id>`: process specific sets only.
- `--only-missing`: skip sets that already have a summary row.
- `--request-delay-ms <n>`: delay between Rebrickable requests. Default: 750.
- `--max-retries <n>`: cap Rebrickable retry attempts. Retry-After is honored.

Recommended initial backfill:

```bash
pnpm sync:minifigs -- --limit 100
pnpm sync:minifigs -- --after-set-id <next_after_set_id> --limit 100
pnpm sync:minifigs -- --after-set-id <next_after_set_id> --limit 100
```

Use the `next_after_set_id` emitted at the end of each run as the next cursor.
For a safer interrupted restart, combine the cursor with `--only-missing`.

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
