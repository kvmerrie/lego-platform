# Supabase Clean Bootstrap

This runbook describes the clean rebootstrap path for a fresh Brickhunt Supabase environment.

It is intentionally opinionated:

- Supabase is the only catalog source of truth
- normalized theme identity is required
- snapshot artifacts may survive as build output only
- low-value legacy ballast should not be migrated by default

See also:

- [docs/architecture/catalog-supabase-first-migration.md](/Users/k40390/dev/lego-builder/docs/architecture/catalog-supabase-first-migration.md)
- [docs/operations/catalog-sync.md](/Users/k40390/dev/lego-builder/docs/operations/catalog-sync.md)
- [docs/operations/commerce-sync.md](/Users/k40390/dev/lego-builder/docs/operations/commerce-sync.md)

## Clean Target

The fresh environment should end up with:

- canonical catalog sets in Supabase
- normalized theme tables and mappings
- commerce backoffice tables for merchants, offer seeds, latest offer state, and benchmarks
- user tables for profiles, collection, wishlist, and wishlist alert state
- pricing daily history table so the existing sync and public history flows keep working

The fresh environment should **not** depend on:

- snapshot runtime identity
- local per-set prose
- overlay-as-second-catalog thinking
- stale latest-offer rows as bootstrap truth

## Carry-Forward Audit

### Must Migrate

| Domain                       | Why                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Canonical catalog sets       | Public web, admin, API, search, theme pages, and set detail all depend on this being complete.                     |
| Normalized source themes     | Needed for stable source-theme identity and parent-child theme hierarchy.                                          |
| Brickhunt primary themes     | Needed for theme pages, colors, navigation, and workbench grouping.                                                |
| Theme mappings               | Needed to normalize upstream themes like `Ultimate Collector Series -> Star Wars`.                                 |
| Commerce merchants           | Admin and sync flows depend on merchant identity and capability metadata.                                          |
| Commerce offer seeds         | This is the operational pricing source of truth that commerce sync refreshes.                                      |
| Commerce benchmark sets      | Workbench priority and benchmark workflows still use these.                                                        |
| Pricing daily history schema | Existing pricing sync and public history read paths expect the table to exist, even if we do not migrate old rows. |

### Should Migrate

| Domain                                                   | Why                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Active-but-invalid or stale offer seeds                  | They still represent operator work that should stay visible in admin.                                        |
| Inactive catalog sets                                    | Useful for duplicate prevention and historical operator context, but less critical than active catalog rows. |
| Inactive merchants                                       | Useful when merchants are temporarily paused rather than truly deleted.                                      |
| Profiles, collection, wishlist, and wishlist alert state | Product data worth preserving if the current pre-production accounts still matter.                           |

### Optional

| Domain                                    | Why                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Existing `pricing_daily_set_history` rows | Nice to keep for continuity, but not required for a clean restart because history will rebuild over time.    |
| Inactive offer seeds                      | Can be migrated if they contain useful merchant knowledge, but they are not required for the clean baseline. |

### Intentionally Leave Behind

| Domain                                     | Why                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Snapshot runtime identity                  | No longer the source of truth.                                                 |
| Local catalog prose and editorial remnants | Low-value, hand-maintained ballast.                                            |
| Snapshot/overlay merge behavior            | Transitional complexity we do not want to rebootstrap.                         |
| `commerce_offer_latest` rows               | Better rebuilt by a fresh `pnpm sync:commerce` run than copied as stale state. |
| Generated catalog artifacts as truth       | Keep only as build output if still useful.                                     |

## Recommended Bootstrap Order

### Step A. Create The Fresh Supabase Project

Create a brand-new staging-style or rehearsal Supabase project.
Do not reuse the current project in place.

### Step B. Apply The Clean Baseline Schema

Use:

- [supabase/bootstrap/brickhunt-clean-baseline.sql](/Users/k40390/dev/lego-builder/supabase/bootstrap/brickhunt-clean-baseline.sql)

This baseline deliberately replaces replaying the whole transitional migration chain.

Why:

- it creates `catalog_sets`, not `catalog_sets_overlay`
- it keeps normalized themes first-class from day one
- it avoids carrying transitional catalog columns into the clean environment
- it includes only the tables that still matter for current product behavior

Recommended treatment of the old migration chain:

- run the auth, wishlist, pricing-history, commerce backoffice, catalog overlay, and normalized-theme migrations only on the existing legacy environment
- do **not** replay them one by one on the clean environment unless you are deliberately rehearsing the old path

### Step C. Export A Clean Bootstrap Payload From The Current Source Environment

Use the new export tool:

```bash
pnpm nx run catalog-bootstrap:run -- --export ./tmp/brickhunt-clean-bootstrap.json
```

This payload intentionally exports only:

- canonical catalog sets
- normalized themes and mappings
- merchants
- benchmark sets
- offer seeds

It intentionally excludes:

- snapshot artifacts
- latest offers
- pricing history rows
- local catalog prose
- user data

That bias is deliberate: the payload is meant to establish a clean operational baseline, not to preserve every piece of old residue.

### Step D. Seed The Fresh Environment

Recommended import order:

1. `catalog_source_themes`
2. `catalog_themes`
3. `catalog_theme_mappings`
4. `catalog_sets`
5. `commerce_merchants`
6. `commerce_benchmark_sets`
7. `commerce_offer_seeds`

Use the bootstrap importer:

