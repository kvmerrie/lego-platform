# Commerce Current-Offer Snapshot

## Goal

Public pages currently render correct prices, but they still rebuild current-offer
summaries at request, ISR, or API time from:

- `commerce_offer_seeds`
- `commerce_offer_latest`
- `commerce_merchants`

That keeps correctness centralized, but it makes common render paths repeat the
same joins, normalization, eligibility checks, unit typing, reliability-tier
checks, sorting, and best-offer selection.

The next performance step is a compact current-offer snapshot that public reads
can consume directly, while preserving the existing live reconstruction as a
fallback until the snapshot is proven in production.

## Current Consumers

Current-offer summaries are needed by these paths:

- homepage commerce rails
- `/deals`
- set detail hero, comparison rows, JSON-LD-adjacent price context, and similar
  set cards
- theme pages
- `/api/catalog/set-cards`
- `/api/v1/catalog/current-offer-summaries`
- recently viewed and follow/discovery rails when they enrich set cards
- similar-set rails

The most important read API today is
`listCatalogCurrentOfferSummariesBySetIds`. It fetches a scoped set-id list, but
still reconstructs each summary from normalized live offer rows.

## Required Snapshot Fields

The card/detail surface needs one compact summary per set plus enough offer-row
detail for comparison tables and debugging.

Per set:

- `set_id`
- `region_code`
- `currency_code`
- `condition`
- `best_offer_seed_id`
- `best_merchant_id`
- `best_merchant_slug`
- `best_merchant_name`
- `best_price_minor`
- `best_availability`
- `best_product_url`
- `best_commercial_unit_type`
- `best_checked_at`
- `offer_count`
- `trusted_offer_count`
- `strategic_manual_offer_count`
- `comparable_offer_count`
- `next_best_price_minor`
- `price_spread_minor`
- `has_anomalous_spread`
- `snapshot_source`
- `computed_at`
- `created_at`
- `updated_at`

Optional row payload for comparison UI:

- `offers jsonb`

The JSON payload should contain only the public comparison fields already exposed
by `CatalogRuntimeOffer`: merchant slug/name, URL, price, currency, market,
condition, availability, checked timestamp, and commercial unit type. It should
not include parser-only fields, raw feed payloads, secrets, or internal error
state.

## Recommended Schema

Use a normal table written by `commerce-sync`, not a generated artifact or
runtime-only view:

```sql
create table if not exists public.commerce_current_offer_snapshots (
  set_id text not null,
  region_code text not null default 'NL',
  currency_code text not null default 'EUR',
  condition text not null default 'new',
  best_offer_seed_id uuid null references public.commerce_offer_seeds(id) on delete set null,
  best_merchant_id uuid null references public.commerce_merchants(id) on delete set null,
  best_merchant_slug text null,
  best_merchant_name text null,
  best_price_minor integer null check (best_price_minor is null or best_price_minor > 0),
  best_availability text null,
  best_product_url text null,
  best_commercial_unit_type text null,
  best_checked_at timestamptz null,
  offer_count integer not null default 0 check (offer_count >= 0),
  trusted_offer_count integer not null default 0 check (trusted_offer_count >= 0),
  strategic_manual_offer_count integer not null default 0 check (strategic_manual_offer_count >= 0),
  comparable_offer_count integer not null default 0 check (comparable_offer_count >= 0),
  next_best_price_minor integer null check (next_best_price_minor is null or next_best_price_minor > 0),
  price_spread_minor integer null check (price_spread_minor is null or price_spread_minor >= 0),
  has_anomalous_spread boolean not null default false,
  offers jsonb not null default '[]'::jsonb,
  snapshot_source text not null default 'commerce_sync',
  computed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (set_id, region_code, currency_code, condition)
);

create index if not exists commerce_current_offer_snapshots_best_checked_idx
on public.commerce_current_offer_snapshots(best_checked_at desc)
where offer_count > 0;

create index if not exists commerce_current_offer_snapshots_best_price_idx
on public.commerce_current_offer_snapshots(best_price_minor)
where best_price_minor is not null;
```

RLS should match the public catalog read posture: public read is acceptable for
the compact fields, writes remain service-role only.

## Option Comparison

### SQL view

Pros:

- no write path
- always current
- easy to inspect

Cons:

- still executes joins and business logic at read time
- hard to keep deterministic best-offer logic aligned with TypeScript
- no meaningful reduction for ISR hot paths

Use only for diagnostics, not as the primary render path.

### Materialized view

Pros:

- compact read path
- database-owned refresh

Cons:

