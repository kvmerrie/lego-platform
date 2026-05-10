# Catalog Events Retention

`catalog_user_events` stores anonymous raw interaction events for short-term product learning and debugging. It must stay raw only temporarily.

## Policy

- Raw catalog events are retained for 90 days.
- The cleanup job deletes rows where `created_at` is older than the 90-day cutoff.
- The job does not vacuum, aggregate, or rebuild derived data.
- Popularity features use the separate generated snapshot from `pnpm sync:catalog-popularity`, not long-lived raw event scans.

## Scheduled Job

Use a Render scheduled job:

```bash
pnpm cleanup:catalog-events
```

Recommended schedule:

- once per day

Required env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

A healthy run logs:

- one `start` line with `retention_days`
- one `end` line with `cutoff`, `deleted_rows`, and `duration_ms`

If the job fails, inspect the Render logs before retrying. The cleanup is intentionally simple: delete old raw rows and stop.
