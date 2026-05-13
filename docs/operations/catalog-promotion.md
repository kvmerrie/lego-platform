# Catalog Promotion Runbook

Catalog promotion copies the reviewed staging catalog state into production.
Staging is the source of truth for catalog curation. Production should not be
manually patched for public theme presentation except as an emergency rollback.

## Ownership

### Canonical/source-owned

Promoted from staging:

- `catalog_source_themes`: source ids, source names, parent source ids
- `catalog_theme_mappings`: source theme to public theme mapping
- `catalog_sets`: set ids, slugs, normalized names, theme ids, release metadata,
  image URL, source, status
- `catalog_themes`: id, slug, display name, status

### Curated/public presentation

Promoted from staging:

- `catalog_themes.public_display_name`
- `catalog_themes.public_description`
- `catalog_themes.public_image_url`
- `catalog_themes.public_accent_color`
- `catalog_themes.public_logo_url`
- `catalog_themes.public_order`
- `catalog_themes.is_public`

Blank staging presentation values do not overwrite existing non-blank production
values during updates. Fix curation in staging first, then promote again.

### Generated/runtime

Not manually promoted as source data:

- `catalog_theme_summaries` is refreshed by `refresh_catalog_theme_summaries()`
  after theme or set promotion.
- pricing history and latest offers are owned by feed jobs and `commerce-sync`.
- generated TypeScript artifacts are owned by their sync jobs.

## Preflight

Run from the repository root:

```sh
pnpm diagnose:catalog-promote
```

The diagnostic reads staging and production, then reports:

- theme, set, mapping, source-theme and summary counts
- public active theme counts
- changed curated theme presentation fields
- mapping/source/set parity differences
- first public themes as a quick visual sanity check

Do not promote if the diagnostic shows unexpected source or mapping drift.

## Promotion

1. Apply pending Supabase migrations to staging and production.
2. Deploy the API that contains the latest promote payload hardening.
3. Run `pnpm diagnose:catalog-promote`.
4. Call `POST /api/admin/promote/catalog` with `x-admin-secret`.
5. Confirm the response has `status: "ok"`.
6. Check the `revalidation` object. Successful promotion revalidates:
   - paths: `/`, `/themes`
   - tags: `homepage`, `themes`, `catalog`
   - reason: `catalog_promote`
7. If the response has `revalidationWarning`, retry public web revalidation or
   redeploy the web after confirming the promoted data is correct.
8. Run `pnpm diagnose:catalog-promote` again to confirm parity.

Promotion logs include one `[catalog-promotion] table promotion plan` entry per
table before writes. It summarizes inserted/updated rows, changed canonical
fields, changed curated fields, generated/runtime field changes, and skipped
protected fields.

## Revalidation

Catalog promotion owns public catalog/theme freshness. `commerce-sync` owns
commerce freshness.

- `promote/catalog`: `/`, `/themes`, tags `homepage`, `themes`, `catalog`
- `commerce-sync`: set/deal/price paths and tags for changed commerce data
- production web deploy: `/`, `/deals`, `/themes`, tags `homepage`, `deals`,
  `themes`

If a public theme detail page is stale after promotion, revalidate the specific
`/themes/<slug>` path manually. Broad theme detail revalidation is intentionally
not automatic until promote reports changed public theme slugs.

## Deployment

Production deploy routing is intentionally small:

- automatic deploy targets: `web`, `api`
- manual cron redeploys: commerce-sync, feed sync jobs, wishlist alerts
- web deployments should come from deploy hooks, not Vercel Git auto-deploys

Use workflow dispatch with `deploy_targets=web`, `api`, or `web,api` for manual
deploys. Pushes to `main` use affected routing.

## Known Risks

- Promote currently does not expose changed theme slugs, so only `/themes` is
  revalidated automatically.
- Schema comparison uses known promoted columns through Supabase APIs. Use
  Supabase SQL editor for full `information_schema` checks when investigating
  deeper schema drift.
- Commerce rows are included only for seed/merchant promotion safety. Latest
  offers and pricing are not owned by catalog promotion.
- See `docs/operations/production-lifecycle-verification.md` for the full
  staging -> promote -> deploy -> commerce-sync -> revalidation checklist.
