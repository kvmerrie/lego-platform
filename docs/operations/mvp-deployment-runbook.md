# MVP Deployment Runbook

This document describes the smallest reliable deployment setup for the current LEGO collector MVP. It is the provider-specific companion to:

- `docs/operations/mvp-release-checklist.md`
- `docs/operations/mvp-production-rollout-checklist.md`
- `docs/operations/supabase-auth-foundation.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/catalog-sync-validation.md`
- `docs/operations/commerce-sync.md`
- `docs/operations/commerce-sync-validation.md`
- `docs/operations/pricing-history.md`
- `docs/architecture/contentful-preview-usage.md`
- `docs/architecture/contentful-validation-rollout-checklist.md`

The deployment model stays intentionally small:

- `apps/web` on Vercel
- `apps/api` on Render
- Supabase hosted for auth and Postgres
- Contentful managed for editorial content
- `catalog-sync` and `commerce-sync` as operator or CI jobs, not always-on services

Tracked example env boilerplate files at the repo root:

- `.env.web.example`
- `.env.api.example`
- `.env.sync.example`

## Current Deployment Shape

- The public web app stays static-friendly and continues to read catalog, pricing, and affiliate data from committed generated artifacts.
- The web app proxies `/api/:path*` through `API_PROXY_TARGET`, so the deployed web app and deployed API may live on separate hosts without changing the browser-facing route contract.
- `apps/api` remains the auth-verification and persistence boundary.
- Contentful remains editorial-only. Core catalog, pricing, and affiliate runtime behavior does not depend on CMS uptime.

## Provider Setup

### Vercel For `apps/web`

Use one Vercel project for the public web app.

Recommended settings:

- framework: Next.js
- root directory: repository root
- install command: `pnpm install --frozen-lockfile`
- build command: `pnpm nx run web:build`

Required deployment note:

- `API_PROXY_TARGET` must point at the deployed API host, because the web app currently rewrites `/api/:path*` requests through that environment variable.

Recommended environment split:

- Preview deployments use staging API, staging Supabase browser keys, and either staging Contentful or mock editorial posture.
- Production deployment uses production API, production Supabase browser keys, and production Contentful delivery.

Production guardrails:

- only browser-safe `NEXT_PUBLIC_*` Supabase values belong in Vercel
- do not copy `SUPABASE_SERVICE_ROLE_KEY` into Vercel
- keep production Contentful unset entirely if launch is still using mock editorial posture

### Render For `apps/api`

Use one Render web service for the Fastify BFF.

Recommended settings:

- runtime: Node
- root directory: repository root
- build command: `pnpm install --frozen-lockfile && pnpm nx run api:build`
- start command: `node dist/apps/api/main.js`

Recommended service settings:

- set `HOST=0.0.0.0`
- let Render provide `PORT`
- enable automatic deploys from the protected release branch only after staging rehearsal is trusted

### Render Scheduled Jobs

Use Render scheduled jobs for the current sync automation layer instead of adding workers or always-on background services.

Recommended production jobs:

- `commerce-sync-production`
  - schedule: every 6 hours
  - command: `pnpm sync:commerce`
- `catalog-sync-production`
  - schedule: once per day
  - command: `pnpm sync:catalog`

Recommended guardrails:

- keep each sync secret only on the scheduled job that needs it
- do not add sync write commands to the always-on API service
- use the same repository root and install strategy as the normal Render API build setup

### Supabase

Use two hosted Supabase projects:

- staging
- production

Keep the MVP setup minimal:

- apply `supabase/migrations/20260328223000_initial_auth_foundation.sql`
- apply `supabase/migrations/20260329134500_pricing_daily_set_history.sql`
- enable the chosen email auth method
- configure site URL and redirect URLs for staging and production web hosts

Production auth guardrail:

- make the production site URL and redirect URLs point only at the production web origin before launch day

### Contentful

Use one managed Contentful space with separate environments where possible:

- `staging`
- `master`

Minimum launch content posture:

- homepage entry is published
- `/pages/about` entry is published
- preview secrets are configured only in environments where editorial preview is intentionally supported

## Environment Matrix

### Browser-Safe Variables

