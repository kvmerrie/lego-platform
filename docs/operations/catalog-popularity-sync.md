# Catalog Popularity Sync

`catalog-popularity-sync` builds an offline generated snapshot from anonymous raw `catalog_user_events`.

The snapshot is intentionally precomputed. Public pages must not aggregate raw events at request time.

## Inputs

- `set_view`
- `catalog_set_click`
- `offer_click`

Rows without `set_num` are ignored. Events are deduplicated per `session_id`, `set_num`, and `event_type` inside each aggregation window so one session cannot inflate a set by repeating the same action.

A set is only written when it reaches both the score threshold and at least two unique sessions in that window. This keeps one browser or test session from becoming “populariteit”.

## Output

The job writes:

```text
libs/catalog/data-access/src/lib/catalog-popularity-snapshot.generated.ts
```

The artifact contains 24-hour and 7-day windows with at most 100 sets per window. Raw events stay temporary: long-term popularity, trending rails, or reports should read future aggregate snapshots, not the raw events table.

## Run

```bash
pnpm sync:catalog-popularity
pnpm sync:catalog-popularity:check
```

Required env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The job logs item counts for both windows and fails if the 7-day raw event scan exceeds the current fail-safe row limit.
