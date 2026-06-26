# Supabase Disk IO and Rakuten Feed Sync Audit

Date: 2026-06-26

## Scope

This audit started from the failed `rakuten-lego-feed-sync` path:

`syncRakutenLegoFeed -> importAffiliateFeedRowsForMerchant -> ensureAffiliateMerchant -> listCommerceMerchants`

It also reviews the shared single-merchant affiliate importer used by other feed cronjobs, commerce importer writes, current-offer snapshots, daily price history, homepage/theme/deal/merchant snapshot reads, and the current commerce indexes.

## Root Cause Hypotheses

1. Transient Supabase/Postgres pressure is plausible.
   The failed operation is a small `commerce_merchants` read, so the query itself is unlikely to deplete Disk IO. A project-level Disk IO budget warning can still cause PostgREST timeouts, aborted requests, statement timeouts, or connection failures. Before this patch, those details were masked.

2. Bad error handling is confirmed.
   `listCommerceMerchants` previously threw only `Unable to load commerce merchants.` and discarded Supabase `code`, `message`, `details`, and `hint`.

3. Missing env vars are possible but do not match the shown failure.
   `apps/rakuten-lego-feed-sync/src/main.ts` checks Supabase config before write mode and would throw a missing env message before reaching `listCommerceMerchants`.

4. RLS or wrong key is possible if the job is not using the service role.
   `commerce_merchants` has RLS enabled and no public select policy in the inspected migrations. The admin client must use the service role key. With a wrong key, the structured error should now expose the actual PostgREST/Postgres response.

5. Query inefficiency is not likely in `listCommerceMerchants`, but it exists nearby.
   The feed importer preloads all commerce offer seeds and latest rows for all merchants, even when importing one merchant. Snapshot jobs also page through broad snapshot/history tables.

## Confirmed Findings

- `listCommerceMerchants` reads `commerce_merchants` ordered by name. The table is small and has a unique slug plus `is_active` index; the missing `name` index is not a likely Disk IO root cause.
- `ensureAffiliateMerchant` loads all merchants first, so a transient Supabase read error aborts the job before Rakuten rows write.
- `importAffiliateFeedRowsForMerchant` already avoids many writes:
  - seed rows are upserted only when URL, active state, validation status, or notes changed.
  - latest offer rows are upserted only when status, price, currency, availability, or error changed.
  - unchanged latest rows only refresh timestamps in a batched update.
  - stale marks update only unseen valid active offers for authoritative feeds.
- `listCommerceOfferSeeds` loads all merchants, all latest offer rows, and all offer seed rows. This is convenient for admin and aggregate sync, but was heavy for single-merchant feed imports.
- The heavy startup preload was shared, not Rakuten-specific. All default callers of `importAffiliateFeedRowsForMerchant` inherited it before the scoped import read model was added.
- Daily price history upserts by `(set_id, region_code, currency_code, condition, recorded_on)`. Rerunning the same day can still rewrite unchanged rows and fire `updated_at`.
- Current-offer snapshots are upserted in 100-row chunks by `(set_id, region_code, currency_code, condition)`, but unchanged snapshot rows are not skipped.
- Merchant page snapshots compute changed merchant slugs for revalidation, but still upsert every merchant snapshot in write mode.
- Homepage/theme/deal snapshot builders page through all NL/EUR/new `commerce_current_offer_snapshots`.
- Homepage commerce snapshot also pages through all NL/EUR/new `pricing_daily_set_history` ordered by `recorded_on desc`. Existing price-history indexes are stronger for per-set reads than for this broad global history read.

## Code Changes Made

- Added `CommerceSupabaseQueryError` with structured diagnostics:
  - `operation`
  - `table`
  - `query`
  - `code`
  - `message`
  - `details`
  - `hint`
  - `elapsedMs`
  - retry attempt metadata
- Replaced generic merchant/latest/seed read failures with structured logging and detailed thrown errors.
- Added safe retry/backoff for transient read failures in:
  - `listCommerceMerchants`
  - `listCommerceOfferLatestRows`
  - `readCommerceOfferSeedRows`
- Retry defaults:
  - `COMMERCE_SUPABASE_READ_RETRY_MAX_ATTEMPTS=3`
  - `COMMERCE_SUPABASE_READ_RETRY_BASE_DELAY_MS=250`
  - `COMMERCE_SUPABASE_READ_RETRY_MAX_DELAY_MS=2000`
