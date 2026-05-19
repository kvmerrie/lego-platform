import type { CatalogCurrentOfferSummaryRecord } from '@lego-platform/catalog/data-access-server';
import type { CommerceRefreshSeed } from '@lego-platform/commerce/data-access-server';
import {
  canStrategicManualOfferBeatProductionFeed,
  classifyCommerceCommercialUnitType,
  compareCommerceCommercialUnitPreference,
  getCommerceCommercialUnitComparisonGroup,
  getCommerceMerchantReliabilityTier,
  isCommerceCommercialUnitComparableForDeals,
  type CommerceCommercialUnitType,
  type CommerceMerchantReliabilityTier,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import type { SupabaseClient } from '@supabase/supabase-js';

export const COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE =
  'commerce_current_offer_snapshots';

const DUTCH_REGION_CODE = 'NL';
const EURO_CURRENCY_CODE = 'EUR';
const NEW_OFFER_CONDITION = 'new';
const SNAPSHOT_SOURCE = 'commerce_sync';

type CommerceCurrentOfferSnapshotSupabaseClient = Pick<SupabaseClient, 'from'>;

export interface CommerceCurrentOfferSnapshotOffer {
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  checkedAt: string;
  commercialUnitType: CommerceCommercialUnitType;
  condition: typeof NEW_OFFER_CONDITION;
  currency: typeof EURO_CURRENCY_CODE;
  market: typeof DUTCH_REGION_CODE;
  merchantId: string;
  merchantName: string;
  merchantReliabilityTier: CommerceMerchantReliabilityTier;
  merchantSlug: string;
  offerSeedId: string;
  priceMinor: number;
  setId: string;
  url: string;
}

export interface CommerceCurrentOfferSnapshot {
  bestAvailability?: string;
  bestCheckedAt?: string;
  bestCommercialUnitType?: CommerceCommercialUnitType;
  bestMerchantId?: string;
  bestMerchantName?: string;
  bestMerchantSlug?: string;
  bestOfferSeedId?: string;
  bestPriceMinor?: number;
  bestProductUrl?: string;
  comparableOfferCount: number;
  computedAt: string;
  condition: typeof NEW_OFFER_CONDITION;
  currencyCode: typeof EURO_CURRENCY_CODE;
  hasAnomalousSpread: boolean;
  nextBestPriceMinor?: number;
  offerCount: number;
  offers: readonly CommerceCurrentOfferSnapshotOffer[];
  priceSpreadMinor?: number;
  regionCode: typeof DUTCH_REGION_CODE;
  setId: string;
  snapshotSource: typeof SNAPSHOT_SOURCE;
  strategicManualOfferCount: number;
  trustedOfferCount: number;
}

export interface CommerceCurrentOfferSnapshotSummary {
  currentOfferSnapshotsBuilt: number;
  liveSummaryCount: number;
  snapshotBestOfferMismatchCount: number;
  snapshotMissingBestOfferCount: number;
  snapshotOfferCount: number;
}

export interface CommerceCurrentOfferSnapshotBuildResult {
  snapshots: readonly CommerceCurrentOfferSnapshot[];
  summary: CommerceCurrentOfferSnapshotSummary;
}

export interface CommerceCurrentOfferSnapshotUpsertResult {
  upsertedCount: number;
}

interface CommerceCurrentOfferSnapshotRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_commercial_unit_type: string | null;
  best_merchant_id: string | null;
  best_merchant_name: string | null;
  best_merchant_slug: string | null;
  best_offer_seed_id: string | null;
  best_price_minor: number | null;
  best_product_url: string | null;
  comparable_offer_count: number;
  computed_at: string;
  condition: typeof NEW_OFFER_CONDITION;
  currency_code: typeof EURO_CURRENCY_CODE;
  has_anomalous_spread: boolean;
  next_best_price_minor: number | null;
  offer_count: number;
  offers: readonly CommerceCurrentOfferSnapshotOffer[];
  price_spread_minor: number | null;
  region_code: typeof DUTCH_REGION_CODE;
  set_id: string;
  snapshot_source: typeof SNAPSHOT_SOURCE;
  strategic_manual_offer_count: number;
  trusted_offer_count: number;
}

function normalizeSnapshotAvailability(
  availability?: string,
): CommerceCurrentOfferSnapshotOffer['availability'] {
  if (availability === 'in_stock' || availability === 'out_of_stock') {
    return availability;
  }

  return 'unknown';
}

