# Commerce Consistency Audit

## Goal

Brickhunt commerce surfaces must agree on one canonical purchasable offer per set.
When a surface says "Laagst bij Proshop EUR 176,67", the hero, card, offer rail,
snapshot, and Product schema must point at the same merchant, price, availability,
and deeplink.

This is a reliability and revenue contract, not a UI feature.

## Canonical Best Offer Contract

The canonical selector is `selectBestPurchasableOffer(...)` in
`libs/shared/config/src/lib/commerce-best-purchasable-offer.ts`.

The portable contract is:

```ts
interface CanonicalBestOfferContract {
  availability: BestPurchasableOfferAvailability;
  checkedAt: string;
  currency: AppCurrencyCode;
  currentPriceMinor: number;
  deeplink: string;
  merchantName: string;
  merchantSlug: string;
  selectionReason: BestPurchasableOfferSelectionReason;
  setId: string;
}
```

Rules:

- stale offers cannot win
- out-of-stock offers cannot win
- offers without a purchasable deeplink cannot win
- equal prices must use the configured tie-break order
- matching on price alone is not enough; `merchantSlug` and `deeplink` are part
  of the contract

## Deel 1 - Commerce Consistency Audit

| Surface                | Source                                                                                                     | Selector / field                                                                          | Price                                 | Merchant                                               | URL                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Homepage cards         | `commerce_current_offer_snapshots` and deal/collection snapshots in `homepage-commerce-snapshot-server.ts` | `best_price_minor` from current-offer snapshot or propagated deal snapshot `priceContext` | `currentPriceMinor`                   | `best_merchant_name` / `merchantName`                  | `best_product_url` / `primaryActionHref` |
| Theme cards            | `commerce_current_offer_snapshots` in `theme-commerce-snapshot-server.ts`                                  | snapshot `best_*` fields                                                                  | `currentPriceMinor`                   | `best_merchant_name`, `best_merchant_slug`             | `best_product_url`                       |
| Collection cards       | `commerce_current_offer_snapshots` in `collection-page-snapshot-server.ts`                                 | snapshot `best_*` fields                                                                  | `currentPriceMinor`                   | `best_merchant_name`, `best_merchant_slug`             | `best_product_url`                       |
| Deals cards            | `commerce_current_offer_snapshots` in `deal-page-snapshot-server.ts`                                       | snapshot `best_*` fields after freshness/actionability checks                             | `best_price_minor`                    | resolved public merchant name and `best_merchant_slug` | `best_product_url`                       |
| Merchant cards         | `commerce_current_offer_snapshots` in `commerce-merchant-page-snapshot-server.ts`                          | canonical snapshot `best_*` fields matched back to the offer row                          | `best_price_minor`                    | `best_merchant_slug` / `best_merchant_name`            | `best_product_url`                       |
| Setdetail hero         | runtime live offers plus current summary fallback in `apps/web/src/app/sets/[slug]/page.tsx`               | `selectBestPurchasableOffer(...)`                                                         | `bestOffer.priceCents`                | public merchant name / slug                            | `bestOffer.url`                          |
| Offer rail             | runtime live offers in setdetail page                                                                      | `selectBestPurchasableOffer(...)`                                                         | `offerRailBestOffer.priceCents`       | public merchant name / slug                            | `offerRailBestOffer.url`                 |
| Current offer summary  | `listCatalogCurrentOfferSummariesBySetIds`                                                                 | snapshot-first summary or live reconstruction using canonical selector                    | `bestOffer.priceCents`                | public merchant name / slug                            | `bestOffer.url`                          |
| Current offer snapshot | `commerce-current-offer-snapshot-server.ts`                                                                | `selectBestPurchasableOffer(...)` through `selectBestSnapshotOffer(...)`                  | `bestPriceMinor`                      | `bestMerchantName`, `bestMerchantSlug`                 | `bestProductUrl`                         |
| Collection snapshot    | `collection-page-snapshot-server.ts`                                                                       | consumes current-offer snapshot `best_*` fields                                           | `best_price_minor`                    | `best_merchant_name`, `best_merchant_slug`             | `best_product_url`                       |
| Theme snapshot         | `theme-commerce-snapshot-server.ts`                                                                        | consumes current-offer snapshot `best_*` fields                                           | `best_price_minor`                    | `best_merchant_name`, `best_merchant_slug`             | `best_product_url`                       |
| Homepage snapshot      | `homepage-commerce-snapshot-server.ts`                                                                     | consumes current-offer, deal, and collection snapshot canonical fields                    | `best_price_minor` / `bestPriceMinor` | propagated merchant name and slug                      | propagated CTA URL                       |
| Merchant snapshot      | `commerce-merchant-page-snapshot-server.ts`                                                                | canonical current-offer `best_*` fields, not local lowest-price recompute                 | `best_price_minor`                    | canonical best merchant only                           | `best_product_url`                       |
| JSON-LD Product schema | `apps/web/src/app/sets/[slug]/page.tsx` -> `structured-data.ts`                                            | one canonical offer from setdetail selector/current summary                               | `price`                               | `seller.name`                                          | `url`                                    |