```bash
pnpm nx run catalog-bootstrap:run -- --import ./tmp/brickhunt-clean-bootstrap.json
```

Required env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The importer is idempotent and uses upserts.
It reports per-step `input_count`, `inserted_count`, and `updated_count`.

Optional verification:

```bash
pnpm nx run catalog-bootstrap:run -- --verify ./tmp/brickhunt-clean-bootstrap.json
```

Do **not** seed `commerce_offer_latest` as source truth.
Rebuild it afterward with:

```bash
pnpm sync:commerce
```

Do **not** seed snapshot artifacts as runtime truth.
If you still need generated artifacts for build-time, regenerate them from the clean environment with:

```bash
pnpm sync:catalog
```

### Step E. Rebuild Derived State

After seeding:

1. run `pnpm sync:catalog`
2. run `pnpm sync:commerce`

That gives the clean environment:

- generated snapshot artifacts derived from the new canonical source
- fresh `commerce_offer_latest` rows
- fresh pricing history points

## What We Can Skip Completely In The Clean Environment

- `catalog_sets_overlay` as the real persistence model
- legacy free-text `theme` as required catalog storage
- snapshot fallback for runtime set identity
- local per-set prose fields like `tagline`, `collectorAngle`, and `collectorHighlights`
- ad hoc snapshot plus overlay merge logic
- copying old `commerce_offer_latest` rows into the new environment

## Code And Runtime Assumptions To Update Before Final Cutover

The catalog write path now targets `catalog_sets` directly.
We no longer keep overlay-era write semantics around the admin add-set flow.

The remaining cleanup work is read-side and naming cleanup only:

- update canonical web reads that still carry overlay-oriented naming
- update catalog sync source reads that still mention overlay-era tables
- remove any remaining read-only helpers that still assume snapshot or overlay fallback semantics

Main repo locations:

- [libs/catalog/data-access-server/src/lib/catalog-data-access-server.ts](/Users/k40390/dev/lego-builder/libs/catalog/data-access-server/src/lib/catalog-data-access-server.ts)
- [libs/catalog/data-access-web/src/lib/catalog-effective-data-access-web.ts](/Users/k40390/dev/lego-builder/libs/catalog/data-access-web/src/lib/catalog-effective-data-access-web.ts)
- [libs/catalog/data-access-sync/src/lib/catalog-data-access-sync.ts](/Users/k40390/dev/lego-builder/libs/catalog/data-access-sync/src/lib/catalog-data-access-sync.ts)

That cleanup should happen **before** the fresh environment becomes the only long-lived runtime target.

## Files And Modules That Become Smaller Or Deletable After Cutover

After the clean environment is live and the runtime table rename is complete, these should shrink or disappear:

- [libs/catalog/data-access/src/lib/catalog-overlays.ts](/Users/k40390/dev/lego-builder/libs/catalog/data-access/src/lib/catalog-overlays.ts)
- [libs/catalog/data-access-sync/src/lib/catalog-sync-curation.ts](/Users/k40390/dev/lego-builder/libs/catalog/data-access-sync/src/lib/catalog-sync-curation.ts) can remain scope-only, not identity-bearing
- snapshot-first validation language in catalog sync docs
- any remaining overlay-oriented naming in canonical catalog code
- residual compatibility helpers that still assume snapshot or overlay fallback semantics

## Risk Control

### Data intentionally not carried forward

- old `commerce_offer_latest` rows
- local catalog prose and presentation ballast
- old pricing history rows unless explicitly chosen
- old test-user state unless explicitly chosen

### What must be validated first in the clean environment

1. Set detail
   Confirm best deal, merchant comparison, theme label, and basic set identity.
2. Theme page
   Confirm UCS-like sets land under the correct primary theme such as `Star Wars`.
3. Discover and homepage cards
   Confirm card identity and theme grouping come from the canonical catalog.
4. Search
   Confirm set lookup and shell suggestions resolve canonical set identity.
5. Admin workbench and add-set flow
   Confirm set lookup, coverage queue, and first-offer workflows still operate.
6. Offer comparison and best-deal visibility
   Confirm `sync:commerce` rebuilds fresh live state after seeding seeds only.

### First smoke tests after bootstrap

Run in this order:

1. `pnpm sync:catalog`
2. `pnpm sync:commerce`
3. public checks:
   - homepage
   - discover
   - a primary theme page
   - search
   - a set detail page with valid live offers
4. admin checks:
   - Workbench loads
   - Sets index loads
   - New set flow can add a set
   - offer seed dialog still works

## First Safe Support Pieces In This Repo

This pass adds:

- the clean baseline SQL at [supabase/bootstrap/brickhunt-clean-baseline.sql](/Users/k40390/dev/lego-builder/supabase/bootstrap/brickhunt-clean-baseline.sql)
- a clean bootstrap payload exporter via `catalog-bootstrap`

What it intentionally does **not** do yet:

- wipe an existing environment
- auto-import into a target environment
- switch runtime code to the clean table name in the same pass

That boundary is intentional. It keeps this step safe while still making the clean rebootstrap concrete and executable.

## Recommended Next Step After This Pass

Do one narrow follow-up implementation pass:

- rename runtime catalog table usage from `catalog_sets_overlay` to `catalog_sets`
- then add a target-environment importer that reads the exported bootstrap payload and seeds the fresh environment

That is the cleanest moment to stop carrying the old overlay naming without inventing another temporary compatibility layer.
