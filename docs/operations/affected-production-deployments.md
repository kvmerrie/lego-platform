# Affected production deployments

Brickhunt deploys from `main` with an Nx affected-based router so small changes do not redeploy every production service.

The workflow is `.github/workflows/affected-production-deploy.yml`.

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

Use the `Affected Production Deploy` workflow dispatch action with `deploy_targets`.

Examples:

```text
web
api,web
commerce-sync
goodbricks-feed-sync,mediamarkt-feed-sync
```

Manual targets override affected detection. Unknown target names fail before any deploy hook is called.

## Target mapping

| Affected project pattern                                                                                                                                         | Deploy target                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `web`, `shell-web`, web-facing `catalog-*`, `pricing-*`, `affiliate-*`, `content-*`, `collection-*`, `wishlist-*`, `user-*`, `shared-ui`, `shared-design-tokens` | `web`                        |
| `api`, `api-data-access-server`, `*-data-access-server`, `shared-data-access-auth-server`                                                                        | `api`                        |
| `commerce-sync`, `api-data-access-server`, commerce/pricing/affiliate/catalog server or util libraries                                                           | `commerce-sync`              |
| `alternate-feed-sync`                                                                                                                                            | `alternate-feed-sync`        |
| `awin-feed-sync`                                                                                                                                                 | `awin-feed-sync`             |
| `coppenswarenhuis-feed-sync`                                                                                                                                     | `coppenswarenhuis-feed-sync` |
| `goodbricks-feed-sync`                                                                                                                                           | `goodbricks-feed-sync`       |
| `lidl-feed-sync`                                                                                                                                                 | `lidl-feed-sync`             |
| `mediamarkt-feed-sync`                                                                                                                                           | `mediamarkt-feed-sync`       |
| `misterbricks-feed-sync`                                                                                                                                         | `misterbricks-feed-sync`     |
| `wishlist-alerts`                                                                                                                                                | `wishlist-alerts`            |

Docs-only and tests-only changes select no production deploy targets.

## Required GitHub secrets

Set deploy hook secrets only for services that should be deployable by this workflow:

- `WEB_DEPLOY_HOOK_URL`
- `API_DEPLOY_HOOK_URL`
- `COMMERCE_SYNC_DEPLOY_HOOK_URL`
- `ALTERNATE_FEED_SYNC_DEPLOY_HOOK_URL`
- `AWIN_FEED_SYNC_DEPLOY_HOOK_URL`
- `COPPENSWARENHUIS_FEED_SYNC_DEPLOY_HOOK_URL`
- `GOODBRICKS_FEED_SYNC_DEPLOY_HOOK_URL`
- `LIDL_FEED_SYNC_DEPLOY_HOOK_URL`
- `MEDIAMARKT_FEED_SYNC_DEPLOY_HOOK_URL`
- `MISTERBRICKS_FEED_SYNC_DEPLOY_HOOK_URL`
- `WISHLIST_ALERTS_DEPLOY_HOOK_URL`

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
