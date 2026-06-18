import type { CatalogCurrentOfferSummaryRecord } from '@lego-platform/catalog/data-access-server';
import type { CommerceRefreshSeed } from '@lego-platform/commerce/data-access-server';
import { DEFAULT_COMMERCE_STALE_DAYS } from '@lego-platform/commerce/util';
import {
  canStrategicManualOfferBeatProductionFeed,
  classifyCommerceCommercialUnitType,
  compareCommerceCommercialUnitPreference,
  getCommerceCommercialUnitComparisonGroup,
  getCommerceMerchantReliabilityTier,
  isCommerceCommercialUnitComparableForDeals,
  selectBestPurchasableOffer,
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
const CURRENT_OFFER_SNAPSHOT_UPSERT_CHUNK_SIZE = 100;

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
  bestOfferMismatchSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  liveSummaryCount: number;
  missingLiveSummarySample: readonly CommerceCurrentOfferSnapshotParitySample[];
  missingLiveSummaryReasonCounts: Record<string, number>;
  missingSnapshotSample: readonly CommerceCurrentOfferSnapshotParitySample[];
  snapshotMissingLiveSummaryCount: number;
  liveSummaryMissingSnapshotCount: number;
  snapshotBestOfferMismatchCount: number;
  snapshotMissingBestOfferSample: readonly CommerceCurrentOfferSnapshotParitySample[];
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

export interface CommerceCurrentOfferSnapshotParitySample {
  liveAvailability?: string;
  liveMerchantSlug?: string;
  livePriceMinor?: number;
  liveProductUrl?: string;
  reason: string;
  setId: string;
  snapshotAvailability?: string;
  snapshotMerchantSlug?: string;
  snapshotOfferCount?: number;
  snapshotPriceMinor?: number;
  snapshotProductUrl?: string;
}

interface CommerceCurrentOfferSnapshotParityResult {
  bestOfferMismatchCount: number;
  bestOfferMismatchSample: CommerceCurrentOfferSnapshotParitySample[];
  liveSummaryMissingSnapshotCount: number;
  missingLiveSummarySample: CommerceCurrentOfferSnapshotParitySample[];
  missingLiveSummaryReasonCounts: Record<string, number>;
  missingSnapshotSample: CommerceCurrentOfferSnapshotParitySample[];
  snapshotMissingBestOfferSample: CommerceCurrentOfferSnapshotParitySample[];
  snapshotMissingLiveSummaryCount: number;
}

const SNAPSHOT_PARITY_SAMPLE_LIMIT = 5;

type CommerceCurrentOfferSnapshotMissingLiveReason =
  | 'missing_live_due_to_set_scope'
  | 'missing_live_due_to_stale'
  | 'missing_live_due_to_unit'
  | 'missing_live_due_to_untrusted_merchant'
  | 'missing_live_due_to_url'
  | 'missing_live_due_to_unknown';

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
  {
    now,
  }: {
    now: Date;
  },
): CommerceCurrentOfferSnapshotOffer | undefined {
  const sortedOffers = sortSnapshotOffers(offers);
  const selectableOffers = sortedOffers.map((offer) => ({
    availability: offer.availability,
    checkedAt: offer.checkedAt,
    commercialUnitType: offer.commercialUnitType,
    condition: offer.condition,
    currency: offer.currency,
    market: offer.market,
    merchant: 'other' as const,
    merchantName: offer.merchantName,
    merchantSlug: offer.merchantSlug,
    priceCents: offer.priceMinor,
    setId: offer.setId,
    snapshotOffer: offer,
    url: offer.url,
  }));

  return selectBestPurchasableOffer(selectableOffers, {
    now,
    strategicTieBreakerOffer: selectableOffers[0] ?? null,
  }).offer?.snapshotOffer;
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
  const bestOffer = selectBestSnapshotOffer(sortedOffers, {
    now: new Date(computedAt),
  });
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

function addParitySample(
  samples: CommerceCurrentOfferSnapshotParitySample[],
  sample: CommerceCurrentOfferSnapshotParitySample,
): void {
  if (samples.length < SNAPSHOT_PARITY_SAMPLE_LIMIT) {
    samples.push(sample);
  }
}

function incrementReasonCount(
  counts: Record<string, number>,
  reason: CommerceCurrentOfferSnapshotMissingLiveReason,
): void {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

function isSnapshotBestOfferStale({
  now,
  snapshot,
}: {
  now: Date;
  snapshot: CommerceCurrentOfferSnapshot;
}): boolean {
  if (!snapshot.bestCheckedAt) {
    return false;
  }

  const checkedAt = new Date(snapshot.bestCheckedAt);

  if (Number.isNaN(checkedAt.getTime())) {
    return false;
  }

  const staleAfterMs = DEFAULT_COMMERCE_STALE_DAYS * 24 * 60 * 60 * 1000;

  return now.getTime() - checkedAt.getTime() > staleAfterMs;
}

function classifyMissingLiveSummaryReason({
  now,
  publicSetIds,
  snapshot,
}: {
  now: Date;
  publicSetIds?: ReadonlySet<string>;
  snapshot: CommerceCurrentOfferSnapshot;
}): CommerceCurrentOfferSnapshotMissingLiveReason {
  if (publicSetIds && !publicSetIds.has(snapshot.setId)) {
    return 'missing_live_due_to_set_scope';
  }

  if (!snapshot.bestProductUrl?.trim()) {
    return 'missing_live_due_to_url';
  }

  if (isSnapshotBestOfferStale({ now, snapshot })) {
    return 'missing_live_due_to_stale';
  }

  if (
    !snapshot.bestCommercialUnitType ||
    !isCommerceCommercialUnitComparableForDeals(
      snapshot.bestCommercialUnitType,
    ) ||
    getCommerceCommercialUnitComparisonGroup(
      snapshot.bestCommercialUnitType,
    ) !== 'set_package'
  ) {
    return 'missing_live_due_to_unit';
  }

  if (
    snapshot.bestMerchantSlug &&
    getCommerceMerchantReliabilityTier(snapshot.bestMerchantSlug) !==
      'production_feed'
  ) {
    return 'missing_live_due_to_untrusted_merchant';
  }

  return 'missing_live_due_to_unknown';
}

function analyzeSnapshotParity({
  liveSummaries,
  now,
  publicSetIds,
  snapshots,
}: {
  liveSummaries?: readonly CatalogCurrentOfferSummaryRecord[];
  now: Date;
  publicSetIds?: ReadonlySet<string>;
  snapshots: readonly CommerceCurrentOfferSnapshot[];
}): CommerceCurrentOfferSnapshotParityResult {
  const emptyResult: CommerceCurrentOfferSnapshotParityResult = {
    bestOfferMismatchCount: 0,
    bestOfferMismatchSample: [],
    liveSummaryMissingSnapshotCount: 0,
    missingLiveSummarySample: [],
    missingLiveSummaryReasonCounts: {},
    missingSnapshotSample: [],
    snapshotMissingBestOfferSample: [],
    snapshotMissingLiveSummaryCount: 0,
  };

  if (!liveSummaries) {
    return emptyResult;
  }

  const liveSummaryBySetId = new Map(
    liveSummaries.map((liveSummary) => [liveSummary.setId, liveSummary]),
  );
  const snapshotBySetId = new Map(
    snapshots.map((snapshot) => [snapshot.setId, snapshot]),
  );
  const bestOfferMismatchSample: CommerceCurrentOfferSnapshotParitySample[] =
    [];
  const missingLiveSummarySample: CommerceCurrentOfferSnapshotParitySample[] =
    [];
  const missingLiveSummaryReasonCounts: Record<string, number> = {};
  const missingSnapshotSample: CommerceCurrentOfferSnapshotParitySample[] = [];
  const snapshotMissingBestOfferSample: CommerceCurrentOfferSnapshotParitySample[] =
    [];
  let bestOfferMismatchCount = 0;
  let snapshotMissingLiveSummaryCount = 0;
  let liveSummaryMissingSnapshotCount = 0;

  for (const snapshot of snapshots) {
    const liveBestOffer = liveSummaryBySetId.get(snapshot.setId)?.bestOffer;

    if (!snapshot.bestPriceMinor) {
      addParitySample(snapshotMissingBestOfferSample, {
        liveAvailability: liveBestOffer?.availability,
        liveMerchantSlug: liveBestOffer?.merchantSlug,
        livePriceMinor: liveBestOffer?.priceCents,
        reason: liveBestOffer
          ? 'snapshot_missing_best_offer_but_live_has_best'
          : 'snapshot_missing_best_offer',
        setId: snapshot.setId,
        snapshotOfferCount: snapshot.offerCount,
      });
      continue;
    }

    if (!liveBestOffer) {
      const reason = classifyMissingLiveSummaryReason({
        now,
        publicSetIds,
        snapshot,
      });

      snapshotMissingLiveSummaryCount += 1;
      incrementReasonCount(missingLiveSummaryReasonCounts, reason);
      addParitySample(missingLiveSummarySample, {
        reason,
        setId: snapshot.setId,
        snapshotAvailability: snapshot.bestAvailability,
        snapshotMerchantSlug: snapshot.bestMerchantSlug,
        snapshotOfferCount: snapshot.offerCount,
        snapshotPriceMinor: snapshot.bestPriceMinor,
        snapshotProductUrl: snapshot.bestProductUrl,
      });
      continue;
    }

    const mismatched =
      snapshot.bestPriceMinor !== liveBestOffer?.priceCents ||
      snapshot.bestMerchantSlug !== liveBestOffer?.merchantSlug ||
      snapshot.bestAvailability !== liveBestOffer?.availability ||
      snapshot.bestProductUrl !== liveBestOffer?.url;

    if (mismatched) {
      bestOfferMismatchCount += 1;
      addParitySample(bestOfferMismatchSample, {
        liveAvailability: liveBestOffer.availability,
        liveMerchantSlug: liveBestOffer.merchantSlug,
        livePriceMinor: liveBestOffer.priceCents,
        liveProductUrl: liveBestOffer.url,
        reason: 'best_offer_mismatch',
        setId: snapshot.setId,
        snapshotAvailability: snapshot.bestAvailability,
        snapshotMerchantSlug: snapshot.bestMerchantSlug,
        snapshotOfferCount: snapshot.offerCount,
        snapshotPriceMinor: snapshot.bestPriceMinor,
        snapshotProductUrl: snapshot.bestProductUrl,
      });
    }
  }

  for (const liveSummary of liveSummaries) {
    if (!snapshotBySetId.has(liveSummary.setId)) {
      liveSummaryMissingSnapshotCount += 1;
      addParitySample(missingSnapshotSample, {
        liveAvailability: liveSummary.bestOffer?.availability,
        liveMerchantSlug: liveSummary.bestOffer?.merchantSlug,
        livePriceMinor: liveSummary.bestOffer?.priceCents,
        reason: 'missing_snapshot',
        setId: liveSummary.setId,
      });
    }
  }

  return {
    bestOfferMismatchCount,
    bestOfferMismatchSample,
    liveSummaryMissingSnapshotCount,
    missingLiveSummarySample,
    missingLiveSummaryReasonCounts,
    missingSnapshotSample,
    snapshotMissingBestOfferSample,
    snapshotMissingLiveSummaryCount,
  };
}

export function buildCommerceCurrentOfferSnapshots({
  liveSummaries,
  now = new Date(),
  publicSetIds,
  syncSeeds,
}: {
  liveSummaries?: readonly CatalogCurrentOfferSummaryRecord[];
  now?: Date;
  publicSetIds?: readonly string[];
  syncSeeds: readonly CommerceRefreshSeed[];
}): CommerceCurrentOfferSnapshotBuildResult {
  const computedAt = now.toISOString();
  const publicSetIdSet = publicSetIds
    ? new Set(publicSetIds.map(normalizeCatalogSetId).filter(Boolean))
    : undefined;
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
  const parityResult = analyzeSnapshotParity({
    liveSummaries,
    now,
    publicSetIds: publicSetIdSet,
    snapshots,
  });

  return {
    snapshots,
    summary: {
      bestOfferMismatchSample: parityResult.bestOfferMismatchSample,
      currentOfferSnapshotsBuilt: snapshots.length,
      liveSummaryMissingSnapshotCount:
        parityResult.liveSummaryMissingSnapshotCount,
      liveSummaryCount: liveSummaries?.length ?? 0,
      missingLiveSummarySample: parityResult.missingLiveSummarySample,
      missingLiveSummaryReasonCounts:
        parityResult.missingLiveSummaryReasonCounts,
      missingSnapshotSample: parityResult.missingSnapshotSample,
      snapshotBestOfferMismatchCount: parityResult.bestOfferMismatchCount,
      snapshotMissingBestOfferCount: snapshots.filter(
        (snapshot) => !snapshot.bestPriceMinor,
      ).length,
      snapshotMissingBestOfferSample:
        parityResult.snapshotMissingBestOfferSample,
      snapshotMissingLiveSummaryCount:
        parityResult.snapshotMissingLiveSummaryCount,
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

function getSnapshotRowInvalidReason(
  row: CommerceCurrentOfferSnapshotRow,
): string | undefined {
  if (!row.set_id.trim()) {
    return 'missing_set_id';
  }

  if (row.region_code !== DUTCH_REGION_CODE) {
    return 'invalid_region_code';
  }

  if (row.currency_code !== EURO_CURRENCY_CODE) {
    return 'invalid_currency_code';
  }

  if (row.condition !== NEW_OFFER_CONDITION) {
    return 'invalid_condition';
  }

  if (!row.computed_at || Number.isNaN(Date.parse(row.computed_at))) {
    return 'invalid_computed_at';
  }

  if (row.offer_count !== row.offers.length) {
    return 'offer_count_mismatch';
  }

  return undefined;
}

function createCurrentOfferSnapshotUpsertDiagnostics({
  chunkCount,
  chunkIndex,
  error,
  rows,
  snapshotCount = rows.length,
}: {
  chunkCount?: number;
  chunkIndex?: number;
  error: unknown;
  rows: readonly CommerceCurrentOfferSnapshotRow[];
  snapshotCount?: number;
}) {
  const errorRecord =
    error && typeof error === 'object'
      ? (error as {
          code?: unknown;
          details?: unknown;
          hint?: unknown;
          message?: unknown;
        })
      : {};
  const firstInvalidRow = rows.find((row) => getSnapshotRowInvalidReason(row));
  const sampleRows = rows.slice(0, 3);

  return {
    code: errorRecord.code,
    chunkCount,
    chunkIndex,
    chunkSize: rows.length,
    details: errorRecord.details,
    firstInvalidRow: firstInvalidRow
      ? {
          reason: getSnapshotRowInvalidReason(firstInvalidRow),
          row: {
            best_availability: firstInvalidRow.best_availability,
            best_commercial_unit_type:
              firstInvalidRow.best_commercial_unit_type,
            best_merchant_slug: firstInvalidRow.best_merchant_slug,
            best_price_minor: firstInvalidRow.best_price_minor,
            condition: firstInvalidRow.condition,
            currency_code: firstInvalidRow.currency_code,
            offer_count: firstInvalidRow.offer_count,
            offers_length: firstInvalidRow.offers.length,
            region_code: firstInvalidRow.region_code,
            set_id: firstInvalidRow.set_id,
          },
        }
      : undefined,
    hint: errorRecord.hint,
    message:
      typeof errorRecord.message === 'string'
        ? errorRecord.message
        : error instanceof Error
          ? error.message
          : String(error),
    samplePayloadShape: sampleRows.map((row) => ({
      keys: Object.keys(row).sort(),
      offersLength: row.offers.length,
      setId: row.set_id,
    })),
    sampleSnapshotKeys: sampleRows.map((row) => ({
      condition: row.condition,
      currencyCode: row.currency_code,
      regionCode: row.region_code,
      setId: row.set_id,
    })),
    snapshotCount,
  };
}

function chunkCurrentOfferSnapshotRows(
  rows: readonly CommerceCurrentOfferSnapshotRow[],
): readonly (readonly CommerceCurrentOfferSnapshotRow[])[] {
  const chunks: CommerceCurrentOfferSnapshotRow[][] = [];

  for (
    let index = 0;
    index < rows.length;
    index += CURRENT_OFFER_SNAPSHOT_UPSERT_CHUNK_SIZE
  ) {
    chunks.push(
      rows.slice(index, index + CURRENT_OFFER_SNAPSHOT_UPSERT_CHUNK_SIZE),
    );
  }

  return chunks;
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

  const startedAt = Date.now();
  const rows = snapshots.map(toCommerceCurrentOfferSnapshotRow);
  const chunks = chunkCurrentOfferSnapshotRows(rows);
  let upsertedCount = 0;

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const chunkStartedAt = Date.now();
    const { error } = await supabaseClient
      .from(COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE)
      .upsert(chunk, {
        onConflict: 'set_id,region_code,currency_code,condition',
      });

    if (error) {
      const diagnostics = createCurrentOfferSnapshotUpsertDiagnostics({
        chunkCount: chunks.length,
        chunkIndex,
        error,
        rows: chunk,
        snapshotCount: rows.length,
      });

      console.error('[commerce-current-offer-snapshots] upsert_failed', {
        ...diagnostics,
        event: 'commerce_current_offer_snapshot_upsert_failed',
      });

      throw new Error(
        `Unable to upsert commerce current-offer snapshots. ${JSON.stringify(
          diagnostics,
        )}`,
      );
    }

    upsertedCount += chunk.length;

    console.info('[commerce-current-offer-snapshots] upsert_progress', {
      chunkCount: chunks.length,
      chunkIndex,
      chunkSize: chunk.length,
      duration_ms: Date.now() - chunkStartedAt,
      upsertedSoFar: upsertedCount,
    });
  }

  console.info('[commerce-current-offer-snapshots] upsert_complete', {
    chunkCount: chunks.length,
    chunkSize: CURRENT_OFFER_SNAPSHOT_UPSERT_CHUNK_SIZE,
    duration_ms: Date.now() - startedAt,
    rowCount: rows.length,
    snapshotCount: snapshots.length,
  });

  return {
    upsertedCount,
  };
}
