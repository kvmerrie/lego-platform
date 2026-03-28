# Catalog Sync

This repository keeps runtime catalog reads static-friendly by generating local snapshot artifacts ahead of time. The web app reads those generated artifacts through `libs/catalog/data-access`; it does not call Rebrickable at request time.

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

## Operator Notes

- The current sync scope is intentionally small and curated.
- Homepage featured-set curation remains local and is written into the generated manifest.
- Collector-facing fields such as pricing posture, collector angle, tagline, availability, and highlights remain local overlays.
- The sync app writes generated artifacts in place. Review the resulting diff before committing.
- This documentation only covers the technical workflow. Rebrickable licensing and usage terms still need separate manual review before production operations.
