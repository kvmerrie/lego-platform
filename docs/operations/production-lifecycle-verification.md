# Production Lifecycle Verification

Use this checklist after catalog, commerce, deploy, revalidation, or schema
stabilization changes. The goal is predictable staging -> production behavior,
not new product behavior.

## End-to-end Flow

1. Curate or fix data in staging.
2. Apply pending Supabase migrations to staging and production.
3. Deploy API if promote, schema, or revalidation code changed.
4. Run `pnpm diagnose:catalog-promote`.
5. Run `POST /api/admin/promote/catalog`.
6. Confirm the promote response has `status: "ok"`.
7. Confirm `revalidation` includes:
   - paths: `/`, `/themes`
   - tags: `homepage`, `themes`, `catalog`
   - reason: `catalog_promote`
8. Run `pnpm diagnose:catalog-promote` again.
9. Run `pnpm sync:commerce:local:check`.
10. If commerce artifacts are stale, run `pnpm sync:commerce`, review the
    generated artifact diff, commit, and manually redeploy the `commerce-sync`
    Render cron job if needed.
11. Deploy web/API through the Production Deploy Router only.
12. Verify public pages:
    - `/`
    - `/themes`
    - representative `/themes/<slug>`
    - `/deals`
    - representative `/sets/<slug>`

## Production Checklist

- API deploy is current and healthy.
- Web deploy is current and came from deploy hook routing.
- Supabase migrations have run on staging and production.
- `pnpm diagnose:catalog-promote` shows no unexpected source/mapping/set drift.
- Theme presentation parity is expected:
  - no missing public theme images unless intentionally unset
  - no missing public order
  - accent-color differences are reviewed as curation, not schema drift
- Promote response includes revalidation or an explicit `revalidationWarning`.
- Public web logs include successful `/api/revalidate` for `catalog_promote`.
- Homepage renders expected rails without empty/broken gaps.
- Theme directory tiles have images and expected styling.
- Deals rails do not show blind-bag/display-box fake spreads.
- Set detail pages show current offers and no stale promoted theme data.
- No missing design token symptoms:
  - CTA accent color present
  - theme tiles styled
  - card borders/surfaces visible
- GitHub deploy router selected only `web` and/or `api`.
- Cron jobs are not auto-deployed by the router.
- No failed Vercel/Render hooks remain unresolved.

## Public Web Diagnostics

Run:

```sh
pnpm diagnose:catalog-promote
```

The diagnostic is read-only. It reports:

- staging/production counts for themes, public themes, source themes, mappings,
  summaries, and active sets
- presentation completeness per environment
- changed curated theme presentation fields
- changed source/mapping/set/summary parity
- a compact preview of the first public themes

For public HTTP cache sanity, inspect headers:

```sh
curl -I https://www.brickhunt.nl/
curl -I https://www.brickhunt.nl/themes
curl -I https://www.brickhunt.nl/deals
```

Look for the current deploy/cache behavior and avoid judging only by a cached
HTML hit after a promote. Use `/api/revalidate` logs as the source of truth for
whether invalidation was requested.

## Theme Detail Freshness

`promote/catalog` always revalidates `/` and `/themes`. It also returns
`changedThemeSlugs` for public `catalog_themes` rows whose public presentation
or visibility changed, and the API revalidates those exact `/themes/<slug>`
paths.

Safety rule: targeted theme detail revalidation is capped at 50 paths. If more
public themes changed, the API keeps only `/` and `/themes` in the request and
logs `broad_theme_revalidation_fallback`. Do not manually invalidate every theme
detail page unless there is a confirmed public cache incident.

## Deployment Safety

Expected state:

- Vercel Git auto-deploy for `main` is disabled by `vercel.json`
  `git.deploymentEnabled.main=false`.
- Web deploys happen through `WEB_DEPLOY_HOOK_URL`.
- API deploys happen through `API_DEPLOY_HOOK_URL`.
- Manual workflow dispatch supports `environment=staging|production` and
  `deploy_targets=web`, `api`, or `web,api`.
- Affected routing deploys docs/tests-only changes nowhere.
- Affected routing fails safe to `api,web` only when detection is uncertain.
- `commerce-sync`, feed jobs, and wishlist alerts are manual cron redeploys.

## Schema Hardening Migrations

Recent hardening migrations:

- `20260513143000_catalog_theme_timestamp_hardening.sql`
- `20260513144000_catalog_theme_visibility_hardening.sql`
- `20260513145000_catalog_set_status_hardening.sql`
- `20260513150000_catalog_set_timestamp_hardening.sql`

They are intentionally non-destructive. They backfill nulls, set defaults,
enforce `NOT NULL`, and normalize explicit null payloads with triggers.

No production-only schema patching should be needed after these are applied.

## Commerce Quality Verification

Run:

```sh
pnpm sync:commerce:local:check
```

Healthy behavior:

- check mode writes nothing
- missing Supabase env fails clearly
- zero loaded rows fails clearly
- stale generated artifacts fail explicitly
- daily-history summary logs include:
  - `eligible_latest_offer_rows`
  - `trusted_offer_count`
  - `strategic_manual_offer_count`
  - `unit_type_counts`
  - `excluded_unit_mismatch_count`
  - `skipped_untrusted_merchant`
  - `skipped_unit_mismatch`

Trust checks:

- `blind_bag` and `display_box` are not compared as the same commercial unit.
- `strategic_manual` merchants can appear in comparison, but should not drive
  headline confidence.
- Unknown unit types should not create aggressive homepage/deals claims.
- Stale/error latest offers should not write daily headline history.

## Remaining Risks

- Commerce generated artifacts can drift whenever production latest offers
  change; this is expected until sync/check cadence is formalized.
- `public_accent_color` completeness is curation-dependent, not required for
  correctness.
- Full `information_schema` schema parity still needs SQL editor or direct
  database connection access; Supabase REST diagnostics cover promoted columns.
