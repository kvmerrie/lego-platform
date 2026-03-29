# MVP Operator Troubleshooting

This document is the operator-facing quick reference for the current live MVP.

Use it alongside:

- `docs/operations/mvp-release-checklist.md`
- `docs/operations/mvp-deployment-runbook.md`
- `docs/operations/mvp-alerting-observability.md`
- `docs/operations/mvp-production-rollout-checklist.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/catalog-sync-validation.md`
- `docs/operations/commerce-sync.md`
- `docs/operations/commerce-sync-validation.md`
- `docs/operations/production-auth-hardening.md`
- `docs/operations/supabase-auth-foundation.md`

## 1. Fast Triage

Start with the smallest checks first.

### Basic command checks

API health:

```bash
curl -sSf https://<api-host>/health
```

Anonymous session route:

```bash
curl -sSf https://<api-host>/api/v1/session
```

One set-detail page:

```bash
curl -sSf https://<web-host>/sets/rivendell-10316
```

Repeatable helper:

```bash
API_BASE_URL=https://<api-host> \
WEB_BASE_URL=https://<web-host> \
SET_DETAIL_PATH=/sets/rivendell-10316 \
SET_EXPECT_TEXT=Rivendell \
pnpm smoke:mvp
```

### How to interpret the first failures

`/health` fails:

- API deploy is down, unhealthy, or misconfigured.
- Check the Render API service logs first.

`/api/v1/session` fails:

- API is up but route wiring, auth verification, or Supabase server envs are broken.
- Check Render API logs and confirm `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`.

`/api/v1/session` returns `{"state":"anonymous"}`:

- This is healthy for an unsigned request.
- Do not treat anonymous session state as a production failure by itself.

Set-detail HTML check fails:

- Web deploy is unhealthy, the route build is broken, or the expected set route was not shipped.
- Check the Vercel deployment logs and then confirm `pnpm nx run web:build` on the release candidate branch.

## 2. Post-Deploy Validation Flow

Use this short order after every staging rehearsal or production deploy:

1. Run the basic command checks.
2. Run `pnpm smoke:mvp` against the deployed API and web hosts.
3. Open one commerce-enabled set-detail page.
4. Open one non-commerce-enabled set-detail page.
5. Test one real sign-in flow.
6. After sign-in:
   - confirm the account card shows signed-in state
   - save one profile change
   - toggle one set owned
   - toggle one set wanted
   - refresh the page and confirm the saved state persists
7. Confirm the latest Render scheduled jobs completed successfully.

If any one of those fails, stop rollout expansion and diagnose before continuing.

## 3. Catalog Sync Failures

### `REBRICKABLE_API_KEY is required`

- The scheduled job or local shell is missing the Rebrickable key.
- Confirm the key exists only on the catalog sync operator path, not on Vercel.

### `Generated catalog artifacts are stale`

- This is a drift signal, not a runtime crash.
- Run:

```bash
pnpm sync:catalog:check
```

- Review the diff before deciding whether to write or commit it.

### `Invalid Rebrickable set payload...` or `Invalid Rebrickable theme payload...`

- Upstream source data changed shape or returned incomplete data.
- Keep the last known-good generated artifacts in place.
- Do not bypass validation on launch day.

### `Missing product overlay for synced catalog set ...`

- The curated set scope and product overlay coverage drifted apart.
- Add or repair the overlay entry before accepting the sync output.

### Production scheduled-job validation

Healthy catalog sync logs should show:

- one `start` line
- one `end` line
- expected curated set count
- expected homepage-featured count

If the Render scheduled job starts but never reaches an `end` line, treat it as a failed run and inspect the job logs before rerunning.

## 4. Commerce Sync Failures

### `Generated commerce artifacts are stale`

- This is a drift signal, not a production runtime failure.
- Run:

```bash
pnpm sync:commerce:check
```

- Review the generated diff before any write run.

### Supabase write failure during `pnpm sync:commerce`

- The commerce write path now stores daily history rows.
- Confirm the scheduled job or local operator shell has:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Missing expected price history growth

- `pnpm sync:commerce:check` does not write history rows.
- Only `pnpm sync:commerce` writes the daily history upsert.
- Confirm the production scheduled job is running the write command, not check mode.

### Production scheduled-job validation

Healthy commerce sync logs should show:

- one `start` line
- one `end` line
- enabled set count
- pricing observation count
- affiliate offer count
- history point count

If history point count stays at `0` unexpectedly in production, verify the Supabase write envs on the scheduled job.

## 5. Auth And Collector-State Failures

### Browser auth looks unavailable

- Check Vercel envs:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- If those are missing, browsing still works but sign-in remains intentionally unavailable.

### Sign-in email does not arrive

- First suspect SMTP or deliverability, not the web route.
- Review `docs/operations/production-auth-hardening.md`.
- Confirm:
  - custom SMTP is configured in Supabase
  - sender identity is expected
  - auth links are not being rewritten by the SMTP provider

### Sign-in resend or rate-limit message appears

- This is often healthy behavior, not a system outage.
- Wait about one minute before retrying.
- Avoid repeated rapid validation attempts from the same address.

### Sign-in link opens, but session still looks anonymous

- Check Supabase auth site URL and redirect URLs first.
- Confirm they point at the correct deployed web origin.
- Then confirm `/api/v1/session` becomes authenticated from the signed-in browser context.

### Owned or wanted toggles return sign-in errors after login

- Check whether the browser really holds a Supabase session.
- Then check API logs for bearer-token verification issues.
- Confirm the API still has valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Profile save fails with a handle conflict

- This is expected product validation.
- Choose a more distinctive collector handle.

### Profile, owned, or wanted state looks stale until refresh

- That is not expected in the current MVP.
- Re-check the latest deployed web build and rerun:

```bash
pnpm nx run web:build
```

- If the issue reproduces only in production, compare the live deployment against the staged release candidate SHA.

## 6. Contentful And Editorial Issues

Homepage or `/pages/about` looks wrong:

- First confirm whether the environment is intentionally using live Contentful or mock editorial posture.
- If live Contentful delivery is enabled, verify:
  - `CONTENTFUL_SPACE_ID`
  - `CONTENTFUL_DELIVERY_ACCESS_TOKEN`
  - optional `CONTENTFUL_ENVIRONMENT`
- If production should still use mock editorial posture, leave the delivery envs unset rather than partially configured.

Preview behavior problems:

- Confirm preview is intentionally enabled in that environment.
- Verify:
  - `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
  - `CONTENTFUL_PREVIEW_SECRET`

## 7. Rollback Triggers

Roll back or pause rollout if any of these happen:

- API health fails after deploy
- set-detail pages fail to render
- sign-in cannot be validated after SMTP and redirect configuration were confirmed
- saved owned or wanted state does not persist after refresh
- sync jobs fail repeatedly with the same configuration or validation error
- generated artifact drift is understood but not yet accepted

Use the rollback steps in:

- `docs/operations/mvp-release-checklist.md`
- `docs/operations/mvp-production-rollout-checklist.md`

## 8. Ongoing Operator Rhythm

For the current live MVP, the safest recurring workflow is:

1. Check scheduled job health regularly.
2. Review catalog and commerce drift in check mode before any manual write run.
3. Validate production auth only with disciplined resend timing.
4. Run `pnpm smoke:mvp` after every deploy and after any sensitive env change.
5. Keep generated artifacts, deployment SHA, and operator-reviewed content changes aligned in the same release conversation.
