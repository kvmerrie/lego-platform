# Catalog Promotion Runbook

Catalog promotion copies canonical staging catalog data into production.
Production owns public theme presentation. Staging defaults must not reset
production-curated theme imagery, colors, labels, visibility, ordering, or
status for existing theme rows.

Public web theme presentation reads from `catalog_themes`. Frontend code must
not carry theme-specific presentation maps for public theme names, descriptions,
images, logos, accent colors, visibility, ordering, or status. Generic UI
fallbacks are allowed only when data is absent, for example using `display_name`
when `public_display_name` is empty or using a representative set image when
`public_image_url` is empty.

Homepage theme card ordering is also Supabase-owned through
`catalog_themes.public_homepage_order`. Public web must not hardcode the
homepage theme sequence.

## Ownership

### Canonical/source-owned

Promoted from staging:

- `catalog_source_themes`: source ids, source names, parent source ids
- `catalog_theme_mappings`: source theme to public theme mapping
- `catalog_sets`: set ids, slugs, normalized names, theme ids, release metadata,
  image URL, source, status
- `catalog_themes`: stable theme id for existing rows. New theme rows are
  inserted from staging with staging values as initial defaults.

Generated enrichment promoted from staging:

- `catalog_set_minifig_summaries`: one aggregate minifigure count per set,
  keyed by `set_id`
- `catalog_set_images`: set image metadata only, keyed by
  `set_id,image_type,sort_order`. Promotion copies production-bucket URLs and
  storage paths, but never uploads, deletes, or duplicates Supabase Storage
  objects. The canonical bucket remains `catalog-set-images`.

### Production-owned public presentation

Preserved in production for existing `catalog_themes` rows:

- `catalog_themes.slug`
- `catalog_themes.display_name`
- `catalog_themes.public_display_name`
- `catalog_themes.public_description`
- `catalog_themes.public_image_url`
- `catalog_themes.public_accent_color`
- `catalog_themes.public_surface_color`
- `catalog_themes.public_surface_text_color`
- `catalog_themes.public_hero_text_color`
- `catalog_themes.public_logo_url`
- `catalog_themes.public_homepage_order`
- `catalog_themes.public_order`
- `catalog_themes.is_public`
- `catalog_themes.status`

Staging values are used only when inserting a new production theme row. Existing
production theme presentation is intentionally not overwritten by staging,
including non-blank staging defaults. If a production theme image or public
label needs to change, update production curation through the admin-owned
curation path rather than relying on catalog promotion.

Admin editing for these presentation fields is still intentionally minimal.
Until a dedicated compact editor exists, use reviewed SQL/admin operations and
then revalidate `/` and `/themes`. Do not make one-off frontend fallback maps to
paper over missing curation data.

Emergency recovery for accidentally overwritten presentation fields should only
touch presentation columns. Example shape:

```sql
update catalog_themes
set
  public_image_url = values.public_image_url,
  public_accent_color = values.public_accent_color,
  public_surface_color = values.public_surface_color,
  public_surface_text_color = values.public_surface_text_color,
  public_hero_text_color = values.public_hero_text_color,
  public_display_name = values.public_display_name,
  public_description = values.public_description,
  public_logo_url = values.public_logo_url,
  public_homepage_order = values.public_homepage_order,
  public_order = values.public_order,
  is_public = values.is_public,
  status = values.status,
  updated_at = timezone('utc', now())
from (
  values
    (
      'theme:super-mario',
      'https://cdn.example.com/mario-curated.jpg',
      '#e52521',
      '#d85a50',
      '#ffffff',
      '#ffffff',
      'LEGO Super Mario',
      'Production curated copy',
      null,
      35,
      5,
      true,
      'active'
    )
) as values(
  id,
  public_image_url,
  public_accent_color,
  public_surface_color,
  public_surface_text_color,
  public_hero_text_color,
  public_display_name,
  public_description,
  public_logo_url,
  public_homepage_order,
  public_order,
  is_public,
  status
)
where catalog_themes.id = values.id;
```

### Generated/runtime

Not manually promoted as source data:

- `catalog_theme_summaries` is refreshed by `refresh_catalog_theme_summaries()`
  after theme or set promotion.
- detailed `catalog_set_minifigs` rows are not promoted yet.
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
- `catalog_set_images` row counts, active hero/gallery/social counts, affected
  set count, and staging-vs-production metadata drift
- first public themes as a quick visual sanity check

Do not promote if the diagnostic shows unexpected source or mapping drift.

## Promotion

1. Apply pending Supabase migrations to staging and production.
2. Deploy the API that contains the latest promote payload hardening.
3. Run `pnpm diagnose:catalog-promote`.
4. Call `POST /api/admin/promote/catalog` with `x-admin-secret`.
5. Confirm the response has `status: "ok"`.
6. Check the `revalidation` object. Successful promotion revalidates:
   - paths: `/`, `/themes`, plus targeted `/themes/<slug>` paths for changed
     public theme presentation rows, plus targeted `/sets/<slug>` paths for
     promoted set metadata when the affected set count is small
   - tags: `homepage`, `themes`, `catalog`, `sets`, and affected `set:<setId>`
     tags for promoted metadata rows
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

- `promote/catalog`: `/`, `/themes`, targeted changed public
  `/themes/<slug>` paths, targeted `/sets/<slug>` paths for small metadata
  batches, tags `homepage`, `themes`, `catalog`, `sets`, and affected
  `set:<setId>` tags
- `commerce-sync`: set/deal/price paths and tags for changed commerce data
- production web deploy: `/`, `/deals`, `/themes`, tags `homepage`, `deals`,
  `themes`

Theme detail paths are intentionally targeted. Promotion collects changed public
theme slugs only when public presentation or visibility changes. If more than 50
public theme detail paths would be revalidated, the API skips the slug paths,
keeps `/` and `/themes`, and logs `broad_theme_revalidation_fallback`. This
avoids invalidating every theme page during large catalog operations.

Set detail metadata paths are also targeted. If more than 25 affected set paths
would be revalidated, the API skips explicit set paths and relies on tags. The
revalidation sender batches payloads, so large image-metadata promotes do not
exceed the public web path batch limit.

## Deployment

Production deploy routing is intentionally small:

- automatic deploy targets: `web`, `api`
- manual cron redeploys: commerce-sync, feed sync jobs, wishlist alerts
- web deployments should come from deploy hooks, not Vercel Git auto-deploys

Use workflow dispatch with `deploy_targets=web`, `api`, or `web,api` for manual
deploys. Pushes to `main` use affected routing.

## Known Risks

- Schema comparison uses known promoted columns through Supabase APIs. Use
  Supabase SQL editor for full `information_schema` checks when investigating
  deeper schema drift.
- Commerce rows are included only for seed/merchant promotion safety. Latest
  offers and pricing are not owned by catalog promotion.
- See `docs/operations/production-lifecycle-verification.md` for the full
  staging -> promote -> deploy -> commerce-sync -> revalidation checklist.
