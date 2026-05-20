# Commerce Sync

This repository keeps the first pricing and affiliate slice snapshot-backed. The public web app reads generated Dutch-market buy guidance through `libs/pricing/data-access` and `libs/affiliate/data-access`; it does not call merchants at request time.

See also:

- `docs/architecture/commerce-current-offer-snapshot.md`
- `docs/operations/pricing-history.md`
- `docs/operations/mvp-operator-troubleshooting.md`

## Current Scope

- market: Netherlands only
- currency: `EUR` only
- condition: `new` only
- runtime path: `apps/commerce-sync`
- server-only support:
  - `libs/pricing/data-access-server`
  - `libs/affiliate/data-access-server`
- generated pricing artifacts:
  - `libs/pricing/data-access/src/lib/pricing-observations.generated.ts`
  - `libs/pricing/data-access/src/lib/price-panel-snapshots.generated.ts`
  - `libs/pricing/data-access/src/lib/pricing-sync-manifest.generated.ts`
- generated affiliate artifacts:
  - `libs/affiliate/data-access/src/lib/affiliate-offers.generated.ts`
  - `libs/affiliate/data-access/src/lib/affiliate-sync-manifest.generated.ts`

## Current Inputs

The operational commerce source of truth now lives in Supabase:

- `commerce_merchants`
- `commerce_offer_seeds`
- `commerce_offer_latest`
- `commerce_benchmark_sets`

What remains local on purpose:

- `libs/pricing/data-access-server/src/lib/pricing-reference-values.ts`
- `libs/affiliate/data-access-server/src/lib/merchant-config.ts`

Those local files now act as reference pricing and merchant presentation or host metadata.
They are no longer the source of active seed URLs.

## Commerce Backoffice Foundation

Brickhunt now also has a first commerce backoffice in the Angular admin app.

What moved into Supabase:

- `commerce_merchants`
- `commerce_offer_seeds`
- `commerce_offer_latest`

What that backoffice owns:

- merchant CRUD
- set-to-merchant seed URLs
- benchmark-set reference batch for merchant-quality work
- basic coverage and stale or broken seed visibility

## Benchmark Batch Workflow

The benchmark batch is intentionally small.

Use it to:

- track 5–10 high-signal sets with broad merchant relevance
- see which major merchants are still missing per benchmark set
- harden parser quality against a stable reference group before scaling wider

What stays manual on purpose:

- choosing which sets belong in the benchmark batch
- filling in missing merchant URLs for those sets
- deciding when a merchant is reliable enough to scale beyond the benchmark batch

What still remains intentionally snapshot-backed:

- the public web app still reads generated pricing and affiliate artifacts
- the sync job now rebuilds those artifacts from Supabase-managed seeds and latest fetched offer state

Treat the admin + Supabase tables as the operational source of truth for the commerce layer.

This phase intentionally uses a very small, operator-reviewed allowlist:

- a small reviewed set allowlist drawn from the current public curated catalog
- `LEGO NL`
- `bol`
- `Intertoys`

Example boilerplate:

- `.env.sync.example`

The current commerce sync slice needs the normal server-side Supabase credentials for both read and write flows:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Default `write` mode is aggregate-only. It reads `commerce_offer_latest`, writes generated commerce artifacts, and writes one daily pricing-history point per eligible set. It does not call merchant product pages.

Outbound merchant access is only needed for explicit legacy scraper refresh runs with `--refresh-merchants` or `--legacy-scrape`.

## Run The Sync

From the workspace root:

```bash
pnpm sync:commerce
```

Or directly:

```bash
pnpm nx run commerce-sync:run
```

Scoped aggregate run for a selected batch:

```bash
pnpm nx run commerce-sync:run -- --set-ids 10300,10320,10317
```

Scoped aggregate run for selected sets and merchants:

```bash
pnpm nx run commerce-sync:run -- --write --set-ids 10316,76437 --merchant-slugs intertoys,lego-nl
```

Scoped default runs do not refresh merchant pages. They aggregate current
`commerce_offer_latest` rows, scope daily-history writes to the requested sets,
and still rebuild generated pricing and affiliate artifacts from the full current
Supabase state afterward so committed artifact files stay coherent.

Legacy scraper refresh is manual and explicit:

```bash
pnpm nx run commerce-sync:run -- --write --refresh-merchants --set-ids 10316 --merchant-slugs top1toys
```