## Deel 2 - Afwijkingen Gevonden

- JSON-LD on setdetail previously received the ranked offer list. That could
  produce an `AggregateOffer` where `lowPrice` came from a stale or otherwise
  non-winning offer while the hero and rail showed the canonical purchasable
  winner.
- Merchant page snapshots recomputed the lowest merchant from the embedded
  offers payload. On equal prices this could assign the deal to multiple
  merchants instead of the canonical current-offer snapshot winner.
- Some card price contexts carried a display label but not the canonical
  `merchantSlug`, making future contract assertions weaker because price could
  match while merchant identity drifted.

## Deel 3 - Gefixte Afwijkingen

- Added `CanonicalBestOfferContract` plus
  `selectCanonicalBestOfferContract(...)` in shared config and re-exported it
  through affiliate util.
- Setdetail Product JSON-LD now receives a single canonical offer from the same
  best-offer selection as hero and offer rail.
- Merchant page snapshot deal assignment now matches the current-offer snapshot
  canonical `best_offer_seed_id`, merchant, price, and URL instead of assigning
  every equal-price merchant as a winner.
- Deal, homepage, theme, and collection card price contexts now propagate
  canonical merchant slug where available.
- Added optional runtime diagnostics behind
  `DEBUG_COMMERCE_CONSISTENCY=true` for setdetail canonical/hero/rail/card/schema
  comparison.

## Deel 4 - Nieuwe Contracttests

Golden selector set in `commerce-best-purchasable-offer.spec.ts`:

- Case A: normal best deal
- Case B: lower price is stale
- Case C: lower price is out of stock
- Case D: lower price has no purchasable deeplink
- Case E: exact equal price
- Case F: trusted tie-break
- Case G: strategic tie-break
- Case H: LEGO reference much higher
- Case I: single merchant
- Case J: no reliable offer

Surface and snapshot coverage:

- Hero equals rail for canonical stale-lower-price scenario.
- Hero equals schema: stale lower MediaMarkt price is visible in the rail but
  excluded from Product schema, which names Proshop at the canonical price.
- Hero equals card context through setdetail `currentDealPriceContext`.
- Current-offer snapshot uses the same selector as cards/detail.
- Homepage snapshot preserves canonical price, merchant slug, and CTA URL.
- Theme snapshot preserves canonical price, merchant slug, and CTA URL.
- Collection snapshot consumes current-offer snapshot canonical fields.
- Merchant snapshot uses exactly one canonical merchant on equal prices.
- JSON-LD uses the canonical offer and no stale `lowPrice`.

## Deel 5 - Sync Stability Audit

Current-offer snapshot writes are chunked in
`commerce-current-offer-snapshot-server.ts`.

- Batching/chunking: yes, upsert chunks use
  `CURRENT_OFFER_SNAPSHOT_UPSERT_CHUNK_SIZE = 100`.
- Chunk size safety: 100 rows is conservative for Supabase upserts and keeps
  timeout blast radius bounded.
- Partial failure logging: failed chunks log snapshot count, chunk index,
  chunk count, sample keys, sample row sizes, PostgREST code, message, details,
  and hint before throwing.
- Write durations: `upsert_progress` logs per-chunk `duration_ms`;
  `upsert_complete` logs total `duration_ms`, `snapshotCount`, `rowCount`,
  `chunkCount`, and configured `chunkSize`.
- Retries: not added in this change. Recommended only for transient network or
  timeout failures, with a bounded retry count and the same chunk diagnostics.

## Deel 6 - Aanbevolen Monitoring

Add production monitoring or log-based alerts for:

- `current_offer_snapshot_mismatches > 0`
- any setdetail `surfacesMatchCanonical=false` debug sample during targeted
  diagnosis
- current-offer snapshot upsert failures or repeated slow chunks
- `snapshotMissingBestOfferCount` spikes
- stale-filtered offer spikes by merchant
- homepage/theme/collection/merchant snapshot rows missing `merchantSlug` while
  showing a price
- Product schema seller or price mismatches against the rendered hero in
  smoke-test pages

Operational threshold suggestion:

- warn when current-offer snapshot total write duration doubles versus the last
  healthy baseline
- alert when any chunk times out or the same chunk fails twice in one run
- block snapshot-first rollout when parity mismatch count is non-zero
