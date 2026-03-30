# Locale And Market Foundation

## Purpose

This pass prepares the workspace for locale-aware routing and multi-region commerce expansion without turning the MVP into a full i18n project yet.

The current product remains intentionally simple:

- one live language context in the UI
- one live market context for commerce and price formatting
- unprefixed public routes such as `/discover` and `/sets/...`

## Current Reality

The MVP is still effectively Dutch-first in commerce and formatting:

- current reviewed pricing and affiliate offers use the Dutch market
- current currency is EUR
- current date and price formatting follow `nl-NL`
- current public routes are unprefixed

The UI language is not yet fully localized. Today the product mostly uses English product copy on top of Dutch-market commerce data.

## Foundation Added Now

The minimal shared foundation lives in `libs/shared/config` and introduces:

- explicit language config
- explicit market config
- a composed locale context
- default language and market settings
- shared route builders for future locale-prefixed paths
- shared market helpers for formatting and market-scope copy

The important distinction is now explicit:

- language controls UI language and HTML lang
- market controls currency, formatting locale, merchant region, and market-facing labels
- locale is a composed route concept such as `en-nl`

## Route Strategy Now

Current web routes stay unprefixed.

The shared route helper already supports a future prefix strategy:

- current mode: `never`
- future mode: `always`

That means the app can keep emitting `/discover` today while the route-building contract is already ready for `/en-nl/discover` or `/nl-nl/discover` later.

## Commerce And Catalog Readiness

This pass does not add new regions or currencies yet. It only removes the assumption that market, currency, and route locale are the same thing.

That gives us a cleaner path for later work such as:

- multiple merchant allowlists per market
- market-specific pricing snapshots
- market-specific affiliate disclosures
- locale-aware route generation for catalog, search, and account surfaces

## Intentionally Deferred

This pass does not include:

- a translation system
- locale switcher UI
- locale-prefixed Next.js route trees
- `hreflang` and locale-specific canonical metadata
- a second live locale
- a second live market
- market-aware content duplication or editorial localization

## Before A Real `/nl-nl/...` Launch

Before shipping locale-prefixed routes in production, we should complete these steps:

1. Add a route tree or middleware strategy that resolves locale-prefixed URLs.
2. Move all remaining internal href creation behind shared route builders.
3. Add locale-aware metadata, canonical handling, and `hreflang`.
4. Decide the first real UI language set, separate from market choice.
5. Expand commerce configuration so merchants, disclosures, and pricing slices are selected by market instead of one default.

## Guidance

Until that rollout happens:

- keep apps thin
- keep locale and market defaults in shared config
- avoid hardcoding `nl-NL`, `EUR`, `NL`, or `/discover`-style paths in feature code when a shared helper already exists
- treat new market or locale support as a deliberate product rollout, not as incidental copy changes