`--legacy-scrape` is accepted as an alias for `--refresh-merchants`. Keep these
runs scoped and operator-driven; feed jobs are the default owner of offer
freshness. A legacy scraper run without `--merchant-slugs` is rejected to avoid
accidental broad scraping.

When you run the higher-level coverage workflow, `--skip-sync-when-no-seed-work`
can skip this scoped sync step if the merchant batch produced no new candidates
and validated nothing. `--force-sync` overrides that and keeps the scoped sync on.

## Check Mode

Check mode rebuilds the Dutch commerce artifacts from the current Supabase commerce state in memory and fails if committed generated files would change.

```bash
pnpm sync:commerce:check
```

Use check mode before overwriting artifacts when reviewing changes.

For local-hook clarity, the same deterministic artifact-only path is also available as:

```bash
pnpm sync:commerce:local:check
```

This check does not call merchants and does not write Supabase latest or history rows.
It still reads Supabase aggregate data, so local runs need `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` exported or present in `.env.local`. If those env
values are missing, or the check loads zero seeds/latest rows, the command fails
before comparing generated artifacts so operators do not chase a false stale
artifact diff.

In generic GitHub CI, the commerce check is skipped when Supabase service-role
credentials are not configured. The workflow logs:

```text
Skipping commerce Supabase check: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured
```

This skip only applies to CI. Local/pre-push checks remain strict so real
artifact drift is still caught when operator Supabase env is available.

## Operator Notes

- The current slice is set-detail only.
- No runtime merchant calls and no click tracking are included.
- The current snapshot-backed price panel remains unchanged for the public app.
- Feed jobs refresh `commerce_offer_latest`; `commerce-sync` aggregates those latest offers by default.
- `pnpm sync:commerce` now also writes one daily Dutch price-history point per commerce-enabled set into Supabase Postgres.
- Future current-offer snapshot work should keep `commerce-sync` as the writer
  and preserve live latest-offer reconstruction as the read-side fallback until
  snapshot parity is proven.
- Those daily history rows are stored indefinitely for now; the current UI reads only the latest 30 days.
- `pnpm sync:commerce` is aggregate-only by default and never runs scraper refresh implicitly in production.
- `pnpm nx run commerce-sync:run -- --set-ids ...` is the fast operator path for batch coverage work. It scopes daily-history metrics to the requested sets while keeping generated files consistent after the run.
- Legacy scraper lanes are manual only via `--refresh-merchants` or `--legacy-scrape`.
- Legacy scraper runs must include an explicit `--merchant-slugs` scope.
- `top1toys` is legacy/manual and is not part of the default production refresh path.
- The upstream coverage reports and workflow batches now default to actionable sets only. Retired or deprioritized exceptions such as `70728` only re-enter that queue when you explicitly use `--include-non-active` on the reporting or workflow command.
- When a set stays stuck in `partial_primary_coverage`, use `pnpm nx run commerce-seed-generator:run -- --gap-audit ...` before rerunning sync. That tells you whether the blocker is a missing seed, a stale or invalid seed, or a refresh problem on an already valid seed. The gap audit also adds a conservative `recover_now / verify_first / parked` hint so operators can separate cheap wins from queues that are better parked for later.
- `pnpm sync:commerce:check` and `pnpm sync:commerce:local:check` remain generated-artifact drift checks only and do not write latest or history rows.
- Merchant presentation metadata and reference pricing remain curated locally.
- Active merchant and seed scope now come from Supabase, not from local seed files.
- Current merchant support outside default aggregate path:
  - primary/manual: `lego-nl`, `intertoys`, `bol`, `misterbricks`
  - secondary/manual: `smyths-toys`, `kruidvat`, `wehkamp`
  - legacy/manual scraper: `top1toys`
  - blocked/deprioritized: `amazon-nl`, `proshop`
- If a stable merchant product page cannot be verified for a seed, keep the seed reviewable in admin instead of guessing a replacement URL.
- Technical workflow only: merchant approvals, affiliate terms, and legal review still require manual business validation outside the repo.

## Production Scheduling

Commerce sync is safe to run repeatedly in production.

Why it is idempotent:

- generated pricing and affiliate artifacts are deterministic
- artifact writers only overwrite files when the rendered output actually changes
- daily price-history writes use an upsert keyed by `(set_id, region_code, currency_code, condition, recorded_on)`, so reruns on the same day update the same row instead of creating duplicates

Recommended production schedule:

- every 6 hours

Recommended Render scheduled job command:

```bash
pnpm sync:commerce
```

Render scheduled job notes:

