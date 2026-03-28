# Contentful Space Setup

## Purpose

This document explains how to set up the first Contentful space for the current editorial skeleton in this repo.

For day-to-day local preview usage, see `docs/architecture/contentful-preview-usage.md`.
For first-space validation and rollout checks, see `docs/architecture/contentful-validation-rollout-checklist.md`.

It is scoped to:

- homepage editorial content
- generic editorial pages under `/pages/[slug]`
- ordered sections
- SEO fields
- basic draft-mode preview entry and exit routes

## Environment Variables

The current content facade checks these variables:

- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_DELIVERY_ACCESS_TOKEN`
- `CONTENTFUL_PREVIEW_ACCESS_TOKEN`
- `CONTENTFUL_PREVIEW_SECRET`
- `CONTENTFUL_ENVIRONMENT`

Behavior:

- if `CONTENTFUL_SPACE_ID` and `CONTENTFUL_DELIVERY_ACCESS_TOKEN` are missing, the app uses local mock content in delivery mode
- if both are present, the app attempts live Contentful delivery fetches
- if preview mode is requested and no Contentful credentials exist at all, the app may use mock content only to exercise preview plumbing locally
- if delivery credentials exist but preview credentials do not, preview mode is treated as misconfigured rather than falling back to delivery
- `CONTENTFUL_ENVIRONMENT` defaults to `master`

Recommended local `.env.local` example:

```bash
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_DELIVERY_ACCESS_TOKEN=your_delivery_token
CONTENTFUL_PREVIEW_ACCESS_TOKEN=your_preview_token
CONTENTFUL_PREVIEW_SECRET=your_preview_secret
CONTENTFUL_ENVIRONMENT=master
```

Recommended deployment setup:

- set all three variables in the hosting environment
- keep delivery and preview tokens server-only
- do not expose the preview secret to the client

## Initial Space Configuration

Create one space and one environment first:

- Space: team-owned project space
- Environment: `master`

Create these content types:

1. `editorialPage`
2. `editorialSection`

Use the exact IDs from `docs/architecture/contentful-editorial-model.md`.

## Editor Workflow

### Homepage

Create one `editorialPage` entry with:

- `internalName`: `Homepage`
- `pageType`: `homepage`
- `slug`: empty
- `title`: `Brick Ledger`
- `seoTitle`: homepage SEO title
- `seoDescription`: homepage SEO description
- `seoNoIndex`: `false`
- `sections`: ordered section references

Recommended section order:

1. one `hero` section
2. one `richText` section
3. one `callout` section

### About Page

Create one `editorialPage` entry with:

- `internalName`: `About`
- `pageType`: `page`
- `slug`: `about`
- `title`: `About Brick Ledger`
- `seoTitle`: about page SEO title
- `seoDescription`: about page SEO description
- `seoNoIndex`: `false`
- `sections`: ordered section references

Recommended section order:

1. one `hero` section
2. one `richText` section

Resulting route:

- `/pages/about`

## Preview Route Usage

The web app uses Next draft mode for editorial preview.

Enable preview:

- `/api/preview/enable?secret=YOUR_SECRET&pageType=homepage`
- `/api/preview/enable?secret=YOUR_SECRET&slug=about`

Disable preview:

- `/api/preview/disable`
- `/api/preview/disable?path=/pages/about`

Behavior:

- preview routes validate the secret on the server
- preview routes derive the redirect path internally
- preview uses only editorial content queries
- preview does not affect catalog, user, collection, or wishlist flows

## Mapping Checklist

Before considering the space ready, verify:

- homepage entry exists with `pageType = homepage`
- about entry exists with `pageType = page` and `slug = about`
- every page has `seoTitle` and `seoDescription`
- every page has at least one section
- hero pages place the hero section first
- all `ctaHref` values are internal links

## Risks To Avoid

Do not let Contentful become a source of truth for product data.

Avoid these patterns:

- storing LEGO set metadata in editorial entries
- maintaining featured set lists manually in Contentful
- duplicating set names or prices in editorial copy when the intent is data-driven
- creating page slugs that should really be product routes
- expanding section types faster than the renderer supports

The current repo contract should remain:

- Contentful owns editorial structure and SEO
- catalog/data-access owns set truth
- user/collection/wishlist domains own runtime state

## Suggested Repo Doc Updates

The repo should keep these docs together:

- add `docs/architecture/contentful-editorial-model.md`
- add `docs/architecture/contentful-space-setup.md`
- update `AGENTS.md` reference docs to include both
- update `docs/architecture/nx-workspace-blueprint.md` to point to these docs from the Contentful evolution guidance

## What Waits Until Later

These belong in a later phase:

- richer preview UX inside the app shell
- richer rich-text rendering
- more section variants
- editorial references to catalog entities
- localized content
