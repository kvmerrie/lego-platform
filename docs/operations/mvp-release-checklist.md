# MVP Release Checklist

This checklist is the launch-oriented view of the current repository. It is intentionally narrower than the architecture docs and focuses on the minimum work needed to ship the current public LEGO collector slice with confidence.

Use this document alongside:

- `docs/operations/supabase-auth-foundation.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/catalog-sync-validation.md`
- `docs/operations/commerce-sync.md`
- `docs/operations/commerce-sync-validation.md`
- `docs/architecture/contentful-preview-usage.md`
- `docs/architecture/contentful-validation-rollout-checklist.md`

## Current MVP Scope

The current release scope includes:

- public homepage with editorial content plus featured sets
- public set-detail pages
- signed-in owned and wanted persistence
- compact signed-in collector profile editing
- snapshot-backed catalog, pricing, and affiliate guidance
- editorial Contentful support with preview routes

It does not include:

- admin launch requirements
- price history
- click tracking or redirect links
- alerts
- broader catalog browsing features
- multi-region commerce UI

## Environment Matrix

### Web

Required for the public web app itself:

- none beyond the normal Next runtime

Required to enable browser sign-in and saved collector state in the web UI:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required only if live editorial Contentful delivery is expected:

- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_DELIVERY_ACCESS_TOKEN`

Optional for live editorial delivery:

- `CONTENTFUL_ENVIRONMENT`
  - defaults to `master`

Required only if editorial preview is expected in the environment:

- `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
- `CONTENTFUL_PREVIEW_SECRET`

### API

Required:

- `SUPABASE_URL`
  - `apps/api` also accepts `NEXT_PUBLIC_SUPABASE_URL` as a fallback, but production should set `SUPABASE_URL` explicitly
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `HOST`
- `PORT`

### Catalog Sync

Required:

- `REBRICKABLE_API_KEY`

Optional:

- `REBRICKABLE_BASE_URL`

### Commerce Sync

Required:

- none for the current curated Dutch snapshot slice

Operator-reviewed local inputs still live in:

- `apps/commerce-sync/src/lib/commerce-sync-curation.ts`
- `libs/pricing/data-access-server/src/lib/pricing-reference-values.ts`
- `libs/pricing/data-access-server/src/lib/pricing-observation-seeds.ts`
- `libs/affiliate/data-access-server/src/lib/merchant-config.ts`

## Expected Runtime Validation

- `apps/api` now fails fast at startup if Supabase server configuration is missing.
- `apps/catalog-sync` fails fast if `REBRICKABLE_API_KEY` is missing.
- `apps/web` keeps browsing available when browser Supabase env vars are missing, but the auth surface disables sign-in and warns in the browser console.
- Contentful delivery and preview already follow the current documented fallback behavior:
  - delivery may fall back to mock editorial content
  - preview only falls back to mock content when no Contentful credentials exist at all

## Deploy Order

1. Confirm the intended launch content posture.
   - decide whether launch uses live Contentful delivery or mock editorial content
   - if live Contentful is expected, confirm homepage and `/pages/about` are published
2. Run artifact drift checks.
   - `pnpm sync:catalog:check`
   - `pnpm sync:commerce:check`
3. If launch data intentionally changed, regenerate and review artifacts before deploy.
   - `pnpm sync:catalog`
   - `pnpm sync:commerce`
4. Run the required build and test targets.
   - `pnpm nx run api:test`
   - `pnpm nx run user-data-access:test`
   - `pnpm nx run collection-data-access:test`
   - `pnpm nx run wishlist-data-access:test`
   - `pnpm nx run web:build`
   - `pnpm nx run api:build`
5. Deploy the API with valid Supabase server env vars.
6. Deploy the web app with the intended browser Supabase and Contentful env vars.
7. Run the smoke checks against the deployed or pre-production environment.

## Smoke Test Checklist

### Manual Commands

API health:

```bash
curl -sSf http://localhost:3333/health
```

Anonymous session route:

```bash
curl -sSf http://localhost:3333/api/v1/session
```

One set-detail page:

```bash
curl -sSf http://localhost:3000/sets/rivendell-10316
```

### Repeatable Helper

Use the small smoke helper when `web` and `api` are already running:

```bash
pnpm smoke:mvp
```

Optional overrides:

```bash
API_BASE_URL=https://api.example.com \
WEB_BASE_URL=https://www.example.com \
SET_DETAIL_PATH=/sets/rivendell-10316 \
SET_EXPECT_TEXT=Rivendell \
pnpm smoke:mvp
```

### UI Smoke Pass

Check these product states before launch:

1. Homepage renders with shell, editorial content, and featured sets.
2. `/pages/about` renders correctly if live Contentful delivery is enabled.
3. One commerce-enabled set-detail page renders:
   - catalog detail
   - pricing panel
   - affiliate offers
   - auth card
   - profile card after sign-in
   - owned and wanted toggles
4. One non-commerce-enabled set-detail page renders compact unavailable commerce states, not broken gaps.
5. Anonymous owned or wanted action attempts show a clear sign-in-to-save message.
6. Email sign-in flow starts successfully.
7. After sign-in, session state refreshes and profile editing works.
8. After sign-out, the session returns to anonymous state cleanly.

## Release Data Review

Before release, manually review:

- current homepage featured set list
- all public catalog set slugs in the current snapshot
- current commerce-enabled set scope
- pricing reference values
- merchant CTA and disclosure wording
- collector-facing overlay copy in the catalog domain

## Rollback Guidance

If the release is not acceptable:

1. Stop and identify whether the issue is:
   - configuration
   - generated artifact drift
   - editorial content
   - Supabase auth behavior
   - web rendering only
2. If the issue is generated data:
   - revert the generated catalog or commerce artifacts to the last known good commit
   - rerun `pnpm sync:catalog:check` and `pnpm sync:commerce:check`
3. If the issue is editorial only:
   - revert the Contentful entry changes or temporarily remove live Contentful delivery env vars to fall back to mock editorial content
4. If the issue is auth or persistence:
   - verify Supabase env vars first
   - if necessary, roll back the API deployment while keeping the public web slice browseable
5. Re-run:
   - `pnpm nx run web:build`
   - `pnpm nx run api:build`
   - `pnpm smoke:mvp`

## Launch Gate

The MVP is ready when all of these are true:

- required env vars are present in the target environment
- sync artifacts are clean or intentionally updated and reviewed
- `web:build` passes
- `api:build` passes
- smoke checks pass
- the current launch data and editorial content have been manually accepted