- run this as a scheduled background job, not as an always-on service
- keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` scoped to the scheduled job only
- use `pnpm sync:commerce:local:check` in local hooks or fast local review
- use `pnpm sync:commerce:check` manually or in CI when you want an artifact drift review without writing latest offers or history rows
- a healthy scheduled job should log one `start` line, an aggregate-only mode line, one daily-history summary line, and one `end` line with refresh, offer, and history counts; if it never reaches `end`, treat the run as failed and inspect Render logs before retrying
- refreshed-seed lines should only appear in explicit legacy scraper runs with `--refresh-merchants` or `--legacy-scrape`

## Staging Commerce Copy

The admin Operations page has a manual **Sync commerce from production** action
for making staging/local commerce testing look like production. It is guarded by
the admin secret, defaults to dry-run, and refuses to run in production.

Scope:

- copied: `commerce_merchants`, `commerce_offer_seeds`, `commerce_offer_latest`, `commerce_benchmark_sets`, `pricing_daily_set_history`
- not copied: articles, previews, editorial feed items, users or any other content tables

Required envs:

- target/current environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- production source: `SUPABASE_URL_PRODUCTION`, `SUPABASE_SERVICE_ROLE_KEY_PRODUCTION`
- admin guard: `ADMIN_PROMOTE_SECRET`

Operator flow:

1. Open Admin > Commerce > Operations.
2. Run **Dry-run** and verify the table counts.
3. Run **Sync commerce from production** only after the confirmation warning.

## Affiliate Feed Imports

Feed imports write merchant rows into the same Supabase commerce tables used by
the normal commerce sync:

- `commerce_merchants`
- `commerce_offer_seeds`
- `commerce_offer_latest`

Available feed commands:

- `pnpm sync:lidl-feed`
- `pnpm sync:alternate-feed`
- `pnpm sync:awin-feed`
- `pnpm sync:coppenswarenhuis-feed`
- `pnpm sync:conrad-feed`
- `pnpm sync:goodbricks-feed`
- `pnpm sync:mediamarkt-feed`
- `pnpm sync:misterbricks-feed`

Recommended feed cadence:

| Merchant         | Source       | Production cadence                        | Notes                                                                 |
| ---------------- | ------------ | ----------------------------------------- | --------------------------------------------------------------------- |
| Conrad           | TradeTracker | every 6 hours, offset from other jobs     | Newer broad feed. Watch duration, parse failures and 429s.            |
| Goodbricks       | Adtraction   | every 6 hours, offset from other jobs     | Trusted feed merchant; timestamp refreshes should keep rows current.  |
| Alternate        | TradeTracker | every 6 hours, offset from other jobs     | Trusted feed merchant; production imports should not be capped.       |
| Coolblue         | Awin         | every 6 hours, offset from other jobs     | Trusted feed merchant; watch gzip/CSV fetch failures.                 |
| Lidl             | TradeTracker | every 6 hours while campaign stock exists | Seasonal coverage; no-op/low row runs can be expected.                |
| MediaMarkt       | TradeDoubler | once daily after feed refresh             | Large XML feed; keep streaming and do not use `--max-products`.       |
| MisterBricks     | Channable    | once daily after feed refresh             | Direct non-affiliate feed; trusted for current offer comparisons.     |
| Coppenswarenhuis | TradeTracker | once daily after feed refresh             | Strategic/manual until availability quality is consistently reliable. |

All feed jobs currently treat missing-from-feed as non-authoritative unless a
job explicitly opts into authoritative stale retirement. That is intentional:
missing rows should not hide known live product URLs when a feed is incomplete
or scoped. A healthy run should still refresh timestamps for all matched rows
that are present in the feed, even if price and availability did not change.

MediaMarkt uses the TradeDoubler unlimited XML feed with gzip compression. The
sync streams download, decompressing and parsing product-by-product, and keeps
only strict LEGO rows with exact set-number matches.

Recommended Render scheduled job command:

```bash
pnpm sync:mediamarkt-feed
```

Recommended cadence:

- once daily, preferably after the MediaMarkt feed refresh window

MediaMarkt job notes:

- keep `TRADEDOUBLER_MEDIAMARKT_FEED_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` scoped to the scheduled job
- use `--dry-run --debug-samples 10 --debug-unmatched-samples 20` for local parser review
- use `--max-products <n>` only for local/debug runs, never for the production job
- the sync never uses EAN, MediaMarkt SKU, advertiser IDs, source product IDs, or TradeDoubler product IDs as LEGO set numbers

Coppenswarenhuis uses a TradeTracker XML feed and writes through the same strict
affiliate importer. It keeps only LEGO construction-set candidates with a set
number in human product text and filters games, software, books, clothing and
accessory-like products before offer import.

Recommended Render scheduled job command:

```bash
pnpm sync:coppenswarenhuis-feed
```

Recommended cadence:

- once daily, preferably after the Coppenswarenhuis feed refresh window

Coppenswarenhuis job notes:

- keep `TRADETRACKER_COPPENSWARENHUIS_FEED_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` scoped to the scheduled job
- use `--dry-run --debug-samples 10 --debug-unmatched-samples 20` for local parser review
- use `--max-products <n>` only for local/debug runs, never for the production job
- the sync never uses EAN, SKU, product IDs, feed IDs, affiliate IDs or deeplink IDs as LEGO set numbers

Conrad uses the TradeTracker XML v2 feed and writes through the same strict
affiliate importer. The sync streams XML product entries, keeps only LEGO
construction-set candidates with a detected set number, and filters accessories,
display cases, lighting, books, keychains, loose parts and alternative brick
brands before offer import.

Recommended Render scheduled job command:

```bash
pnpm sync:conrad-feed
```

Recommended cadence:

- every 6 hours, offset from the other feed jobs, for example `35 */6 * * *`

Conrad job notes:

- keep `TRADETRACKER_CONRAD_FEED_URL`, `TRADETRACKER_CONRAD_MERCHANT_SLUG`, `TRADETRACKER_CONRAD_MERCHANT_NAME`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` scoped to the scheduled job
- use `pnpm sync:conrad-feed -- --dry-run --debug-samples 10 --debug-unmatched-samples 20` for local parser review
- use `pnpm sync:conrad-feed -- --dry-run --max-products 200 --debug-samples 5` for quick feed-shape checks
- use `--report-unmatched-path tmp/conrad-unmatched.json` when reviewing LEGO candidates that do not match the catalog
- use `--max-products <n>` only for local/debug runs, never for the production job
- the sync never uses EAN, TradeTracker product IDs, affiliate IDs or deeplink IDs as LEGO set numbers
- after a production import changes offers, the normal commerce aggregation and public-web revalidation flow can refresh generated deal artifacts and public pages

