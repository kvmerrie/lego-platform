# Catalog Supabase-First Migration

This note defines the Phase 1 foundation for moving Brickhunt toward a single canonical catalog source.

## Goal

Brickhunt currently reads catalog identity from multiple places:

- generated snapshot artifacts in `libs/catalog/data-access`
- local catalog overlays in `libs/catalog/data-access/src/lib/catalog-overlays.ts`
- active overlay sets in Supabase

Phase 1 does **not** remove those layers yet.
It introduces a canonical read path that prefers Supabase-backed catalog identity first and falls back to the generated snapshot during transition.

## Target Canonical Catalog Model

The canonical set shape for migration is:

- `setId`
- `slug`
- `name`
- `primaryTheme`
- `secondaryLabels`
- `releaseYear`
- `pieceCount`
- `imageUrl`
- `source`
- `status`
- `sourceSetNumber`
- `createdAt`
- `updatedAt`

This shape is already represented in `CatalogCanonicalSet`.

## Phase 1 Read Rules

- Prefer active Supabase-backed catalog sets when a set exists there.
- Fall back to the generated snapshot when no Supabase-backed set exists yet.
- Keep snapshot and local overlay artifacts in place for now.
- Limit this phase to identity-level catalog reads such as id lookup, slug lookup, and basic set listing.

## Current Phase 1 Consumers

The canonical read layer now sits underneath:

- server-side catalog summary lookup
- server-side slug lookup
- web slug listing for static params
- web set lookup for public set identity

This keeps the current app stable while giving future phases one shared Supabase-first read contract to expand from.

## Later Cleanup Candidates

Later migration phases can progressively reduce or remove:

- direct snapshot-first identity reads in `libs/catalog/data-access`
- ad hoc overlay merge helpers in server and web layers
- local per-set overlay dependencies that are no longer product-critical
- generated snapshot identity as a primary runtime source
