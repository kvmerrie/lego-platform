# Contentful Preview Usage

## Purpose

This guide explains how to use the current editorial preview flow in local development.

For end-to-end space validation and rollout checks, see `docs/architecture/contentful-validation-rollout-checklist.md`.

It matches the implemented preview behavior in:

- `apps/web/src/app/api/preview/enable/route.ts`
- `apps/web/src/app/api/preview/disable/route.ts`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/pages/[slug]/page.tsx`

Preview is editorial-only. It applies to:

- `/`
- `/pages/[slug]`

It does not apply to catalog set routes, owned or wanted flows, pricing, affiliate data, or user state.

## Local Environment Variables

Set these in `apps/web` local development through `.env.local` at the workspace root:

```bash
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_DELIVERY_ACCESS_TOKEN=your_delivery_token
CONTENTFUL_PREVIEW_ACCESS_TOKEN=your_preview_token
CONTENTFUL_PREVIEW_SECRET=your_preview_secret
CONTENTFUL_ENVIRONMENT=master
```

Notes:

- `CONTENTFUL_DELIVERY_ACCESS_TOKEN` is used for normal published editorial content.
- `CONTENTFUL_PREVIEW_ACCESS_TOKEN` is used only when Next draft mode is enabled.
- `CONTENTFUL_PREVIEW_SECRET` is used only by the preview enable route.
- All preview credentials stay server-only.

Local fallback behavior:

- if no Contentful credentials exist at all, delivery and preview can use local mock editorial content
- if delivery credentials exist but preview credentials do not, preview is treated as misconfigured and should fail instead of falling back to published delivery content

## Start The App

For editorial preview, only the web app is required:

```bash
pnpm dev:web
```

Use the local web app at:

- `http://localhost:3000`

The API app is not required for homepage or `/pages/about` editorial preview.

## Preview The Homepage

1. Make sure the homepage editorial entry exists in Contentful with `pageType = homepage`.
2. Start the web app.
3. Open:

```text
http://localhost:3000/api/preview/enable?secret=YOUR_PREVIEW_SECRET&pageType=homepage
```

Expected result:

- draft mode is enabled for your browser session
- you are redirected to `/`
- the homepage uses preview-aware editorial queries

## Preview `/pages/about`

1. Make sure the editorial page exists with:
   - `pageType = page`
   - `slug = about`
2. Start the web app.
3. Open:

```text
http://localhost:3000/api/preview/enable?secret=YOUR_PREVIEW_SECRET&slug=about
```

Expected result:

- draft mode is enabled for your browser session
- you are redirected to `/pages/about`
- the route uses preview-aware editorial queries

## Disable Preview Safely

Use one of these:

- `http://localhost:3000/api/preview/disable`
- `http://localhost:3000/api/preview/disable?path=/pages/about`

Behavior:

- draft mode is disabled for the current browser session
- redirect falls back to `/` by default
- only `/` and `/pages/[slug]` style internal paths are accepted for redirecting

## Common Failure Cases

### `401 Invalid preview secret`

Meaning:

- `secret` does not match `CONTENTFUL_PREVIEW_SECRET`
- or `CONTENTFUL_PREVIEW_SECRET` is missing on the server

### `400 Invalid preview target`

Meaning:

- the enable URL did not use one of the supported shapes
- valid shapes are:
  - `?secret=...&pageType=homepage`
  - `?secret=...&slug=about`

### `404 Preview page not found`

Meaning:

- the requested editorial page slug was not found in preview mode
- check the `slug` field and the current Contentful environment

### `500 Unable to enable preview mode`

Meaning:

- preview credentials are missing but delivery credentials exist
- Contentful preview content could not be loaded
- Contentful is unreachable
- homepage preview content is missing or invalid

### You see mock content instead of Contentful content

Meaning:

- no Contentful credentials are configured at all
- you are exercising local preview plumbing, not live Contentful preview

## Guardrails

- Preview is only for editorial content under `/` and `/pages/[slug]`.
- Do not use preview routes for `/sets/[slug]` or other product routes.
- Do not put `CONTENTFUL_PREVIEW_SECRET` or preview tokens in client env vars.
- Do not add arbitrary redirect URLs to preview routes.
- Do not use Contentful preview to test catalog truth, owned or wanted state, or user flows.
- Keep Contentful editorial-only even in preview mode.

## Docs That Should Link Here

- `AGENTS.md`
- `docs/architecture/contentful-space-setup.md`
- `docs/architecture/contentful-validation-rollout-checklist.md`
- `docs/architecture/nx-workspace-blueprint.md`

Optional:

- `docs/architecture/contentful-editorial-model.md`
