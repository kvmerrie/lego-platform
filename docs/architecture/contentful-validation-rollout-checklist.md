# Contentful Validation And Rollout Checklist

## Purpose

Use this checklist when connecting the repo to the first real Contentful space.

It is intended to validate the current implemented behavior for:

- homepage editorial content at `/`
- editorial pages at `/pages/[slug]`
- SEO metadata mapping from the content domain
- Next draft-mode preview routes

This checklist is editorial-only. It does not validate catalog truth, set detail routes, pricing, affiliate data, or user flows.

Read these docs alongside this checklist:

- `docs/architecture/contentful-editorial-model.md`
- `docs/architecture/contentful-space-setup.md`
- `docs/architecture/contentful-preview-usage.md`

## 1. First Space Setup Checklist

- Create or choose the team-owned Contentful space for this project.
- Use the `master` environment first unless the team has already standardized on another environment.
- Create the two required content types only:
  - `editorialPage`
  - `editorialSection`
- Verify the content type IDs and field IDs match `docs/architecture/contentful-editorial-model.md` exactly.
- Generate and store these server-only values:
  - `CONTENTFUL_SPACE_ID`
  - `CONTENTFUL_DELIVERY_ACCESS_TOKEN`
  - `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
  - `CONTENTFUL_PREVIEW_SECRET`
  - `CONTENTFUL_ENVIRONMENT`
- Add those variables to local `.env.local` at the workspace root before validating live content.
- Confirm the web app can start with `pnpm dev:web`.

## 2. Homepage Entry Checklist

- Create one `editorialPage` entry for the homepage.
- Set `internalName` to a clear admin label such as `Homepage`.
- Set `pageType` to `homepage`.
- Leave `slug` empty.
- Set `title`.
- Set `seoTitle`.
- Set `seoDescription`.
- Leave `seoNoIndex` as `false` unless this is a temporary non-indexable environment.
- Optionally upload `seoOpenGraphImage`.
- Add at least one section reference in `sections`.
- If using a hero section, place it first in the ordered `sections` list.
- Publish every referenced `editorialSection` entry.
- Publish the `editorialPage` entry itself.

## 3. Editorial Page Checklist

- Create one `editorialPage` entry for `/pages/about`.
- Set `internalName` to a clear admin label such as `About`.
- Set `pageType` to `page`.
- Set `slug` to `about`.
- Set `title`.
- Set `seoTitle`.
- Set `seoDescription`.
- Leave `seoNoIndex` as `false` for the published test page.
- Optionally upload `seoOpenGraphImage`.
- Add at least one section reference in `sections`.
- If using a hero section, place it first in the ordered `sections` list.
- Publish every referenced `editorialSection` entry.
- Publish the `editorialPage` entry itself.

## 4. Published Rendering Validation

### Homepage

- Start the web app with `pnpm dev:web`.
- Open `http://localhost:3000/`.
- Confirm the homepage renders editorial sections from Contentful rather than the local mock homepage.
- Confirm the catalog set list still renders below the editorial content.
- Confirm the homepage does not break when catalog content remains outside Contentful.

### Editorial Page

- Open `http://localhost:3000/pages/about`.
- Confirm the page renders the expected ordered sections from Contentful.
- Confirm the route exists only because `pageType = page` and `slug = about` were configured correctly.
- Confirm the page shell and navigation still come from the app and shell layers, not from Contentful.

## 5. Metadata Validation Checklist

Validate both `/` and `/pages/about`.

- Confirm the document title matches `seoTitle`.
- Confirm the meta description matches `seoDescription`.
- If `seoNoIndex` is `true`, confirm robots metadata disables indexing and following.
- If `seoOpenGraphImage` is set, confirm Open Graph metadata includes that image.
- If `seoOpenGraphImage` is not set, confirm metadata still includes title and description cleanly.
- Re-test after changing a page SEO field and republishing the entry.

Practical ways to validate:

- Inspect the page source or browser devtools document head locally.
- Validate the rendered metadata after a refresh on the target route.
- Check both homepage and `/pages/about` separately because they resolve through different queries.

## 6. Preview Validation Checklist

### Homepage Preview

- Leave the published homepage entry intact.
- Make a draft-only change to the homepage entry in Contentful.
- Open:
  - `http://localhost:3000/api/preview/enable?secret=YOUR_PREVIEW_SECRET&pageType=homepage`
- Confirm you are redirected to `/`.
- Confirm the draft homepage content appears.
- Disable preview with `http://localhost:3000/api/preview/disable`.
- Confirm the published homepage content appears again.

### `/pages/about` Preview

- Leave the published about page intact.
- Make a draft-only change to the `about` page entry in Contentful.
- Open:
  - `http://localhost:3000/api/preview/enable?secret=YOUR_PREVIEW_SECRET&slug=about`
- Confirm you are redirected to `/pages/about`.
- Confirm the draft about-page content appears.
- Disable preview with:
  - `http://localhost:3000/api/preview/disable?path=/pages/about`
- Confirm the published about-page content appears again.

## 7. Common Entry Mistakes To Watch For

- `pageType` is wrong:
  - `homepage` must be used only for `/`
  - `page` must be used for `/pages/[slug]`
- Homepage `slug` is filled in even though it should be empty.
- Editorial page `slug` includes a leading slash such as `/about` instead of `about`.
- Editorial page `slug` is not lowercase kebab-case.
- `sections` references exist but the referenced section entries were never published.
- `seoTitle` or `seoDescription` was left empty.
- `ctaHref` uses an external URL or a product route that should not be editorially owned.
- Editors try to manage featured sets, set metadata, or catalog truth in Contentful instead of the catalog domain.
- A new section type is created in Contentful before the renderer supports it.

## 8. Rollback And Troubleshooting

If rollout fails or live content is not ready:

- Remove the local Contentful env vars and restart the web app to fall back to mock delivery content.
- If preview is failing while delivery works, verify `CONTENTFUL_PREVIEW_ACCESS_TOKEN` and `CONTENTFUL_PREVIEW_SECRET` first.
- If a route returns not found, verify `pageType`, `slug`, and publish state before changing code.
- If metadata looks stale, refresh after confirming the entry was republished and the route is using the expected content.
- If preview returns an error, compare the request URL against the supported shapes documented in `docs/architecture/contentful-preview-usage.md`.
- If editors created unsupported content types or fields, fix the Contentful model to match the repo contracts rather than adding ad hoc runtime mapping.

## 9. Guardrails

- Keep Contentful editorial-only.
- Do not store LEGO set truth, pricing history, affiliate offers, or user state in Contentful.
- Do not use Contentful to decide which sets are featured in the catalog list for this phase.
- Do not treat preview success as validation for catalog, owned, or wanted flows.
- Keep `/pages/[slug]` for editorial pages only.

## 10. Docs That Should Link Here

- `AGENTS.md`
- `docs/architecture/contentful-space-setup.md`
- `docs/architecture/contentful-preview-usage.md`
- `docs/architecture/nx-workspace-blueprint.md`

Optional:

- `docs/architecture/contentful-editorial-model.md`