- refresh orchestration and locking need care
- incremental refresh is awkward
- still duplicates TypeScript business rules in SQL

Good later if the SQL version becomes canonical. Not the smallest safe move now.

### Commerce-sync-written table

Pros:

- uses the same TypeScript selector/normalization logic as cards/detail
- idempotent upsert fits existing `commerce-sync`
- compact per-set reads
- easy fallback to current live reconstruction when missing or stale
- easy diagnostics: snapshot count, stale count, changed set count

Cons:

- snapshot freshness depends on commerce-sync cadence
- must avoid treating a missing snapshot as "no offer" during rollout

Recommended.

### Generated artifact

Pros:

- static and fast

Cons:

- pushes volatile offer freshness into deploy/artifact review
- can bloat bundles or server artifacts
- weaker fit for feed-first commerce

Not recommended for current live prices.

## Recommended Architecture

1. Feed jobs continue to own `commerce_offer_latest` freshness.
2. `commerce-sync` remains aggregate-only by default.
3. During write mode, `commerce-sync` builds current-offer snapshots from the
   same joined latest-offer universe used for generated artifacts and daily
   pricing history.
4. The snapshot writer upserts one compact row per `(set_id, region, currency,
condition)`.
5. Public reads first try `commerce_current_offer_snapshots` for requested
   set ids.
6. If a requested set has no snapshot, or the snapshot is older than the
   accepted freshness window, public reads fall back to the current live
   reconstruction.
7. Candidate RPCs can later read snapshot rows instead of latest/seeds/merchants.

The fallback rule is important: a missing or stale snapshot must never make cards
show "Prijs volgt" while the live offer tables still contain eligible offers.

## Code Paths To Move First

Phase 1 should only add the write path and diagnostics:

- build snapshots inside `libs/api/data-access-server` or a new commerce
  server data-access helper
- call it from `runCommerceSync` write mode after latest inputs are loaded
- log `current_offer_snapshots_built`, `current_offer_snapshots_upserted`,
  `snapshot_offer_count`, and `snapshot_missing_best_offer_count`
- do not switch web reads yet

Phase 2 should add read-side fallback:

- `listCatalogCurrentOfferSummariesBySetIds`
- `/api/v1/catalog/current-offer-summaries`
- set detail live-offer reads can keep using row-level live offers until the
  comparison payload is proven complete

Phase 3 can move candidate queries:

- `list_catalog_current_offer_candidate_set_ids`
- homepage and `/deals` current-offer fallback rails

## Expected Performance Impact

Today, a targeted card enrichment for 240 candidate sets still performs:

- seed lookup by set id
- merchant lookup
- latest lookup by seed id
- TypeScript normalization per latest row
- unit classification from seed notes/product URL
- reliability tier checks
- sorting and best-offer selection per set

With snapshots, the same path can load about 240 compact rows and normalize only
the already selected public payload. That removes the repeated multi-table
reconstruction from render/ISR paths and should reduce API latency most on:

- homepage build/ISR
- `/deals`
- theme pages with many candidate cards
- similar/recently-viewed rails that enrich 12-40 set ids

The table also keeps Next `unstable_cache` payloads small because callers can
cache candidate ids and compact summaries instead of joined offer universes.

## Stale-Data Tradeoffs

The snapshot is deliberately one step behind `commerce_offer_latest` until
`commerce-sync` runs. That is acceptable if:

- feed jobs still revalidate changed set paths directly when prices change
- `commerce-sync` runs often enough to refresh aggregate snapshot state
- public reads fall back to live reconstruction when a snapshot is missing or
  too old
- diagnostics surface snapshot age and missing snapshot counts

Do not use the snapshot as the only source for set detail comparison rows until
the JSON offer payload has parity tests against the live reconstruction.

## Migration Plan

1. Add table migration and clean baseline entry.
2. Add pure snapshot builder tests using multiple merchants, reliability tiers,
   unit mismatches, stale/error offers, and 43300-style timestamp behavior.
3. Add `commerce-sync` writer in write mode only.
4. Keep check mode read-only but report expected snapshot drift.
5. Run production write once and compare:
   - snapshot row count
   - live summary count
   - mismatched best-offer count
   - missing snapshot count
6. Switch `listCatalogCurrentOfferSummariesBySetIds` to snapshot-first with
   live fallback.
7. Switch candidate RPC to snapshot-backed ranking once parity is clean.

## Do Not Implement Yet

Do not remove the existing live reconstruction in the first PR. It is still the
safety net for:

- newly imported offers before the next aggregate run
- debugging feed/parser issues
- snapshot writer regressions
- set detail comparison parity checks
