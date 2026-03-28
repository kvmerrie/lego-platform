# Contentful Editorial Model

## Purpose

This document defines the initial Contentful content model for the public web app. It is intentionally small and must stay aligned with the current repository contracts in:

- `libs/content/util`
- `libs/content/data-access`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/pages/[slug]/page.tsx`

This model is editorial-only. It does not own catalog truth, pricing data, affiliate data, or user state.

## Current Repo Contracts

The current normalized content contracts are:

- `SeoFields`
  - `title`
  - `description`
  - `noIndex?`
  - `openGraphImageUrl?`
- `EditorialPage`
  - `id`
  - `pageType: 'homepage' | 'page'`
  - `title`
  - `slug?`
  - `seo`
  - `sections`
- `EditorialSection`
  - `type: 'hero' | 'richText' | 'callout'`
  - `id`
  - `title`
  - `body`
  - `eyebrow?`
  - `ctaLabel?`
  - `ctaHref?`

The Contentful model should map directly to those shapes without extra runtime translation layers.

## Recommended Content Types

Create exactly two content types first:

1. `editorialPage`
2. `editorialSection`

Do not add separate SEO, catalog, pricing, or navigation content types in this phase.

## Content Type: `editorialPage`

Purpose:
- Represents the homepage or one generic editorial page under `/pages/[slug]`

Recommended display name:
- `Editorial Page`

Fields:

1. `internalName`
- Type: `Short text`
- Required: yes
- Validation:
  - unique within the space by editor convention
  - descriptive and human-readable
- Notes:
  - editorial-only admin label
  - not used by the app

2. `pageType`
- Type: `Short text`
- Required: yes
- Validation:
  - allowed values: `homepage`, `page`
- Notes:
  - maps to `EditorialPage.pageType`

3. `slug`
- Type: `Short text`
- Required: only for `page`
- Validation:
  - lowercase kebab-case
  - no leading slash
  - unique for all `page` entries
- Notes:
  - leave empty for the homepage
  - maps to `/pages/[slug]`

4. `title`
- Type: `Short text`
- Required: yes
- Validation:
  - concise page title
- Notes:
  - maps to `EditorialPage.title`

5. `seoTitle`
- Type: `Short text`
- Required: yes
- Validation:
  - recommended <= 60 characters
- Notes:
  - maps to `SeoFields.title`

6. `seoDescription`
- Type: `Short text`
- Required: yes
- Validation:
  - recommended <= 160 characters
- Notes:
  - maps to `SeoFields.description`

7. `seoNoIndex`
- Type: `Boolean`
- Required: no
- Default: `false`
- Notes:
  - maps to `SeoFields.noIndex`

8. `seoOpenGraphImage`
- Type: `Media`
- Required: no
- Validation:
  - image only
- Notes:
  - maps to `SeoFields.openGraphImageUrl`

9. `sections`
- Type: `Reference, many`
- Required: yes
- Validation:
  - accepts only `editorialSection`
  - preserve manual order
  - minimum 1
- Notes:
  - order is significant
  - the first section should be `hero` if the page needs hero rendering

## Content Type: `editorialSection`

Purpose:
- Represents one ordered section inside an editorial page

Recommended display name:
- `Editorial Section`

Fields:

1. `internalName`
- Type: `Short text`
- Required: yes
- Validation:
  - descriptive and human-readable
- Notes:
  - editorial-only admin label

2. `sectionType`
- Type: `Short text`
- Required: yes
- Validation:
  - allowed values: `hero`, `richText`, `callout`
- Notes:
  - maps to `EditorialSection.type`

3. `eyebrow`
- Type: `Short text`
- Required: no
- Validation:
  - short label
- Notes:
  - maps to `EditorialSection.eyebrow`

4. `title`
- Type: `Short text`
- Required: yes
- Notes:
  - maps to `EditorialSection.title`

5. `body`
- Type: `Long text`
- Required: yes
- Notes:
  - maps to `EditorialSection.body`
  - keep plain text for this phase
  - do not introduce rich text documents yet

6. `ctaLabel`
- Type: `Short text`
- Required: no
- Notes:
  - maps to `EditorialSection.ctaLabel`

7. `ctaHref`
- Type: `Short text`
- Required: no
- Validation:
  - absolute path or hash link only
  - examples: `/pages/about`, `/#featured-sets`
- Notes:
  - maps to `EditorialSection.ctaHref`
  - if present, `ctaLabel` should also be present

## Validation Guidance

Apply these editor rules consistently:

- Only one `editorialPage` should use `pageType = homepage`
- Homepage entries should leave `slug` empty
- Generic editorial pages should use `pageType = page`
- Generic editorial pages must have a unique slug
- Section order should be curated manually in the `sections` reference list
- Put the hero section first if hero rendering is desired
- Keep `ctaHref` internal for now
- Do not use Contentful to select catalog sets

## Naming Conventions

Content type IDs:

- `editorialPage`
- `editorialSection`

Field IDs:

- `internalName`
- `pageType`
- `slug`
- `title`
- `seoTitle`
- `seoDescription`
- `seoNoIndex`
- `seoOpenGraphImage`
- `sections`
- `sectionType`
- `eyebrow`
- `body`
- `ctaLabel`
- `ctaHref`

Editorial conventions:

- use lowercase kebab-case for slugs
- use singular content type IDs
- keep field names explicit rather than generic names like `content` or `text`

## Repo Mapping Guidance

Current data-access and route behavior:

- `getHomepagePage()` loads the single homepage page
- `getEditorialPageBySlug(slug)` loads one `/pages/[slug]` page
- `listEditorialPageSlugs()` drives static params
- homepage metadata comes from homepage `seo`
- editorial route metadata comes from page `seo`

Current mapping expectations:

- `editorialPage.pageType = homepage` maps to `/`
- `editorialPage.pageType = page` plus `slug = about` maps to `/pages/about`
- `sections` order is preserved
- first section with `sectionType = hero` is rendered as the hero panel when it is first in the list

Current mapper behavior is intentionally strict:

- missing required SEO fields cause the entry to be ignored
- unknown `sectionType` values are ignored
- unresolved linked sections are skipped

## What Not To Model In Contentful

Do not add these to Contentful in this phase:

- featured catalog set lists
- set names, prices, piece counts, or release dates
- owned or wanted state
- pricing history
- affiliate offers
- navigation structure outside editorial CTAs

If editorial content later needs to reference catalog entities, add a small reference field that stores a system-owned key such as `setId` or `slug`, and resolve it through the catalog domain.

## Current Route Compatibility

This model is directly compatible with:

- homepage editorial rendering
- `/pages/[slug]`
- `generateStaticParams`
- metadata generation from SEO fields
- future draft/preview support in `content/data-access`

It is intentionally not a full page-builder yet.
