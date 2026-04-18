# Catalog Supabase-First Migration

This note defines the migration direction for moving Brickhunt toward a single canonical catalog source in Supabase.

## Goal

Brickhunt currently resolves catalog data from multiple layers:

- generated snapshot artifacts in `libs/catalog/data-access`
- local catalog overlays in `libs/catalog/data-access/src/lib/catalog-overlays.ts`
- active overlay sets in Supabase

Phase 1 introduced a canonical **read layer** that prefers Supabase-backed catalog identity first and falls back to the generated snapshot during transition.

The next migration steps must build on the right target data model.
That means theme identity can no longer be modeled as one ambiguous free-text `theme` field on each set.

## Core Theme Modeling Rule

We need to separate:

- upstream/source theme identity
- Brickhunt primary theme identity

Examples:

- `Ultimate Collector Series` is a source theme or subtheme
- `Star Wars` is the Brickhunt primary theme

Those are not the same thing and should not live in one overloaded string column.

## Target Persistence Model

### `catalog_sets`

Canonical set identity.

- `set_id`
- `slug`
- `name`
- `source_theme_id`
- `primary_theme_id`
- `release_year`
- `piece_count`
- `image_url`
- `source`
- `status`
- `source_set_number`
- `created_at`
- `updated_at`

Rules:

- `source_theme_id` points to the upstream theme node used for this set
- `primary_theme_id` points to the Brickhunt navigation theme
- no free-text `theme` column is required in the end-state

### `catalog_source_themes`

Upstream theme tree, for example Rebrickable themes.

- `id`
- `source_system`
- `source_theme_name`
- `parent_source_theme_id`
- `created_at`
- `updated_at`

Rules:

- this stores the original upstream theme graph
- `parent_source_theme_id` lets us preserve source hierarchies like `Star Wars -> Ultimate Collector Series`
- one row should represent one upstream theme identity, not one set-specific copy

### `catalog_themes`

Brickhunt primary navigation themes.

- `id`
- `slug`
- `display_name`
- `status`
- `created_at`
- `updated_at`

Rules:

- this is the controlled Brickhunt theme vocabulary
- examples: `Star Wars`, `Marvel`, `Ideas`, `Art`
- these drive navigation, public theme pages, colors, and workbench grouping

### `catalog_theme_mappings`

Mapping from upstream theme identities to Brickhunt primary themes.

- `source_theme_id`
- `primary_theme_id`

Rules:

- one upstream theme resolves to one Brickhunt primary theme
- this is where we express rules like `Ultimate Collector Series -> Star Wars`
- the mapping is explicit data, not only code behavior

## Optional Secondary Labels

We do **not** need to overbuild this in the next step.

If we want subthemes or secondary labels later, the lightest clean option is:

- derive them from `catalog_source_themes`
- optionally expose them through a small read model

That means we do **not** need a separate persistent `secondary_labels` field on `catalog_sets` as a required part of the core schema.

## Transitional Read Model vs Target Persistence Model

The current `CatalogCanonicalSet` read shape still includes:

- `primaryTheme`
- `secondaryLabels`

That is acceptable as a **transitional read DTO**.
It is not the target persistence schema.

During migration:

- persistence should move toward theme IDs and joins
- read models may continue to expose resolved strings for app consumers

## Table Responsibilities

### `catalog_sets`

Owns:

- stable set identity
- routing identity
- source/status metadata
- foreign keys to theme identity

Does not own:

- free-text upstream theme names
- Brickhunt theme display rules
- pricing or commerce state

### `catalog_source_themes`

Owns:

- upstream theme names
- upstream theme hierarchy
- source-system provenance

Does not own:

- public Brickhunt navigation identity

### `catalog_themes`

Owns:

- Brickhunt’s controlled primary theme vocabulary
- public theme slugs and display names

Does not own:

- upstream theme tree details

### `catalog_theme_mappings`

Owns:

- normalization from upstream theme identity to Brickhunt primary theme identity

Does not own:

- set records themselves

## Mapping From Current System To Target

### Current overlay `theme`

Current state:

- `catalog_sets_overlay.theme` stores one already-normalized string
- for example `Star Wars` or `The Legend of Zelda`

Target state:

- replace this with `source_theme_id` + `primary_theme_id`
- the old `theme` string becomes temporary migration data only

### Current `resolveCatalogThemeIdentity(...)`