function getOfferAvailabilityRank(
  availability: CommerceCurrentOfferSnapshotOffer['availability'],
): number {
  if (availability === 'in_stock') {
    return 0;
  }

  if (availability === 'unknown') {
    return 1;
  }

  return 2;
}

function compareOfferReliability(
  left: CommerceCurrentOfferSnapshotOffer,
  right: CommerceCurrentOfferSnapshotOffer,
): number {
  if (left.merchantReliabilityTier === right.merchantReliabilityTier) {
    return 0;
  }

  const leftIsProductionFeed =
    left.merchantReliabilityTier === 'production_feed';
  const productionFeedOffer = leftIsProductionFeed ? left : right;
  const strategicManualOffer = leftIsProductionFeed ? right : left;

  if (
    canStrategicManualOfferBeatProductionFeed({
      productionFeedPriceMinor: productionFeedOffer.priceMinor,
      strategicManualPriceMinor: strategicManualOffer.priceMinor,
    })
  ) {
    return 0;
  }

  return leftIsProductionFeed ? -1 : 1;
}

function sortSnapshotOffers(
  offers: readonly CommerceCurrentOfferSnapshotOffer[],
): CommerceCurrentOfferSnapshotOffer[] {
  return [...offers].sort(
    (left, right) =>
      getOfferAvailabilityRank(left.availability) -
        getOfferAvailabilityRank(right.availability) ||
      compareCommerceCommercialUnitPreference(
        left.commercialUnitType,
        right.commercialUnitType,
      ) ||
      compareOfferReliability(left, right) ||
      left.priceMinor - right.priceMinor ||
      left.merchantName.localeCompare(right.merchantName, 'nl') ||
      left.offerSeedId.localeCompare(right.offerSeedId),
  );
}

function selectBestSnapshotOffer(
  offers: readonly CommerceCurrentOfferSnapshotOffer[],
): CommerceCurrentOfferSnapshotOffer | undefined {
  return sortSnapshotOffers(offers).find(
    (offer) =>
      offer.availability === 'in_stock' &&
      offer.priceMinor > 0 &&
      offer.url.length > 0,
  );
}

function getComparableOffersForBestOffer({
  bestOffer,
  offers,
}: {
  bestOffer?: CommerceCurrentOfferSnapshotOffer;
  offers: readonly CommerceCurrentOfferSnapshotOffer[];
}): CommerceCurrentOfferSnapshotOffer[] {
  if (!bestOffer) {
    return [];
  }

  const bestComparisonGroup = getCommerceCommercialUnitComparisonGroup(
    bestOffer.commercialUnitType,
  );

  if (!bestComparisonGroup) {
    return [bestOffer];
  }

  return offers.filter(
    (offer) =>
      getCommerceCommercialUnitComparisonGroup(offer.commercialUnitType) ===
      bestComparisonGroup,
  );
}

function toSnapshotOffer(
  refreshSeed: CommerceRefreshSeed,
): CommerceCurrentOfferSnapshotOffer | undefined {
  const latestOffer = refreshSeed.offerSeed.latestOffer;
  const setId = normalizeCatalogSetId(refreshSeed.offerSeed.setId);
  const checkedAt =
    latestOffer?.observedAt ?? latestOffer?.fetchedAt ?? latestOffer?.updatedAt;

  if (
    !setId ||
    !refreshSeed.offerSeed.isActive ||
    refreshSeed.offerSeed.validationStatus !== 'valid' ||
    !refreshSeed.merchant.isActive ||
    !latestOffer ||
    latestOffer.fetchStatus !== 'success' ||
    (latestOffer.currencyCode ?? EURO_CURRENCY_CODE).trim().toUpperCase() !==
      EURO_CURRENCY_CODE ||
    typeof latestOffer.priceMinor !== 'number' ||
    latestOffer.priceMinor <= 0 ||
    !checkedAt ||
    !refreshSeed.offerSeed.productUrl.trim()
  ) {
    return undefined;
  }

  const merchantReliabilityTier = getCommerceMerchantReliabilityTier(
    refreshSeed.merchant.slug,
  );

  return {
    availability: normalizeSnapshotAvailability(latestOffer.availability),
    checkedAt,
    commercialUnitType: classifyCommerceCommercialUnitType({
      notes: refreshSeed.offerSeed.notes,
      productUrl: refreshSeed.offerSeed.productUrl,
      setId,
    }),
    condition: NEW_OFFER_CONDITION,
    currency: EURO_CURRENCY_CODE,
    market: DUTCH_REGION_CODE,
    merchantId: refreshSeed.merchant.id,
    merchantName: refreshSeed.merchant.name,
    merchantReliabilityTier,
    merchantSlug: refreshSeed.merchant.slug,
    offerSeedId: refreshSeed.offerSeed.id,
    priceMinor: latestOffer.priceMinor,
    setId,
    url: refreshSeed.offerSeed.productUrl,
  };
}