MisterBricks uses a Channable XML feed and writes through the same strict offer
import path as the affiliate feeds, but the merchant is stored as a direct
non-affiliate source. It can contribute prices, availability and shop URLs for
price comparison, but it does not claim an affiliate deeplink/network.

Recommended Render scheduled job command:

```bash
pnpm sync:misterbricks-feed
```

Recommended cadence:

- once daily, preferably after the MisterBricks feed refresh window

MisterBricks job notes:

- keep `MISTERBRICKS_FEED_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` scoped to the scheduled job
- use `--dry-run --debug-samples 10 --debug-unmatched-samples 20` for local parser review
- use `--max-products <n>` only for local/debug runs, never for the production job
- the sync never uses EAN, SKU, product IDs, feed IDs or URL IDs as LEGO set numbers

## Troubleshooting Notes

Use `docs/operations/mvp-operator-troubleshooting.md` for the fast triage flow.

Common commerce sync interpretations:

- `Generated commerce artifacts are stale` means artifact drift was detected and needs review
- `pnpm sync:commerce:check` does not write history rows; only `pnpm sync:commerce` does
- missing Supabase write envs on the scheduled job will surface as history-write failures even when artifact generation itself is healthy
- `skipped_stale_or_error` is paired with `stale_or_error_merchant_counts`, `stale_fetch_status_merchant_counts`, and `stale_observed_at_too_old_merchant_counts`; use those merchant-scoped counts before changing ranking or freshness policy.
- `skipped_unavailable_for_headline` is paired with `unavailable_for_headline_merchant_counts`; high counts usually mean `unknown`, `out_of_stock`, or `preorder` availability is being excluded from headline history as intended.
- `zero_points_reason=no_eligible_latest_offers` means all loaded latest rows were filtered out by status, freshness, currency, price, availability, merchant trust, or unit comparability.
- `latest_rows_loaded=0` on a non-scoped production run usually means the Supabase input query or env is wrong, not that generated artifacts are stale.
- `current_offer_snapshot_mismatches > 0` blocks snapshot-first read rollout and needs parity investigation before deploy.

Freshness audit queries:

