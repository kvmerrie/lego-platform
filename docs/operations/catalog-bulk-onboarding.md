# Catalog Bulk Onboarding

Phase 1 is a backend-only intake flow for Rebrickable sets.

Phase 2 adds a thin admin/operator layer on top of the same engine.

It does one operator action for a fixed set list:

1. import missing sets into the canonical Brickhunt catalog
2. run seed generation for exactly those set ids
3. run seed validation for exactly those set ids
4. run scoped commerce sync for exactly those set ids
5. store a small report and gap-audit snapshot

This flow is intentionally small:

- no UI
- no scheduler
- no queue infra
- no parser changes

Phase 2 keeps those constraints:

- the engine is still file-backed
- the admin UI only starts and reads runs
- there is still no worker platform or DB-backed job state

## Command

```bash
pnpm nx run catalog-bulk-onboarding:run -- --set-ids 10316,21061,76437
```

Optional custom state file:

```bash
pnpm nx run catalog-bulk-onboarding:run -- --set-ids 10316,21061,76437 --state-file ./tmp/catalog-bulk-onboarding-state.json
```

## Required env

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REBRICKABLE_API_KEY`

## What gets stored

The command writes a small JSON state file.

Default path:

```text
tmp/catalog-bulk-onboarding-state.json
```

The state file stores:

- run id and requested set ids
- per-set processing state
- per-set import result
- aggregate summaries for generate, validate, sync, and snapshot
- readable catalog context such as set name and theme when available

Per-set processing states are operational only:

- `pending_import`
- `catalog_ready`
- `seed_generation_completed`
- `seed_validation_completed`
- `commerce_sync_completed`

This does not change coverage semantics.

## Restart behavior

The flow is restartable for the same set list.

If the same `set_ids` and `state_file` are used again:

- already imported sets are not imported again
- completed generate/validate/sync stages are skipped when they already cover the current ready set ids
- failed or incomplete import work is retried
- the final report and gap-audit snapshot are refreshed again

This keeps the flow reasonably idempotent without adding queue infrastructure.

## Admin flow

The admin surface now exposes the same flow at:

```text
/bulk-onboarding
```

The page lets an operator:

- search missing sets in the Rebrickable-backed add-set source
- multi-select a batch
- start one bulk onboarding run
- follow the latest or active run with stage summaries and per-set status
- quickly see which sets ended on full, partial, or failed coverage

The admin flow only wraps the existing engine. It does not duplicate the
business logic from import, seed generation, validation, or sync.

## Backend surface

The admin page talks to three small endpoints:

```text
POST /api/v1/admin/catalog/bulk-onboarding/runs
GET /api/v1/admin/catalog/bulk-onboarding/runs/latest
GET /api/v1/admin/catalog/bulk-onboarding/runs/:runId
```

They use the same state file as the CLI flow.

## Session behavior

The admin page keeps two small pieces of operator state in session storage:

- the current selection cart
- the active run id being watched

This is session-only convenience state. It does not change the onboarding
engine or coverage semantics.

## Operator output

The command logs:

- import counts
- generate counts
- validate counts
- scoped sync counts
- snapshot counts
- per-set processing state and current coverage snapshot

The admin page shows the same information in a compact operator view:

- import, generate, validate, sync, and snapshot stage summaries
- per-set import and processing state
- current coverage snapshot and missing merchants where available
- state file reference for the run being watched

## Notes

- Set import still uses the current Rebrickable-backed add-set flow.
- Seed generation, validation, and sync still use the existing write paths.
- Scoped sync still rewrites generated pricing and affiliate artifacts from the full current Supabase state after the scoped refresh, exactly like the normal scoped sync behavior.
- Run ids are still deterministic for the same normalized set list. Starting the
  same batch again reuses that run state instead of creating a separate job
  history record.
