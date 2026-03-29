# Next-Phase Roadmap

This roadmap is the practical follow-on to the current MVP. It is intentionally short, cost-aware, and biased toward deepening the existing product slice rather than expanding into new domains.

Use this document with:

- `docs/architecture/product-vision.md`
- `docs/architecture/mvp-search-spike.md`
- `docs/operations/mvp-release-checklist.md`
- `docs/operations/mvp-production-rollout-checklist.md`
- `docs/operations/mvp-operator-troubleshooting.md`

## Current Baseline

The shipped MVP already covers:

- curated homepage discovery and featured-set browsing
- public set-detail pages with reviewed Dutch price context, affiliate offers, and price history
- signed-in owned and wanted persistence
- compact collector profile editing
- snapshot-backed catalog and commerce sync flows
- production rollout, smoke-check, troubleshooting, and alerting guidance

That means the next phase should focus on making the current slice feel broader, clearer, and more dependable before adding major new product surface area.

## Now

Prioritize these next:

1. Curated catalog depth, still in small product-ready batches.
   - Continue expanding only with product-presentable sets.
   - Keep synced and public sets coupled for now.
   - Improve discovery through better curation, not broad catalog coverage.

2. Commerce clarity and trust polish.
   - Keep refining how reviewed price, tracked history, offer posture, and unavailable states are explained.
   - Prefer clearer collector guidance over more commerce mechanics.
   - Keep Dutch-only commerce scope until the current slice feels fully trustworthy.

3. Collector account confidence.
   - Keep improving signed-in UX, auth clarity, saved-state feedback, and profile polish.
   - Finish production auth hardening operationally, especially around SMTP and rate-limit expectations.
   - Make the collector area feel reliable and productized, not transitional.

## Next

Move to these only after the current slice is stable:

1. Small search quick-find, but only when catalog breadth justifies it.
   - This waits on catalog scale.
   - Use the threshold in `docs/architecture/mvp-search-spike.md`.
   - Keep the first search scope to direct public set lookup only.

2. More deliberate editorial landing quality.
   - Expand curated homepage and page-builder storytelling only if there is enough content bandwidth to keep it good.
   - This waits on stronger content and design bandwidth, not on new platform work.

3. Narrow commerce coverage expansion.
   - Add more reviewed sets or merchants only after the current reviewed slice is consistently useful and operator-friendly.
   - Prefer careful allowlist growth over broader feed complexity.

## Later

These are later-phase moves, not the next phase:

1. Broader catalog browsing features.
   - search result pages
   - filters
   - sort and browse tools

2. Richer commerce mechanics.
   - alerts
   - click tracking
   - redirect handling
   - multi-region pricing

3. Broader platform surface area.
   - public collector pages
   - richer social or media features
   - mobile or native clients
   - significant admin expansion beyond launch support

## Explicitly Deferred

Do not build these yet:

- broad catalog search before the public set count meaningfully grows
- faceted browse, filters, or catalog-index pages
- more regions or currencies
- affiliate click tracking and redirect infrastructure
- alerts and notifications
- public social features
- new commerce data sources
- new backend platforms or infra-heavy search stacks

## Waiting On Catalog Scale

These items should wait until the public product-ready set scope is materially larger:

- quick-find search
- search-specific ranking or relevance tuning
- broader browse and filter experiences
- any stronger need for search-specific analytics

## Waiting On Design Or Brand Bandwidth

These items are worthwhile, but should wait until there is dedicated design energy:

- deeper editorial art direction
- custom illustration or icon systems
- richer landing-page composition beyond the current shell and featured-set work
- broader design-system refinement outside the highest-traffic MVP surfaces

## Low-Cost Guardrail

If a next-phase idea adds both:

- a new service or infrastructure dependency
- and a new product surface area

it is probably too broad for the next phase.

Prefer work that:

- deepens the value of the current curated set slice
- improves trust and clarity
- reuses the existing snapshot-backed architecture
- keeps operational burden light