Current state:

- takes `rawTheme`
- optionally takes `parentTheme`
- returns:
  - `primaryTheme`
  - `secondaryThemes`

Target state:

- use upstream theme data to populate `catalog_source_themes`
- use mapping data in `catalog_theme_mappings` to resolve `primary_theme_id`
- keep `resolveCatalogThemeIdentity(...)` as a migration/backfill/read helper until the DB mapping fully takes over

### Current Rebrickable parent/child handling

Current state:

- parent-child relationships are resolved on the fly
- example:
  - parent theme: `Star Wars`
  - raw theme: `Ultimate Collector Series`
  - output primary theme: `Star Wars`
  - output secondary label: `Ultimate Collector Series`

Target state:

- `catalog_source_themes`
  - one row for `Star Wars`
  - one row for `Ultimate Collector Series`
  - `Ultimate Collector Series.parent_source_theme_id -> Star Wars`
- `catalog_themes`
  - one row for `Star Wars`
- `catalog_theme_mappings`
  - `Ultimate Collector Series -> Star Wars`
  - optionally also `Star Wars -> Star Wars`
- `catalog_sets`
  - set stores `source_theme_id = Ultimate Collector Series`
  - set stores `primary_theme_id = Star Wars`

## Example: Millennium Falcon

Set:

- `75192 Millennium Falcon`

Source truth:

- `source_set_number`: `75192-1`
- source theme name: `Ultimate Collector Series`
- upstream parent source theme: `Star Wars`

Target records:

### `catalog_source_themes`

- `rstw`
  - `source_system = 'rebrickable'`
  - `source_theme_name = 'Star Wars'`
  - `parent_source_theme_id = null`
- `rucs`
  - `source_system = 'rebrickable'`
  - `source_theme_name = 'Ultimate Collector Series'`
  - `parent_source_theme_id = rstw`

### `catalog_themes`

- `th_star_wars`
  - `slug = 'star-wars'`
  - `display_name = 'Star Wars'`

### `catalog_theme_mappings`

- `rucs -> th_star_wars`

### `catalog_sets`

- `set_id = '75192'`
- `slug = 'millennium-falcon-75192'`
- `name = 'Millennium Falcon'`
- `source_theme_id = rucs`
- `primary_theme_id = th_star_wars`
- `source_set_number = '75192-1'`

Result:

- the set appears under the `Star Wars` theme page
- `Ultimate Collector Series` stays available as source/subtheme context
- navigation does not fragment around UCS as if it were a top-level theme

## Updated Migration Plan

### Phase 1

Completed foundation:

- canonical read layer exists
- Supabase-first catalog identity reads are in place with snapshot fallback

Correction for Phase 1:

- the target theme model is now explicitly normalized
- `CatalogCanonicalSet.primaryTheme` remains a transitional read field, not the persistence target

### Phase 2

Introduce normalized theme tables and mappings.

Scope:

- add `catalog_source_themes`
- add `catalog_themes`
- add `catalog_theme_mappings`
- extend `catalog_sets_overlay` or the future `catalog_sets` table with:
  - `source_theme_id`
  - `primary_theme_id`
- backfill from current `theme` plus `resolveCatalogThemeIdentity(...)`

Important:

- do this as additive migration work
- keep the current free-text `theme` column temporarily for compatibility while dual-reading or dual-writing

### Phase 3

Move canonical catalog reads onto the normalized theme-backed model.

Scope:

- canonical set reads resolve theme identity by join instead of raw `theme` strings
- snapshot remains only as derived fallback where still needed
- app read DTOs can continue to expose `primaryTheme` strings, but they should come from `catalog_themes`

### Later Phases

- remove transitional free-text `theme` dependency from Supabase catalog rows
- reduce snapshot/local catalog identity responsibilities further
- decide whether snapshot remains only as a derived build artifact or can disappear completely

## Minimal Recommended Next Step

The first implementation step after this design pass should be:

1. add normalized theme tables as additive schema
2. keep the existing set table untouched except for additive nullable FK columns
3. write one backfill path that:
   - reads current `theme`
   - derives `source_theme_id`
   - derives `primary_theme_id`
   - stores both alongside the legacy `theme` column

That is the smallest safe move because it:

- preserves current reads
- makes the theme model explicit in Supabase
- gives future phases real relational data to migrate onto
- avoids another round of theme logic being hardcoded only in app code
