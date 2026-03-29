# MVP Production Rollout Checklist

This checklist is the shortest production-facing companion to:

- `docs/operations/mvp-deployment-runbook.md`
- `docs/operations/mvp-alerting-observability.md`
- `docs/operations/mvp-release-checklist.md`
- `docs/operations/mvp-operator-troubleshooting.md`
- `docs/operations/production-auth-hardening.md`
- `docs/operations/supabase-auth-foundation.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/commerce-sync.md`
- `docs/operations/pricing-history.md`

Use it after staging has already passed on the exact release candidate branch or commit.

## 1. Production Services

Confirm these production services already exist and are pointed at the current repository:

- one Vercel production project for `apps/web`
- one Render production web service for `apps/api`
- two Render scheduled jobs for sync automation
  - `commerce-sync-production`
  - `catalog-sync-production`
- one Supabase production project
- optional live Contentful production posture
  - either `master` delivery is enabled intentionally
  - or production continues to use mock editorial fallback

Also confirm the minimum alerting posture:

- Render workspace notifications route to at least one operator email
- API health check path is set to `/health`
- API notifications are enabled
- both scheduled jobs have failure notifications enabled

## 2. Production Secrets And Env

### Vercel Production

Required:

- `API_PROXY_TARGET=https://<production-api-host>`
- `NEXT_PUBLIC_SUPABASE_URL=<production-supabase-url>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-supabase-anon-key>`

Optional live editorial delivery:

- `CONTENTFUL_SPACE_ID=<contentful-space-id>`
- `CONTENTFUL_DELIVERY_ACCESS_TOKEN=<production-delivery-token>`
- optional `CONTENTFUL_ENVIRONMENT=master`

Optional production preview only if intentionally supported:

- `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
- `CONTENTFUL_PREVIEW_SECRET`

Guardrails:

- do not put `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- do not put `REBRICKABLE_API_KEY` in Vercel
- if production is using mock editorial posture, leave Contentful delivery vars unset rather than half-configured

### Render Production API

Required:

- `SUPABASE_URL=<production-supabase-url>`
- `SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>`
- `HOST=0.0.0.0`
- `PORT=<render-provided>`

Guardrails:

- do not rely on `NEXT_PUBLIC_SUPABASE_URL` fallback in production
- set `SUPABASE_URL` explicitly

### Operator Or CI Secrets

Required for production release validation:

- `REBRICKABLE_API_KEY`

Required for production commerce write runs:

- `SUPABASE_URL=<production-supabase-url>`
- `SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>`

## 3. Supabase Production Checklist

1. Confirm `supabase/migrations/20260328223000_initial_auth_foundation.sql` has been applied.
2. Confirm `supabase/migrations/20260329134500_pricing_daily_set_history.sql` has been applied.
3. Confirm email auth is enabled for the chosen production sign-in flow.
4. Confirm Supabase auth URLs:
   - site URL = `https://<production-web-host>`
   - redirect URLs include the production web origin and the expected callback return path
5. Confirm custom SMTP is configured before treating auth as production-ready for real users.
6. Confirm the anon key is used only in Vercel and the service-role key is used only in Render or operator workflows.

## 4. Production Deploy Order

1. Confirm production content posture.
   - live Contentful delivery, or mock editorial fallback
2. Run data drift checks from the release candidate branch.
   - `pnpm sync:catalog:check`
   - `pnpm sync:commerce:check`
3. If production data intentionally changed, regenerate and commit artifacts before deploy.
   - `pnpm sync:catalog`
   - `pnpm sync:commerce`
4. Run the required release commands.
   - `pnpm nx run api:test`
   - `pnpm nx run api:build`
   - `pnpm nx run web:build`
5. Deploy Render API production first.
6. Deploy Vercel web production second.
7. Confirm Render scheduled jobs are enabled with the intended schedules.
   - commerce sync every 6 hours
   - catalog sync once per day
8. Run production smoke checks immediately.

## 5. Production Smoke Checks

### Command Checks

```bash
curl -sSf https://<production-api-host>/health
curl -sSf https://<production-api-host>/api/v1/session
curl -sSf https://<production-web-host>/
curl -sSf https://<production-web-host>/sets/rivendell-10316
```

Optional helper:

```bash
API_BASE_URL=https://<production-api-host> \
WEB_BASE_URL=https://<production-web-host> \
SET_DETAIL_PATH=/sets/rivendell-10316 \
SET_EXPECT_TEXT=Rivendell \
pnpm smoke:mvp
```

### Manual Product Checks

1. Homepage renders with the intended editorial posture.
2. One commerce-enabled set-detail page shows:
   - current price panel
   - 30-day price history or its compact “History is building” state
   - affiliate offers
3. One non-commerce-enabled set-detail page shows compact unavailable commerce states.
4. Email sign-in starts successfully.
5. If resend behavior is tested, wait about one minute before requesting another link.
6. Signed-in session refreshes cleanly.
7. Profile save works.
8. Owned and wanted toggles persist after refresh.
9. Sign-out returns the session to anonymous state.

If any smoke or manual check fails, stop rollout and use `docs/operations/mvp-operator-troubleshooting.md` before retrying or widening exposure.

## 6. Post-Deploy Validation Notes

Treat these outcomes carefully:

- `/api/v1/session` returning anonymous for an unsigned request is healthy.
- sign-in resend or rate-limit messaging can still be healthy behavior; wait about one minute before retrying.
- `pnpm sync:catalog:check` and `pnpm sync:commerce:check` surfacing stale artifacts means drift was detected, not that production runtime is immediately broken.

## 7. Rollback

If production is not acceptable:

1. Roll back the web deployment to the previous Vercel production deployment or previous git SHA.
2. Roll back the API deployment to the previous Render deploy or previous git SHA.
3. If generated data is the problem:
   - revert the generated catalog or commerce artifacts
   - redeploy the reverted commit
4. If editorial content is the problem:
   - revert the Contentful entries
   - or remove live delivery vars and fall back to mock editorial posture
5. If auth or persistence is the problem:
   - verify production Supabase envs first
   - if needed, roll back only the API while leaving the web browseable

## 8. Launch Gate

Production rollout is ready only when:

- staging has already passed on the release candidate
- production envs are populated in the correct provider
- production Supabase auth URLs are correct
- sync artifacts are clean or intentionally reviewed
- `api:build` passes
- `web:build` passes
- production smoke checks pass