```sql
-- Top merchants causing stale/error/unavailable latest rows.
select
  m.slug as merchant_slug,
  l.fetch_status,
  l.availability,
  count(*) as rows,
  min(coalesce(l.observed_at, l.fetched_at, l.updated_at)) as oldest_seen_at,
  max(coalesce(l.observed_at, l.fetched_at, l.updated_at)) as newest_seen_at
from commerce_offer_latest l
join commerce_offer_seeds s on s.id = l.offer_seed_id
join commerce_merchants m on m.id = s.merchant_id
group by m.slug, l.fetch_status, l.availability
order by rows desc, merchant_slug asc
limit 50;

-- Old success rows that should be excluded by freshness before they become headline history.
select
  m.slug as merchant_slug,
  s.set_id,
  l.fetch_status,
  l.availability,
  l.price_minor,
  l.currency_code,
  l.observed_at,
  l.fetched_at,
  l.updated_at,
  s.validation_status,
  s.is_active as seed_active,
  m.is_active as merchant_active
from commerce_offer_latest l
join commerce_offer_seeds s on s.id = l.offer_seed_id
join commerce_merchants m on m.id = s.merchant_id
where l.fetch_status = 'success'
  and coalesce(l.observed_at, l.fetched_at, l.updated_at) < now() - interval '48 hours'
order by coalesce(l.observed_at, l.fetched_at, l.updated_at) asc
limit 100;

-- Feed-owned rows whose checked timestamp was not refreshed recently.
select
  m.slug as merchant_slug,
  count(*) as stale_success_rows,
  min(l.observed_at) as oldest_observed_at,
  max(l.observed_at) as newest_observed_at
from commerce_offer_latest l
join commerce_offer_seeds s on s.id = l.offer_seed_id
join commerce_merchants m on m.id = s.merchant_id
where l.fetch_status = 'success'
  and s.is_active = true
  and s.validation_status = 'valid'
  and m.is_active = true
  and l.observed_at < now() - interval '48 hours'
group by m.slug
order by stale_success_rows desc, merchant_slug asc;
```

Operator triage:

1. If one merchant dominates `stale_fetch_status_merchant_counts`, inspect that feed job for upstream 403/429/timeouts or parser errors.
2. If one merchant dominates `stale_observed_at_too_old_merchant_counts` but its feed job reports healthy `matched_offers_seen`, check timestamp refresh and source identity matching.
3. If one merchant dominates `unavailable_for_headline_merchant_counts`, inspect raw availability mapping before changing merchant reliability or deal logic.
4. If stale rows belong to strategic/manual merchants, prefer queue cleanup or seed validation review over changing public ranking.

Current production freshness read, based on the May 2026 commerce-sync sample:

| Merchant                  | Current signal                 | Likely cause                                            | Recommended action                                                                  |
| ------------------------- | ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| MediaMarkt                | `observed_at_too_old`          | Daily feed cadence or products no longer matched.       | Inspect next feed log: `matched_offers_seen` vs `remaining_stale_success_latest`.   |
| Coppenswarenhuis          | `observed_at_too_old`          | Strategic/manual feed quality and availability mapping. | Keep strategic/manual; review raw availability and unmatched/stale samples.         |
| Lidl                      | `observed_at_too_old`          | Seasonal campaign feed or product absence.              | Treat low stale counts as expected outside active campaigns.                        |
| Alternate                 | stale/error count              | Feed-owned; needs status split from next diagnostics.   | If `remaining_stale_success_latest` is high, review identity/missing-from-feed.     |
| Goodbricks                | stale/error count              | Feed-owned; needs status split from next diagnostics.   | If timestamp refresh is low while matches are high, investigate source identity.    |
| MisterBricks              | stale/error count              | Direct feed; likely old rows not seen in current feed.  | Compare `matched_offers_seen` with `remaining_stale_success_latest` after next run. |
| Coolblue                  | stale/error count              | Awin feed-owned; needs status split from next run.      | Watch gzip/CSV fetch failures and missing-from-feed samples.                        |
| Conrad                    | not in stale top sample        | Feed appears healthy or low coverage in current sample. | Keep every-6-hours cadence and monitor parse failures.                              |
| lego-nl / bol / Intertoys | high stale/error legacy/manual | No reliable production feed refresh owner yet.          | Operator queue cleanup; do not change trust/ranking without a feed owner.           |

Feed job end logs include `remaining_stale_success_latest` and a compact
`remaining_stale_success_sample`. A high value means the feed run succeeded but
existing success rows for that merchant were not seen in the current feed and
were not retired because the importer is non-authoritative by default.