- Retry is limited to transient-looking failures, including statement timeouts, network/fetch aborts, too many connections, connection SQLSTATEs, deadlocks, serialization failures, and selected PostgREST connection errors.
- Added tests for structured merchant-load diagnostics and transient merchant-load retry.

Risk: low. The behavior change is limited to read failures and successful paths are unchanged. Worst case, a nonrecoverable transient-looking read takes a few extra seconds before failing.

## Scoped Single-Merchant Import Optimization

Added a generic scoped commerce import read model:

- loads the target merchant by `commerce_merchants.slug`
- loads only `commerce_offer_seeds` for that merchant id
- loads `commerce_offer_latest` only for those scoped seed ids
- preserves the importer-facing output shape as `{ merchant, offerSeeds }`
- uses the same structured Supabase diagnostics and retry/backoff for scoped reads

`importAffiliateFeedRowsForMerchant` now uses this scoped read model by default. Existing injected all-loader behavior is retained for tests and intentional global/admin aggregate flows.

Risk: low to medium. The successful import behavior is intended to stay the same, but startup reads are now narrower. The most important compatibility guard is that callers injecting `listCommerceOfferSeedsFn` still use that injected all-seed path.

## Caller Classification

Single-merchant import cronjobs now using the scoped read path through the shared importer:

- `alternate-feed-sync`
- `coolblue-feed-sync`
- `joybuy-feed-sync`
- `proshop-feed-sync`
- `rakuten-lego-feed-sync`
- `lidl-feed-sync`
- `coppenswarenhuis-feed-sync`
- `conrad-feed-sync`
- `goodbricks-feed-sync`
- `mediamarkt-feed-sync`
- `misterbricks-feed-sync`
- `brickfever-feed-sync`
- `brickspoint-feed-sync`
- `uniekebricks-feed-sync`

Global/admin/aggregate callers that should keep all-commerce reads:

- `apps/api/src/app/routes/admin-commerce.ts`
- `apps/api/src/app/routes/public-partner-widget.ts`
- `commerce-sync`
- `commerce-seed-generator`
- seed generation helpers in `libs/commerce/data-access-server`
- current-offer, homepage, theme, deal, collection, and merchant snapshot jobs

Production command inventory:

- `package.json` exposes feed scripts for the single-merchant import cronjobs above.
- Each feed app `project.json` `run` target builds the app and runs `node dist/apps/<feed-app>/main.cjs`.
- `scripts/affected-deployment-router.mjs` classifies these feed apps and `commerce-sync` as manual Render cron redeploy targets.
- No repo-level Render YAML was found in this workspace.

## Current Index Coverage

Confirmed existing coverage:

- `commerce_merchants.slug` unique.
- `commerce_offer_seeds`:
  - unique `(set_id, merchant_id)`
  - `(merchant_id)`
  - `(set_id)`
  - `(is_active)`
  - `(merchant_id, set_id)`
  - `(merchant_id, product_url)`
  - partial `(set_id, merchant_id)` for active valid seeds
- `commerce_offer_latest`:
  - unique `offer_seed_id`
  - `(fetch_status, availability)`
  - partial success EUR updated index
- `commerce_affiliate_discovered_sets`:
  - unique `(merchant_id, product_url)`
  - `(status, confidence, last_seen_at desc)`
  - `(normalized_set_id)`
  - `(merchant_id, status, last_seen_at desc)`
  - import retry partial index
- `pricing_daily_set_history`:
  - primary key `(set_id, region_code, currency_code, condition, recorded_on)`
  - `(set_id, recorded_on desc)`
  - partial NL/EUR/new `(set_id, recorded_on desc)`
- `commerce_current_offer_snapshots`:
  - primary key `(set_id, region_code, currency_code, condition)`
  - `(best_checked_at desc) where offer_count > 0`
  - `(best_price_minor) where best_price_minor is not null`
  - `(best_merchant_slug) where best_merchant_slug is not null`
- `commerce_merchant_page_snapshots`:
  - primary key `(merchant_slug)`
  - `(generated_at desc)`
  - `(merchant_id)`
