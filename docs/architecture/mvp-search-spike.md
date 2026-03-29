# MVP Search Spike

This document is a narrow product-fit and architecture spike for search in the current LEGO collector MVP. It does not approve search implementation yet. It defines when search becomes worth adding, which first technology is the best fit, and what the smallest sensible search scope would be.

## Current Baseline

As of the current MVP:

- the public catalog scope is intentionally small and curated
- homepage discovery is driven by editorial content plus a featured-set shortlist
- set-detail routes already carry meaningful collector context:
  - curated catalog overlays
  - current reviewed Dutch pricing
  - affiliate offers
  - 30-day and tracked price context for commerce-enabled sets
- the public web experience stays static-friendly and snapshot-backed

Search is therefore not solving the primary product bottleneck yet. The current bottleneck is still catalog breadth, not lookup quality.

## When Search Becomes Worth Adding

Search should be added later, not now.

It becomes worth adding when at least two of these conditions are true:

1. The public product-ready set scope grows to roughly 20 to 30 sets.
2. At least 10 public sets are no longer surfaced directly by the homepage or a small curated landing flow.
3. Users need direct set-number or set-name lookup often enough that curated browsing feels slow.
4. Editorial curation alone is no longer enough to help users reach the right set in one or two clicks.

Below that threshold, search is mostly operational overhead and product theater.

## Options Compared

### Typesense

Best fit when:

- low-level control matters
- self-hosting or dedicated hosted clusters are acceptable
- the product wants more ownership over ranking and access control over time

Strengths:

- open source path available
- Typesense Cloud uses dedicated hourly-priced clusters and explicitly avoids per-search and per-record pricing
- supports fine-grained API key scoping and search-only keys

Tradeoffs for this MVP:

- higher operational responsibility than Algolia
- more infrastructure-shaped than the current MVP really needs
- better matched to a later phase with broader catalog breadth and more custom relevance tuning

Verdict:

- strong long-term option
- not the best first move for this curated MVP

### Meilisearch

Best fit when:

- the team wants a developer-friendly search engine with an open source path
- basic full-text search is enough
- a small hosted bill or self-hosted operational ownership is acceptable

Strengths:

- open source path available
- Meilisearch Cloud starts at a relatively low entry price
- default full-text search is fast and lightweight for straightforward keyword lookup
- supports frontend search keys cleanly

Tradeoffs for this MVP:

- still introduces a new operational service before the product truly needs one
- lower product/platform leverage than Algolia for a very small first rollout
- the best experience beyond simple keyword lookup usually requires more tuning or later feature adoption

Verdict:

- reasonable low-cost mid-step
- not the best first choice unless the team explicitly prefers open source ownership over convenience

### Algolia

Best fit when:

- the first search slice should be fast to ship
- low initial cost matters more than long-term vendor purity
- the product wants the smallest possible addition to the current static-friendly architecture

Strengths:

- lowest friction first rollout for a Next.js web app
- official Next and InstantSearch support is mature
- current public scope easily fits within Algolia's small free/build entry tier
- easy to expose a public search-only key client-side for a public catalog index

Tradeoffs for this MVP:

- stronger vendor lock-in than Typesense or Meilisearch
- usage-based pricing becomes less attractive as search traffic grows
- easiest path can tempt the product into adding more search UI than the current scope justifies

Verdict:

- best first choice when search becomes necessary
- not needed yet, but the best small-step option once the product crosses the discovery threshold

## Recommendation

### Timing

Add search later.

Do not add it while the public set scope remains this small and heavily curated. The current homepage plus set-detail discovery pattern is still the right default.

Revisit search once the public catalog grows past the threshold described above or once real user behavior shows repeated direct-lookup demand.

### First Technology Choice

Choose Algolia first when search is finally added.

Why:

- lowest initial cost at MVP scale
- lowest implementation friction for a polished public-site experience
- easiest way to keep `apps/web` thin and static-friendly
- smallest operational burden compared with running or babysitting another search service

### Smallest Sensible Search Scope

When search is added, start with only this:

- one public set index containing public product-ready sets only
- searchable fields:
  - set number / canonical id
  - product slug
  - display name
  - theme
  - release year
- supporting display fields:
  - tagline
  - collector angle
  - price posture label only if already available from snapshot-backed data
- one lightweight quick-find surface, not a full search product:
  - homepage search box or shell search box
  - suggestion-style result list linking to existing set-detail routes

Do not start with:

- faceted search pages
- search-specific routes
- merchant-level commerce search
- user-personalized ranking
- runtime merchant calls
- search analytics or click-tracking layers beyond what a vendor includes by default

## Best-Fit Architecture Shape

When the repo is ready for search:

1. Keep `apps/web` thin.
2. Keep public pages static-friendly.
3. Keep search public and read-only.
4. Reuse sync-time data, not runtime third-party merchant fetching.

The smallest repo-aware path is:

1. derive a public-set search document from the existing catalog snapshot plus local overlays
2. optionally enrich that document with already-generated pricing posture labels
3. index those records during sync or CI, not from page runtime
4. query the hosted index directly from the browser with a search-only public key

That preserves the current architecture:

- catalog remains the source of truth for public set records
- commerce remains additive
- `apps/api` does not need a new search proxy just to launch the first public quick-find surface

## Implementation Trigger Checklist

Before approving search implementation, confirm:

- public catalog breadth has outgrown curated browsing alone
- the team agrees on a single minimal quick-find surface
- the search index scope is only public product-ready sets
- no user/private data needs to be searchable
- no new route model is required for phase 1

## Official References

- Typesense Cloud pricing: <https://cloud.typesense.org/>
- Typesense API keys and scoped search keys: <https://typesense.org/docs/29.0/api/api-keys.html>
- Typesense frontend access guidance: <https://typesense.org/docs/guide/data-access-control.html>
- Meilisearch pricing: <https://www.meilisearch.com/usage-based>
- Meilisearch search behavior: <https://www.meilisearch.com/docs/learn/ai_powered_search/difference_full_text_ai_search>
- Meilisearch API keys: <https://www.meilisearch.com/docs/reference/api/keys>
- Algolia pricing: <https://www.algolia.com/pricing>
- Algolia InstantSearch for frontend UI: <https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/js>
- Algolia Next.js InstantSearch support: <https://www.algolia.com/doc/api-reference/widgets/instantsearch-next/react>