function buildSnapshotForSet({
  computedAt,
  offers,
  setId,
}: {
  computedAt: string;
  offers: readonly CommerceCurrentOfferSnapshotOffer[];
  setId: string;
}): CommerceCurrentOfferSnapshot {
  const sortedOffers = sortSnapshotOffers(offers);
  const bestOffer = selectBestSnapshotOffer(sortedOffers);
  const comparableOffers = getComparableOffersForBestOffer({
    bestOffer,
    offers: sortedOffers,
  });
  const comparablePrices = comparableOffers
    .filter((offer) => offer.availability === 'in_stock')
    .map((offer) => offer.priceMinor)
    .sort((left, right) => left - right);
  const nextBestPriceMinor = comparablePrices.find(
    (priceMinor) => priceMinor > (bestOffer?.priceMinor ?? 0),
  );
  const highestComparablePriceMinor = comparablePrices.at(-1);
  const priceSpreadMinor =
    bestOffer && typeof highestComparablePriceMinor === 'number'
      ? Math.max(0, highestComparablePriceMinor - bestOffer.priceMinor)
      : undefined;

  return {
    ...(bestOffer
      ? {
          bestAvailability: bestOffer.availability,
          bestCheckedAt: bestOffer.checkedAt,
          bestCommercialUnitType: bestOffer.commercialUnitType,
          bestMerchantId: bestOffer.merchantId,
          bestMerchantName: bestOffer.merchantName,
          bestMerchantSlug: bestOffer.merchantSlug,
          bestOfferSeedId: bestOffer.offerSeedId,
          bestPriceMinor: bestOffer.priceMinor,
          bestProductUrl: bestOffer.url,
        }
      : {}),
    comparableOfferCount: comparableOffers.length,
    computedAt,
    condition: NEW_OFFER_CONDITION,
    currencyCode: EURO_CURRENCY_CODE,
    hasAnomalousSpread:
      Boolean(bestOffer) &&
      sortedOffers.some(
        (offer) =>
          isCommerceCommercialUnitComparableForDeals(
            offer.commercialUnitType,
          ) &&
          getCommerceCommercialUnitComparisonGroup(offer.commercialUnitType) !==
            getCommerceCommercialUnitComparisonGroup(
              bestOffer?.commercialUnitType,
            ),
      ),
    nextBestPriceMinor,
    offerCount: sortedOffers.length,
    offers: sortedOffers,
    priceSpreadMinor,
    regionCode: DUTCH_REGION_CODE,
    setId,
    snapshotSource: SNAPSHOT_SOURCE,
    strategicManualOfferCount: sortedOffers.filter(
      (offer) => offer.merchantReliabilityTier === 'strategic_manual',
    ).length,
    trustedOfferCount: sortedOffers.filter(
      (offer) => offer.merchantReliabilityTier === 'production_feed',
    ).length,
  };
}

function countSnapshotBestOfferMismatches({
  liveSummaries,
  snapshots,
}: {
  liveSummaries?: readonly CatalogCurrentOfferSummaryRecord[];
  snapshots: readonly CommerceCurrentOfferSnapshot[];
}): number {
  if (!liveSummaries) {
    return 0;
  }

  const liveSummaryBySetId = new Map(
    liveSummaries.map((liveSummary) => [liveSummary.setId, liveSummary]),
  );

  return snapshots.filter((snapshot) => {
    const liveBestOffer = liveSummaryBySetId.get(snapshot.setId)?.bestOffer;

    if (!snapshot.bestPriceMinor && !liveBestOffer) {
      return false;
    }

    return (
      snapshot.bestPriceMinor !== liveBestOffer?.priceCents ||
      snapshot.bestMerchantSlug !== liveBestOffer?.merchantSlug ||
      snapshot.bestProductUrl !== liveBestOffer?.url
    );
  }).length;
}

