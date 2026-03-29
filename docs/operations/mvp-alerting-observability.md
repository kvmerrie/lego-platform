# MVP Alerting And Observability

This document defines the smallest useful alerting and observability layer for the current live MVP.

It is intentionally low-cost:

- no new paid tools are required
- no new infrastructure is required
- use built-in Render notifications, health checks, metrics, and logs first

Use it alongside:

- `docs/operations/mvp-deployment-runbook.md`
- `docs/operations/mvp-production-rollout-checklist.md`
- `docs/operations/mvp-operator-troubleshooting.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/commerce-sync.md`
- `docs/operations/production-auth-hardening.md`

## 1. Minimum MVP Alerting Setup

### Render workspace notifications

Configure Render notifications at the workspace level first:

1. Open `Integrations > Notifications` in the Render workspace.
2. Set the notification destination:
   - minimum: email to at least one primary operator
   - recommended: email plus Slack if the team already has a shared ops channel
3. Set `Default Service Notifications` to `Only failure notifications`.

Why:

- this keeps the MVP low-noise
- Render will still notify on deploy failures, cron job failures, and unhealthy running services

### Render API web service

For the production API service:

1. Set the Render health check path to `/health`.
2. Keep service notifications enabled.
3. Use either:
   - workspace default `Only failure notifications`
   - or an explicit per-service override to the same setting

This covers the key failure classes for the MVP API:

- failed build or deploy
- unhealthy running service

### Render scheduled jobs

For both production scheduled jobs:

- `commerce-sync-production`
- `catalog-sync-production`

Enable notifications at `Only failure notifications`.

This covers:

- cron job execution failure

### What should be enabled in Render

At minimum, enable:

- workspace notifications destination: email
- API service health check path: `/health`
- API service notifications: `Only failure notifications`
- `commerce-sync-production` notifications: `Only failure notifications`
- `catalog-sync-production` notifications: `Only failure notifications`

Recommended low-cost upgrade:

- connect Slack and send the same failure notifications to a small operator channel

## 2. Alert Categories

### Critical

Requires action now because user-facing reliability or fresh data is likely affected.

Examples:

- API unhealthy on Render
- API build or deploy failed
- `commerce-sync-production` scheduled job failed
- `catalog-sync-production` scheduled job failed
- sign-in is broadly failing for real users after production auth was already configured correctly

Expected action:

- start with `docs/operations/mvp-operator-troubleshooting.md`
- confirm health, recent deploys, envs, and job logs
- roll back if the issue is clearly production-impacting and not quickly reversible

### Warning

Needs review soon, but does not automatically mean the live product is broken.

Examples:

- `pnpm sync:catalog:check` or `pnpm sync:commerce:check` reports stale artifacts during operator review
- daily history growth looks older than expected even though the app still renders
- repeated user reports of auth friction without confirmed total sign-in outage

Expected action:

- review the relevant logs or diffs
- decide whether the issue is expected drift, an operator workflow miss, or the start of a production problem

### Informational

Expected behavior that should not be treated as an outage.

Examples:

- `/api/v1/session` returns anonymous for an unsigned request
- users see resend or rate-limit messaging after requesting multiple sign-in links too quickly
- sets outside the current commerce-enabled slice show compact unavailable commerce states
- one-point price history states such as “History is building”

Expected action:

- no incident response
- only escalate if the pattern becomes widespread or contradicts the intended product behavior

## 3. Signal Interpretation

### Sync job failures

Treat failed production scheduled jobs as `critical`.

Why:

- the MVP relies on those jobs to keep catalog and pricing guidance fresh
- repeated failures can leave the product stale even when web and API remain up

Interpretation guide:

- one failed run with a known upstream or env issue: critical, but usually recoverable without rollback
- repeated failed runs across multiple intervals: critical and likely needs immediate operator intervention

### Auth rate limits

Treat auth resend or rate-limit behavior as `informational` first.

Why:

- the current passwordless flow and Supabase resend windows make this normal under rapid retries

Escalate to `warning` if:

- multiple real users report issues despite waiting appropriately
- operators cannot validate sign-in after SMTP and redirect configuration were confirmed

Escalate to `critical` only if:

- sign-in is broadly failing for real users and the product no longer supports the core signed-in owned or wanted flow

### Stale data signals

Treat stale data signals as `warning` by default.

Examples:

- `sync:catalog:check` reports drift during review
- `sync:commerce:check` reports drift during review

Escalate to `critical` if:

- scheduled write jobs are failing repeatedly
- price history has stopped updating beyond the expected schedule window
- stale data is accompanied by operator-confirmed production sync failure

## 4. What To Check First

### API down

1. Check Render notification and latest deploy event.
2. Check:

```bash
curl -sSf https://<api-host>/health
curl -sSf https://<api-host>/api/v1/session
```

3. Open Render logs for the API service.
4. Confirm production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. If the service is unhealthy after deploy, prefer rolling back the API before changing unrelated production settings.

### Commerce sync failing

1. Open the latest Render scheduled job logs for `commerce-sync-production`.
2. Confirm the job still has:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Confirm whether the failure is:
   - generated artifact drift
   - Supabase write failure
   - local curated-config or validation failure
4. Run locally if needed:

```bash
pnpm sync:commerce:check
```

5. Treat repeated failure across two or more expected schedule windows as critical production freshness loss.

### Catalog sync failing

1. Open the latest Render scheduled job logs for `catalog-sync-production`.
2. Confirm `REBRICKABLE_API_KEY` is still present on that job.
3. Identify whether the failure is:
   - missing key
   - upstream payload validation issue
   - generated artifact drift
   - local overlay or curation mismatch
4. Run locally if needed:

```bash
pnpm sync:catalog:check
```

5. Keep the last known-good generated artifacts in place until the failure is understood.

### Auth issues

1. Decide whether the symptom is:
   - sign-in unavailable in the browser
   - resend or rate-limit message
   - sign-in email not arriving
   - sign-in completes but session stays anonymous
2. Confirm browser envs in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Confirm Supabase auth URLs and SMTP configuration.
4. Use the real browser flow to validate sign-in. Do not rely on unsigned `curl` checks alone.
5. If resend or rate-limit behavior appears, wait about one minute before retrying.

## 5. Manual Observability Surface For The MVP

Use the built-in Render surfaces first:

- Notifications
- Events timeline
- Logs
- Metrics
- Health checks

Recommended operator habit:

1. Treat notifications as the trigger.
2. Use the Events timeline to see whether deploy, cron, or health status changed first.
3. Use logs to confirm the immediate cause.
4. Use Metrics for trend context such as CPU, memory, or request-volume anomalies on the API web service.

For the current MVP, this is enough without adding external observability infrastructure.

## 6. What To Add Later

If the MVP grows and the team needs deeper visibility later, add these in order:

1. Sentry for browser and API exception tracking
2. A shared Slack incident channel if email-only alerting becomes too slow
3. External uptime checks if the team wants independent public availability confirmation
4. Render metric streaming or broader OpenTelemetry export only if the workspace plan and operational needs justify it

These are later improvements, not launch requirements.

## 7. Official Provider References

- [Render Notifications](https://render.com/docs/notifications)
- [Render Health Checks](https://render.com/docs/health-checks)
- [Render Service Metrics](https://render.com/docs/service-metrics)