These may be exposed to the web runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Server-Only Variables

These must never be exposed to browser code:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONTENTFUL_DELIVERY_ACCESS_TOKEN`
- `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
- `CONTENTFUL_PREVIEW_SECRET`

### Operator Or CI Secrets

These are only needed for sync or validation jobs:

- `REBRICKABLE_API_KEY`
- optional `REBRICKABLE_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Local Development

`apps/web`:

- `API_PROXY_TARGET=http://localhost:3333`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_DELIVERY_ACCESS_TOKEN`
- optional `CONTENTFUL_ENVIRONMENT`
- optional `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
- optional `CONTENTFUL_PREVIEW_SECRET`

`apps/api`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `HOST`
- optional `PORT`

Sync operators:

- `REBRICKABLE_API_KEY`
- optional `REBRICKABLE_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Staging

Vercel web:

- `API_PROXY_TARGET=https://<staging-api-host>`
- `NEXT_PUBLIC_SUPABASE_URL=<staging-supabase-url>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-supabase-anon-key>`
- `CONTENTFUL_SPACE_ID=<contentful-space-id>`
- `CONTENTFUL_DELIVERY_ACCESS_TOKEN=<staging-or-shared-delivery-token>`
- `CONTENTFUL_ENVIRONMENT=staging`
- optional preview support:
  - `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
  - `CONTENTFUL_PREVIEW_SECRET`

Render API:

- `SUPABASE_URL=<staging-supabase-url>`
- `SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>`
- `HOST=0.0.0.0`
- `PORT=<render-provided>`

CI:

- `REBRICKABLE_API_KEY`

Note:

- the catalog drift check in CI depends on `REBRICKABLE_API_KEY`
- forked pull requests may not receive that secret, so the workflow is expected to skip only that one secret-backed check in those contexts
- the normal MVP CI path does not need Supabase write credentials because `pnpm sync:commerce:check` is artifact-only
- only add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to CI if you intentionally introduce a secret-backed commerce write job later

### Production

Vercel web:

- `API_PROXY_TARGET=https://<production-api-host>`
- `NEXT_PUBLIC_SUPABASE_URL=<production-supabase-url>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-supabase-anon-key>`
- `CONTENTFUL_SPACE_ID=<contentful-space-id>`
- `CONTENTFUL_DELIVERY_ACCESS_TOKEN=<production-delivery-token>`
- optional `CONTENTFUL_ENVIRONMENT=master`
- preview only if intentionally enabled:
  - `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
  - `CONTENTFUL_PREVIEW_SECRET`

Render API:

- `SUPABASE_URL=<production-supabase-url>`
- `SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>`
- `HOST=0.0.0.0`
- `PORT=<render-provided>`

CI:

- `REBRICKABLE_API_KEY`

## Deploy Order

1. Provision or confirm hosted services.
   - Supabase staging and production projects
   - Render API service
   - Vercel web project
   - Contentful space and environments
2. Apply the Supabase migration to staging.
3. Configure Contentful content and preview posture for staging.
4. Run artifact drift checks from the workspace root.
   - `pnpm sync:catalog:check`
   - `pnpm sync:commerce:check`
5. If data changed intentionally, regenerate and commit artifacts before deploy.
   - `pnpm sync:catalog`
   - `pnpm sync:commerce`
6. Run the MVP readiness checks.
   - `pnpm nx run api:test`
   - `pnpm nx run api:build`
   - `pnpm nx run web:build`
7. Deploy the API first.
8. Deploy the web app second.
9. Run staging smoke checks.
10. Promote the same reviewed git revision to production.
11. Run production smoke checks.

For the final production-only pass, use:

- `docs/operations/mvp-production-rollout-checklist.md`

## Staging Rehearsal Flow

Use staging as the full dry run for production launch.

1. Confirm staging secrets are populated in Vercel, Render, and CI.
2. Confirm Supabase auth redirect URLs include the staging web host.
3. Confirm Contentful staging content is published if live editorial is part of rehearsal.
4. Run the sync checks and required build or test targets locally or in CI.
5. Deploy staging API.
6. Deploy staging web.
7. Run smoke validation:
   - `pnpm smoke:mvp` against staging URLs
   - manual sign-in flow
   - manual profile save
   - manual owned or wanted toggles
   - one commerce-enabled set page
   - one non-commerce-enabled set page
8. Review logs for:
   - missing env errors
   - session route failures
   - Supabase auth callback issues
   - Contentful preview or delivery misconfiguration
9. Only use a production launch after staging passes on the same branch or commit line.

## Production Rollout

Use production as a mirror of the validated staging environment, not as a place to introduce last-minute config drift.

1. Confirm the exact release candidate commit already passed staging rehearsal.
2. Confirm production provider envs match the approved production matrix.
3. Confirm Supabase production auth URLs point at the production web origin only.
4. Run:
   - `pnpm sync:catalog:check`
   - `pnpm sync:commerce:check`
   - `pnpm nx run api:test`
   - `pnpm nx run api:build`
   - `pnpm nx run web:build`
5. Deploy Render API production.
6. Deploy Vercel web production.
7. Run the command and UI smoke checks from `docs/operations/mvp-production-rollout-checklist.md`.
8. If any production smoke check fails, roll back the failing deployment first instead of changing unrelated production settings live.

## Launch-Day Smoke Checks

Automated helper:

```bash
API_BASE_URL=https://api.example.com \
WEB_BASE_URL=https://www.example.com \
SET_DETAIL_PATH=/sets/rivendell-10316 \
SET_EXPECT_TEXT=Rivendell \
pnpm smoke:mvp
```

Manual checks:

1. `GET /health` returns `{"status":"ok"}` on the deployed API.
2. `GET /api/v1/session` returns an anonymous or authenticated session payload, not an infrastructure error.
3. Homepage renders shell, editorial content, and featured sets.
4. `/pages/about` renders when live Contentful delivery is enabled.
5. One commerce-enabled set-detail page renders:
   - catalog detail
   - pricing panel
   - affiliate offers
   - auth card
   - profile editor after sign-in
   - owned and wanted toggles
6. One non-commerce-enabled set-detail page renders compact unavailable commerce states.
7. Email sign-in starts successfully.
8. Profile save works.
9. Owned and wanted state persists across refresh.

## Automatic Vs Manual

Automatic:

- CI runs:
  - `pnpm nx run web:build`
  - `pnpm nx run api:build`
  - `pnpm nx run api:test`
  - `pnpm sync:catalog:check`
  - `pnpm sync:commerce:check`
- Vercel preview and production deploys from git
- Render API deploys from git

Manual:

- `pnpm sync:catalog` write runs
- `pnpm sync:commerce` write runs
- Supabase migration promotion
- Contentful publishing
- staging rehearsal sign-off
- production launch decision
- rollback execution

## Rollback

If the deployment is not acceptable:

1. Identify the failure type.
   - web-only rendering issue
   - API auth or persistence issue
   - generated catalog or commerce artifact issue
   - Contentful content issue
   - environment configuration issue
2. For web-only issues:
   - roll back the Vercel deployment to the previous known-good build
3. For API issues:
   - roll back the Render service to the previous known-good build
   - verify Supabase env vars before changing application code
4. For generated data issues:
   - revert the generated artifact files to the last good commit
   - rerun `pnpm sync:catalog:check` and `pnpm sync:commerce:check`
   - redeploy the reverted commit
5. For Contentful issues:
   - revert or unpublish the entry changes
   - if necessary, temporarily remove live delivery configuration and use the documented fallback posture
6. Re-run:
   - `pnpm nx run api:build`
   - `pnpm nx run web:build`
   - `pnpm smoke:mvp`

## Readiness Gate

The repository is ready for a staging rehearsal when:

- the provider accounts are provisioned
- staging secrets are present
- the Supabase migration has been applied to staging
- CI is green on the MVP targets
- catalog and commerce drift checks are clean
- the deployment runbook and MVP release checklist have been reviewed by the launch operator

The repository is ready for the first production deployment when:

- staging passed on the same release line
- production secrets are present
- launch content is published or explicitly frozen to mock posture
- rollback owner and smoke-test owner are assigned
