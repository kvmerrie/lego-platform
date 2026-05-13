# Production deploy router

Brickhunt deploys from `main` with an Nx affected-based router so small changes do not redeploy every production service.

The workflow is `.github/workflows/affected-production-deploy.yml` and appears in GitHub Actions as `Production Deploy Router`.

Production providers should use deploy hooks from this workflow as the production trigger. Disable provider-side automatic deploys from every `main` push for services that are managed here, otherwise the provider can still deploy even when the router intentionally selects no target.

## How routing works

1. GitHub Actions checks out the merge commit on `main`.
2. The workflow calculates changed files with `git diff --name-only <base> <head>`.
3. Nx calculates affected projects with:

   ```bash
   pnpm nx show projects --affected --base=<base> --head=<head>
   ```

4. `scripts/affected-deployment-router.mjs` maps affected projects to production deploy targets.
5. The workflow logs:
   - changed files
   - affected Nx projects
   - selected deploy targets
   - routing reason
6. Only the selected deploy hooks are triggered.

If Nx affected detection fails or is uncertain, the workflow fails safe by deploying only:

- `api`
- `web`

It does not deploy all jobs.

## Manual deploys

Use the `Production Deploy Router` workflow dispatch action with:

- `environment`: `production` or `staging`
- `deploy_targets`: optional comma-separated targets

Examples:

```text
environment=staging, deploy_targets=web
environment=production, deploy_targets=web
environment=production, deploy_targets=web,api
```

Manual dispatch defaults to `production`. Pushes to `main` always use the production GitHub Environment.

When `deploy_targets` is provided, manual targets override affected detection entirely. The workflow skips affected range/diff/project detection and deploys exactly the requested targets after validation. Unknown target names fail before any deploy hook is called.
Only `web` and `api` are supported manual targets for now.

## Target mapping

| Affected project pattern                                                                                                                                         | Deploy target |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `web`, `shell-web`, web-facing `catalog-*`, `pricing-*`, `affiliate-*`, `content-*`, `collection-*`, `wishlist-*`, `user-*`, `shared-ui`, `shared-design-tokens` | `web`         |
| `api`, `api-data-access-server`, `*-data-access-server`, `shared-data-access-auth-server`                                                                        | `api`         |

Docs-only and tests-only changes select no production deploy targets.

## Manual cron redeploys

Render cron jobs stay scheduled and keep `autoDeployTrigger: off`, but they are operationally separate from the automatic web/API deploy path. They are not automatically redeployed by the affected router. Render cron deploy-hook support is intentionally not wired into this workflow, so commerce, feed, and alert job changes are logged as manual actions instead of requiring cron hook secrets.

Manual-only cron projects:

- `commerce-sync`
- `alternate-feed-sync`
- `awin-feed-sync`
- `coppenswarenhuis-feed-sync`
- `goodbricks-feed-sync`
- `lidl-feed-sync`
- `mediamarkt-feed-sync`
- `misterbricks-feed-sync`
- `wishlist-alerts`

When one of these projects changes, the workflow logs a warning such as:

```text
commerce-sync code changed; redeploy the Render cron job manually
feed cron code changed; redeploy the Render cron job manually
```

Redeploy the affected Render cron job manually from Render when the app or its cron-specific code changes. Scheduled executions continue normally; this only controls when new code is deployed.

## Required GitHub secrets

Set deploy hook secrets only for services that should be deployable by this workflow:

- `WEB_DEPLOY_HOOK_URL`
- `API_DEPLOY_HOOK_URL`

These secrets are read from the selected GitHub Environment:

- `Production – lego-platform-web-production` for production deploys and `main` pushes
- `Production – lego-platform-web-staging` for manual staging deploys

If a selected target has no hook configured, the workflow fails visibly.

## Web revalidation

The existing `Post Deploy Public Web Revalidation` workflow remains responsible for revalidating public web pages after successful production web deployments.

That workflow calls `/api/revalidate` for:

- `/`
- `/deals`
- `/themes`

with tags:

- `homepage`
- `deals`
- `themes`

using reason `production_deploy`.