- `collection_page_snapshots`:
  - primary key `(collection_slug, sort_key, page, page_size)`
  - `(generated_at desc)`

## Proposed Follow-up Code Changes

1. Reduce all-commerce hydration after individual seed writes.
   `updateCommerceOfferSeed` and `upsertCommerceOfferSeedByCompositeKey` still hydrate their return value by loading all merchants and all latest rows. Add a targeted hydrate-by-seed path if these write APIs become hot in cron traces.

   Risk: low to medium. The returned object shape must remain stable.

2. Skip unchanged daily price-history rows.
   Either prefetch today's existing rows and filter unchanged rows in code, or move the upsert into SQL with `where row(...) is distinct from row(...)`.

   Risk: medium. Daily history `updated_at` semantics change for unchanged reruns.

3. Skip unchanged current-offer snapshot rows.
   Compare existing snapshot rows by primary key before upsert, or use a SQL function with an `on conflict do update ... where` distinct guard.

   Risk: medium. Snapshot `computed_at` and `updated_at` behavior needs explicit product decision.

4. Upsert only changed merchant page snapshots.
   `getChangedMerchantSlugs` already exists. Reuse that result to filter `upsertMerchantPageSnapshots`.

   Risk: low to medium. Revalidation already uses this changed set, so the behavior is aligned.

5. Add structured Supabase diagnostics to other snapshot readers/writers.
   Several snapshot readers still throw generic `Unable to load ...` errors.

   Risk: low.

## Proposed Indexes, Not Applied

Run `explain (analyze, buffers)` first. Use `concurrently` only outside a transaction.

```sql
-- Helps broad homepage/theme/deal/merchant snapshot reads if code also adds
-- `offer_count > 0` to those read queries.
create index concurrently if not exists commerce_current_offer_snapshots_market_set_nonempty_idx
on public.commerce_current_offer_snapshots (
  region_code,
  currency_code,
  condition,
  set_id
)
where offer_count > 0;
```

Risk: low to medium. Adds index write cost to snapshot upserts. Most useful if read queries include `offer_count > 0`.

```sql
-- Helps broad homepage history reads ordered by recorded_on desc.
create index concurrently if not exists pricing_daily_set_history_nl_eur_new_recorded_on_set_idx
on public.pricing_daily_set_history (
  recorded_on desc,
  set_id
)
where region_code = 'NL'
  and currency_code = 'EUR'
  and condition = 'new';
```

Risk: low to medium. Adds index write cost to daily history upserts.

No new index was added for the scoped import loader. Existing coverage includes `commerce_offer_seeds(merchant_id)` for the scoped seed filter and unique `commerce_offer_latest(offer_seed_id)` for scoped latest rows. Consider a composite `(merchant_id, updated_at desc, id)` index only if `explain (analyze, buffers)` or `pg_stat_statements` shows the scoped seed ordering is hot.

## SQL Diagnostics

Slowest commerce queries:

```sql
select
  queryid,
  calls,
  round(total_exec_time::numeric, 2) as total_exec_ms,
  round(mean_exec_time::numeric, 2) as mean_exec_ms,
  round(max_exec_time::numeric, 2) as max_exec_ms,
  rows,
  shared_blks_read,
  shared_blks_hit,
  temp_blks_read,
  temp_blks_written,
  wal_bytes,
  left(query, 1200) as query_sample
from pg_stat_statements
where query ilike any (array[
  '%commerce_merchants%',
  '%commerce_offer_seeds%',
  '%commerce_offer_latest%',
  '%commerce_current_offer_snapshots%',
  '%commerce_affiliate_discovered_sets%',
  '%pricing_daily_set_history%',
  '%collection_page_snapshots%',
  '%commerce_merchant_page_snapshots%'
])
order by total_exec_time desc
limit 40;
```

Largest commerce tables and indexes:

```sql
select
  stat.relname,
  pg_size_pretty(pg_total_relation_size(stat.relid)) as total_size,
  pg_size_pretty(pg_relation_size(stat.relid)) as table_size,
  pg_size_pretty(pg_indexes_size(stat.relid)) as index_size,
  stat.n_live_tup,
  stat.n_dead_tup,
  stat.last_autovacuum,
  stat.last_autoanalyze
from pg_stat_user_tables stat
where stat.relname in (
  'commerce_merchants',
  'commerce_offer_seeds',
  'commerce_offer_latest',
  'commerce_current_offer_snapshots',
  'commerce_affiliate_discovered_sets',
  'pricing_daily_set_history',
  'collection_page_snapshots',
  'commerce_merchant_page_snapshots'
)
order by pg_total_relation_size(stat.relid) desc;
```

