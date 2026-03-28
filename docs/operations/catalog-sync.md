# Catalog Sync

This repository keeps runtime catalog reads static-friendly by generating local snapshot artifacts ahead of time. The web app reads those generated artifacts through `libs/catalog/data-access`; it does not call Rebrickable at request time.

See also:

- `docs/operations/catalog-sync-validation.md`

## Current Scope

- Source: Rebrickable
- Runtime path: `apps/catalog-sync`
- Server-only source logic: `libs/catalog/data-access-sync`
- Generated read artifacts:
  - `libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts`
  - `libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts`
- Local manual overlays remain in:
  - `libs/catalog/data-access/src/lib/catalog-overlays.ts`

## Required Environment Variables

- `REBRICKABLE_API_KEY`
  - Required.
  - Used by the server-side sync app when calling the Rebrickable API.

## Optional Environment Variables

- `REBRICKABLE_BASE_URL`
  - Optional.
  - Defaults to `https://rebrickable.com/api/v3`.
  - Useful only for testing against a proxy or mock server.

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

Check mode fetches the curated source records, builds the next snapshot in memory, and fails if the committed generated artifacts would change.

```bash
pnpm sync:catalog:check
```

Use this before overwriting artifacts when you want a safe drift check first.

## Operator Notes

- The current sync scope is intentionally small and curated.
- Only add sets to the curated sync list when they are also ready to be product-presented.
- When expanding coverage, update `libs/catalog/data-access-sync/src/lib/catalog-sync-curation.ts` and `libs/catalog/data-access/src/lib/catalog-overlays.ts` in the same change.
- Homepage featured-set curation remains local and is written into the generated manifest.
- Product-facing fields such as route slugs, display-name normalization, display-theme normalization, pricing posture, collector angle, tagline, availability, and highlights remain local overlays.
- The sync app validates overlay coverage, duplicate ids, duplicate source slugs, duplicate product slugs, source set numbers, manifest counts, and homepage-featured ids before writing artifacts.
- `pnpm sync:catalog` writes generated artifacts in place only when the rendered output actually changes.
- `pnpm sync:catalog:check` is the safer first step when reviewing upstream changes.
- Review the resulting diff before committing, especially:
  - `libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts`
  - `libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts`
  - any local overlay changes made alongside the sync
- The catalog test suite also checks that committed generated artifacts remain in canonical writer format, which helps catch accidental manual edits or formatter drift.
- This documentation only covers the technical workflow. Rebrickable licensing and usage terms still need separate manual review before production operations.