export function buildCommerceCurrentOfferSnapshots({
  liveSummaries,
  now = new Date(),
  syncSeeds,
}: {
  liveSummaries?: readonly CatalogCurrentOfferSummaryRecord[];
  now?: Date;
  syncSeeds: readonly CommerceRefreshSeed[];
}): CommerceCurrentOfferSnapshotBuildResult {
  const computedAt = now.toISOString();
  const offersBySetId = new Map<string, CommerceCurrentOfferSnapshotOffer[]>();
  const seenSetIds = new Set<string>();

  for (const refreshSeed of syncSeeds) {
    const setId = normalizeCatalogSetId(refreshSeed.offerSeed.setId);

    if (setId) {
      seenSetIds.add(setId);
    }

    const snapshotOffer = toSnapshotOffer(refreshSeed);

    if (!snapshotOffer) {
      continue;
    }

    const offers = offersBySetId.get(snapshotOffer.setId) ?? [];
    offers.push(snapshotOffer);
    offersBySetId.set(snapshotOffer.setId, offers);
  }

  const snapshots = [...seenSetIds]
    .sort((left, right) => left.localeCompare(right))
    .map((setId) =>
      buildSnapshotForSet({
        computedAt,
        offers: offersBySetId.get(setId) ?? [],
        setId,
      }),
    );

  return {
    snapshots,
    summary: {
      currentOfferSnapshotsBuilt: snapshots.length,
      liveSummaryCount: liveSummaries?.length ?? 0,
      snapshotBestOfferMismatchCount: countSnapshotBestOfferMismatches({
        liveSummaries,
        snapshots,
      }),
      snapshotMissingBestOfferCount: snapshots.filter(
        (snapshot) => !snapshot.bestPriceMinor,
      ).length,
      snapshotOfferCount: snapshots.reduce(
        (total, snapshot) => total + snapshot.offerCount,
        0,
      ),
    },
  };
}

function toCommerceCurrentOfferSnapshotRow(
  snapshot: CommerceCurrentOfferSnapshot,
): CommerceCurrentOfferSnapshotRow {
  return {
    best_availability: snapshot.bestAvailability ?? null,
    best_checked_at: snapshot.bestCheckedAt ?? null,
    best_commercial_unit_type: snapshot.bestCommercialUnitType ?? null,
    best_merchant_id: snapshot.bestMerchantId ?? null,
    best_merchant_name: snapshot.bestMerchantName ?? null,
    best_merchant_slug: snapshot.bestMerchantSlug ?? null,
    best_offer_seed_id: snapshot.bestOfferSeedId ?? null,
    best_price_minor: snapshot.bestPriceMinor ?? null,
    best_product_url: snapshot.bestProductUrl ?? null,
    comparable_offer_count: snapshot.comparableOfferCount,
    computed_at: snapshot.computedAt,
    condition: snapshot.condition,
    currency_code: snapshot.currencyCode,
    has_anomalous_spread: snapshot.hasAnomalousSpread,
    next_best_price_minor: snapshot.nextBestPriceMinor ?? null,
    offer_count: snapshot.offerCount,
    offers: snapshot.offers,
    price_spread_minor: snapshot.priceSpreadMinor ?? null,
    region_code: snapshot.regionCode,
    set_id: snapshot.setId,
    snapshot_source: snapshot.snapshotSource,
    strategic_manual_offer_count: snapshot.strategicManualOfferCount,
    trusted_offer_count: snapshot.trustedOfferCount,
  };
}

export async function upsertCommerceCurrentOfferSnapshots({
  snapshots,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  snapshots: readonly CommerceCurrentOfferSnapshot[];
  supabaseClient?: CommerceCurrentOfferSnapshotSupabaseClient;
}): Promise<CommerceCurrentOfferSnapshotUpsertResult> {
  if (!snapshots.length) {
    return {
      upsertedCount: 0,
    };
  }

  const { error } = await supabaseClient
    .from(COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE)
    .upsert(snapshots.map(toCommerceCurrentOfferSnapshotRow), {
      onConflict: 'set_id,region_code,currency_code,condition',
    });

  if (error) {
    throw new Error('Unable to upsert commerce current-offer snapshots.');
  }

  return {
    upsertedCount: snapshots.length,
  };
}