Sequential scans vs index scans:

```sql
select
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  round(
    seq_scan::numeric / nullif(seq_scan + idx_scan, 0),
    4
  ) as seq_scan_ratio
from pg_stat_user_tables
where relname in (
  'commerce_merchants',
  'commerce_offer_seeds',
  'commerce_offer_latest',
  'commerce_current_offer_snapshots',
  'commerce_affiliate_discovered_sets',
  'pricing_daily_set_history',
  'collection_page_snapshots',
  'commerce_merchant_page_snapshots'
)
order by seq_tup_read desc;
```

Dead tuples and autovacuum health:

```sql
select
  relname,
  n_live_tup,
  n_dead_tup,
  round(n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0), 4) as dead_tuple_ratio,
  vacuum_count,
  autovacuum_count,
  analyze_count,
  autoanalyze_count,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where relname in (
  'commerce_offer_seeds',
  'commerce_offer_latest',
  'commerce_current_offer_snapshots',
  'commerce_affiliate_discovered_sets',
  'pricing_daily_set_history',
  'collection_page_snapshots',
  'commerce_merchant_page_snapshots'
)
order by dead_tuple_ratio desc nulls last;
```

Write churn:

```sql
select
  relname,
  n_tup_ins,
  n_tup_upd,
  n_tup_hot_upd,
  n_tup_del,
  n_dead_tup,
  round(n_tup_hot_upd::numeric / nullif(n_tup_upd, 0), 4) as hot_update_ratio
from pg_stat_user_tables
where relname in (
  'commerce_offer_seeds',
  'commerce_offer_latest',
  'commerce_current_offer_snapshots',
  'commerce_affiliate_discovered_sets',
  'pricing_daily_set_history',
  'collection_page_snapshots',
  'commerce_merchant_page_snapshots'
)
order by n_tup_upd desc;
```

Index usage:

```sql
select
  relname,
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
from pg_stat_user_indexes
where relname in (
  'commerce_merchants',
  'commerce_offer_seeds',
  'commerce_offer_latest',
  'commerce_current_offer_snapshots',
  'commerce_affiliate_discovered_sets',
  'pricing_daily_set_history',
  'collection_page_snapshots',
  'commerce_merchant_page_snapshots'
)
order by relname, idx_scan asc;
```

Explain the reads most likely to drive Disk IO:

```sql
explain (analyze, buffers)
select
  set_id,
  best_price_minor,
  best_merchant_name,
  best_merchant_slug,
  best_availability,
  best_product_url,
  best_checked_at,
  offer_count,
  computed_at,
  trusted_offer_count,
  comparable_offer_count
from public.commerce_current_offer_snapshots
where region_code = 'NL'
  and currency_code = 'EUR'
  and condition = 'new'
  and offer_count > 0
order by set_id
limit 1000;
```

```sql
explain (analyze, buffers)
select
  set_id,
  headline_price_minor,
  reference_price_minor,
  recorded_on,
  observed_at
from public.pricing_daily_set_history
where region_code = 'NL'
  and currency_code = 'EUR'
  and condition = 'new'
order by recorded_on desc
limit 1000;
```

Check exact merchant load behavior:

```sql
explain (analyze, buffers)
select
  id,
  slug,
  name,
  is_active,
  source_type,
  affiliate_network,
  notes,
  created_at,
  updated_at
from public.commerce_merchants
order by name asc;
```

## Immediate Recommendation

Do not run risky migrations until the diagnostics above identify the hot statements. If the warning correlates with overnight commerce jobs, prioritize:

1. Inspect `pg_stat_statements` by `total_exec_time`, `shared_blks_read`, `temp_blks_written`, and `wal_bytes`.
2. Check dead tuple ratios on `commerce_offer_latest`, `pricing_daily_set_history`, and snapshot tables.
3. Add merchant-scoped offer seed loading before adding indexes for the generic all-seed loader.
4. Add no-op guards for daily history and snapshot upserts if write churn is high.
