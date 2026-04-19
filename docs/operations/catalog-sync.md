# Catalog Sync

This repository keeps runtime catalog reads static-friendly by generating local snapshot artifacts ahead of time. The web app reads those generated artifacts through `libs/catalog/data-access`; it does not call Rebrickable at request time.

See also:

- `docs/architecture/catalog-supabase-first-migration.md`
- `docs/operations/supabase-clean-bootstrap.md`
- `docs/operations/catalog-sync-validation.md`
- `docs/operations/mvp-operator-troubleshooting.md`

## Current Scope

- Source: Supabase-first canonical catalog
- Runtime path: `apps/catalog-sync`
- Server-only source logic: `libs/catalog/data-access-sync`
- Generated read artifacts:
  - `libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts`
  - `libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts`
- Transitional local files that still exist during migration:
  - `libs/catalog/data-access-sync/src/lib/catalog-sync-curation.ts`
  - `libs/catalog/data-access/src/lib/catalog-overlays.ts`

What this means now:

- Supabase-backed canonical catalog data is the primary sync source.
- The generated snapshot is still emitted for static-friendly downstream reads.
- The committed snapshot remains a fallback source during migration when a row is not yet present in Supabase.
- Local curation still defines the sync scope and homepage featured ids, but it is no longer the authoritative source for set identity fields inside the generated snapshot.

## Required Environment Variables

- `SUPABASE_URL`
  - Required.
  - Used by the server-side sync app when reading the canonical catalog source.
- `SUPABASE_SERVICE_ROLE_KEY`
  - Required.
  - Used by the server-side sync app when reading the canonical catalog source.

Example boilerplate:

- `.env.sync.example`

## Optional Environment Variables

- `REBRICKABLE_API_KEY`
  - Optional for catalog sync itself.
  - Still used by adjacent add-set and theme-backfill flows outside the snapshot generator.
- `REBRICKABLE_BASE_URL`
  - Optional.
  - Useful only for testing those Rebrickable-backed enrichment flows against a proxy or mock server.

## Run The Sync

From the workspace root:

```bash
pnpm sync:catalog
```

Or directly:

```bash
pnpm nx run catalog-sync:run
```

## Check Mode

Check mode reads the canonical catalog source from Supabase, builds the next snapshot in memory, and fails if the committed generated artifacts would change.

```bash
pnpm sync:catalog:check
```

Use this before overwriting artifacts when you want a safe drift check first.

## Local Deterministic Check

Local check mode does not call Supabase or Rebrickable. It validates the committed generated artifacts against:

- the canonical generated-module format
- the current catalog sync scope
- the current homepage featured set ids
- duplicate ids and slug invariants

```bash
pnpm sync:catalog:local:check
```

Use this in git hooks and routine local validation when you want a fast deterministic guard with no network dependency.

## Operator Notes

- The current sync scope is intentionally small and curated.
- Only add sets to the curated sync scope when they are also ready to be product-presented.
- When expanding coverage, first ensure the set exists in the canonical Supabase catalog source. Then update `libs/catalog/data-access-sync/src/lib/catalog-sync-curation.ts` only if that set should join the generated snapshot scope right now.
- Homepage featured-set curation remains local and is written into the generated manifest.
- Local overlays are no longer the authoritative source for synced set identity, but they still influence older snapshot-backed product presentation paths during migration.
- The sync app validates duplicate ids, duplicate source slugs, duplicate product slugs, source set numbers, manifest counts, and homepage-featured ids before writing artifacts.
- `pnpm sync:catalog` writes generated artifacts in place only when the rendered output actually changes.
- `pnpm sync:catalog:local:check` is the fast deterministic local guard.
- `pnpm sync:catalog:check` is now the source-backed Supabase drift check.
- Review the resulting diff before committing, especially:
  - `libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts`
  - `libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts`
  - any intentional sync-scope or homepage-featured changes made alongside the sync
- The catalog test suite also checks that committed generated artifacts remain in canonical writer format, which helps catch accidental manual edits or formatter drift.
- Canonical writer format means a TypeScript module that stores the generated JSON in a `String.raw` template payload and exports it through `JSON.parse(...)`. Do not hand-convert these files into plain object-literal style.
- This documentation only covers the technical workflow. Rebrickable licensing and usage terms still need separate manual review for the separate enrichment flows that still use that API.

## Production Scheduling

Catalog sync is safe to run repeatedly in production.

Why it is idempotent:

- generated artifacts are deterministic for a given canonical catalog state
- the sync writer only overwrites artifact files when the rendered output actually changes
- repeated runs with unchanged canonical source data keep the same committed artifact shape

Recommended production schedule:

- once per day

Recommended Render scheduled job command:

```bash
pnpm sync:catalog
```

Render scheduled job notes:

- run this as a scheduled background job, not as an always-on service
- keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` scoped to the scheduled job only
- use `pnpm sync:catalog:local:check` in local hooks or fast local review
- use `pnpm sync:catalog:check` manually or in CI when you want a source-backed drift review without writing artifacts
- a healthy scheduled job should log one `start` line and one `end` line with scoped set counts; if it never reaches `end`, treat the run as failed and inspect Render logs before retrying

## Troubleshooting Notes

Use `docs/operations/mvp-operator-troubleshooting.md` for the fast triage flow.

Common catalog sync interpretations:

- `Generated catalog artifacts are stale` means drift was detected and needs review; it is not a signal to bypass check mode
- missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is a scheduled-job or operator-shell env issue
- sync-source validation failures usually mean the canonical catalog source is incomplete for the configured sync scope and should be fixed before writing new artifacts
