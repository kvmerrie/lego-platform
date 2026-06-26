import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  bulkRefreshCommerceOfferLatestObservations,
  bulkUpsertCommerceOfferLatestRecords,
  bulkUpsertCommerceOfferSeedsByCompositeKey,
  createCommerceMerchant,
  loadCommerceMerchantImportReadModel,
  listCommerceMerchants,
  listCommerceOfferSeeds,
  markCommerceOfferLatestUnavailable,
  refreshCommerceOfferLatestObservation,
  upsertCommerceAffiliateDiscoveredSet,
  upsertCommerceOfferLatestRecord,
  upsertCommerceOfferSeedByCompositeKey,
  updateCommerceMerchant,
} from '@lego-platform/commerce/data-access-server';
import {
  scoreCommerceAffiliateDiscoveredSet,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceMerchantSourceType,
  type CommerceOfferLatestRecordInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
} from '@lego-platform/commerce/util';

export interface AffiliateFeedMerchantConfig {
  affiliateNetwork?: string;
  name: string;
  notes: string;
  sourceType?: CommerceMerchantSourceType;
  slug: string;
}

const ALTERNATE_MERCHANT_CONFIG = {
  slug: 'alternate',
  name: 'Alternate',
  affiliateNetwork: 'TradeTracker',
  notes:
    'Feed-driven merchant. Current offer state is imported from the Alternate TradeTracker product feed.',
} as const satisfies AffiliateFeedMerchantConfig;

export interface AlternateAffiliateFeedRow {
  affiliateDeeplink: string;
  availabilityText?: string;
  brand?: string;
  category?: string;
  condition?: string;
  currency?: string;
  description?: string;
  ean?: string;
  imageUrl?: string;
  legoSetNumber?: string;
  price?: number | string;
  productId?: string;
  productTitle?: string;
  shippingCost?: number | string;
  sourceMetadata?: Readonly<
    Record<string, boolean | number | string | null | undefined>
  >;
}

export interface AlternateAffiliateFeedImportResult {
  changedSetIds: readonly string[];
  changedSetSlugs: readonly string[];
  changedLatestOfferCount: number;
  existingStaleSuccessLatestByAgeBucket?: Readonly<
    Record<'2_7_days' | '8_30_days' | 'over_30_days' | 'unknown', number>
  >;
  existingStaleSuccessLatestCount: number;
  existingStaleSuccessLatestDuplicateSeedCount?: number;
  existingStaleSuccessLatestMissingFromFeedCount?: number;
  existingStaleSuccessLatestReportRows?: readonly ExistingStaleSuccessLatestDiagnosticRow[];
  existingStaleSuccessLatestSample: readonly {
    ageBucket?:
      | ExistingStaleSuccessLatestDiagnosticRow['ageBucket']
      | undefined;
    fetchedAt?: string;
    likelyReason?: ExistingStaleSuccessLatestDiagnosticRow['likelyReason'];
    likelyReasons?: readonly ExistingStaleSuccessLatestReason[];
    offerSeedId: string;
    observedAt?: string;
    productUrl?: string;
    seedUrlHost?: string;
    setId: string;
  }[];
  importedOfferCount: number;
  matchedOfferCount: number;
  matchedCatalogSetCount: number;
  merchantCreated: boolean;
  merchantSlug: string;
  skippedInvalidCurrencyCount: number;
  skippedInvalidDeeplinkCount: number;
  skippedInvalidPriceCount: number;
  skippedMissingSetNumberCount: number;
  skippedNonLegoCount: number;
  skippedNonNewCount: number;
  skippedUnmatchedSetCount: number;
  totalRowCount: number;
  unmatchedDebug?: AlternateAffiliateFeedUnmatchedDebugInfo;
  latestRowsMarkedStaleCount: number;
  latestRowsSeenCount: number;
  staleMarkSkippedReason?:
    | 'disabled'
    | 'dry_run'
    | 'merchant_created'
    | 'non_authoritative_feed'
    | 'no_confident_feed_matches';
  unchangedLatestRefreshSkippedCount: number;
  unchangedLatestTimestampRefreshedCount: number;
  upsertedLatestCount: number;
  upsertedSeedCount: number;
  discoveredMissingSetCount: number;
  autoImportableMissingSetCount: number;
  reviewNeededMissingSetCount: number;
  ignoredOrNonSetMissingSetCount: number;
  phaseTimingsMs?: AffiliateFeedImportPhaseTimings;
}

export interface AffiliateFeedImportPhaseTimings {
  catalogMatch: number;
  latestUpsert: number;
  seedUpsert: number;
  snapshotCurrentOfferUpdate: number;
  staleMark: number;
  total: number;
}

export type ExistingStaleSuccessLatestReason =
  | 'missing_from_current_feed'
  | 'product_id_mismatch_possible'
  | 'seed_url_still_same_domain'
  | 'seed_url_missing_or_invalid'
  | 'duplicate_seed_same_set_merchant'
  | 'old_manual_seed';

export interface ExistingStaleSuccessLatestDiagnosticRow {
  ageBucket: '2_7_days' | '8_30_days' | 'over_30_days' | 'unknown';
  fetchedAt?: string;
  likelyReason: ExistingStaleSuccessLatestReason;
  likelyReasons: readonly ExistingStaleSuccessLatestReason[];
  offerSeedId: string;
  observedAt?: string;
  productUrl?: string;
  seedUrlHost?: string;
  setId: string;
}

export interface AlternateAffiliateFeedImportDependencies {
  bulkRefreshCommerceOfferLatestObservationsFn?: typeof bulkRefreshCommerceOfferLatestObservations;
  bulkUpsertCommerceOfferLatestRecordsFn?: typeof bulkUpsertCommerceOfferLatestRecords;
  bulkUpsertCommerceOfferSeedsByCompositeKeyFn?: typeof bulkUpsertCommerceOfferSeedsByCompositeKey;
  createCommerceMerchantFn?: typeof createCommerceMerchant;
  getNow?: () => Date;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  loadCommerceMerchantImportReadModelFn?: typeof loadCommerceMerchantImportReadModel;
  listCommerceMerchantsFn?: typeof listCommerceMerchants;
  listCommerceOfferSeedsFn?: typeof listCommerceOfferSeeds;
  markCommerceOfferLatestUnavailableFn?: typeof markCommerceOfferLatestUnavailable;
  refreshCommerceOfferLatestObservationFn?: typeof refreshCommerceOfferLatestObservation;
  upsertCommerceOfferLatestRecordFn?: typeof upsertCommerceOfferLatestRecord;
  upsertCommerceOfferSeedByCompositeKeyFn?: typeof upsertCommerceOfferSeedByCompositeKey;
  upsertDiscoveredAffiliateSetFn?: typeof upsertCommerceAffiliateDiscoveredSet;
  updateCommerceMerchantFn?: typeof updateCommerceMerchant;
}

export interface AlternateAffiliateFeedImportOptions {
  collectUnmatchedDebug?: boolean;
  collectStaleLatestDiagnostics?: boolean;
  discoverMissingSets?: boolean;
  dryRun?: boolean;
  markUnseenLatestOffersUnavailableAuthoritative?: boolean;
  markUnseenLatestOffersUnavailable?: boolean;
  persistDiscoveredSets?: boolean;
  unmatchedSampleLimit?: number;
}

export interface AlternateAffiliateFeedUnmatchedSetSummary {
  brand?: string;
  category?: string;
  count: number;
  currency?: string;
  highestPriceMinor?: number;
  legoSetNumber: string;
  lowestPriceMinor?: number;
  productId?: string;
  productTitle?: string;
}

export interface AlternateAffiliateFeedUnmatchedDebugInfo {
  byCategory: readonly {
    category: string;
    count: number;
  }[];
  sampleRows: readonly AlternateAffiliateFeedUnmatchedSetSummary[];
  totalUnmatchedRows: number;
  uniqueUnmatchedSetCount: number;
  unmatchedSets: readonly AlternateAffiliateFeedUnmatchedSetSummary[];
}

function isLegoBrand(brand?: string): boolean {
  return brand?.trim().toLowerCase() === 'lego';
}

function isNewCondition(condition?: string): boolean {
  if (!condition?.trim()) {
    return true;
  }

  const normalizedCondition = condition.trim().toLowerCase();

  return normalizedCondition === 'new' || normalizedCondition === 'nieuw';
}

function normalizeSetId(value?: string): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function buildSourceStyleSetNumber(setId: string): string {
  return setId.includes('-') ? setId : `${setId}-1`;
}

function buildCatalogSetIdLookup(
  catalogSets: readonly {
    setId: string;
    sourceSetNumber?: string;
    status?: string;
  }[],
): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>();

  for (const catalogSet of catalogSets) {
    const canonicalSetId = normalizeSetId(catalogSet.setId);

    if (!canonicalSetId) {
      continue;
    }

    lookup.set(canonicalSetId, canonicalSetId);

    const sourceStyleSetNumber = normalizeSetId(
      catalogSet.sourceSetNumber ?? buildSourceStyleSetNumber(canonicalSetId),
    );

    if (sourceStyleSetNumber) {
      lookup.set(sourceStyleSetNumber, canonicalSetId);
    }
  }

  return lookup;
}

function buildCommerceOfferSeedKey({
  merchantId,
  setId,
}: {
  merchantId: string;
  setId: string;
}): string {
  return `${merchantId}:${setId}`;
}

function hasOfferSeedContentChanged({
  existingOfferSeed,
  input,
}: {
  existingOfferSeed?: CommerceOfferSeed;
  input: CommerceOfferSeedInput;
}): boolean {
  if (!existingOfferSeed) {
    return true;
  }

  return (
    existingOfferSeed.productUrl !== input.productUrl ||
    existingOfferSeed.isActive !== input.isActive ||
    existingOfferSeed.validationStatus !== input.validationStatus ||
    existingOfferSeed.notes !== (input.notes ?? '')
  );
}

function hasLatestOfferContentChanged({
  existingOfferSeed,
  input,
}: {
  existingOfferSeed?: CommerceOfferSeed;
  input: CommerceOfferLatestRecordInput;
}): boolean {
  const existingLatestOffer = existingOfferSeed?.latestOffer;

  if (!existingLatestOffer) {
    return true;
  }

  return (
    existingLatestOffer.fetchStatus !== input.fetchStatus ||
    existingLatestOffer.priceMinor !== input.priceMinor ||
    existingLatestOffer.currencyCode !== input.currencyCode ||
    existingLatestOffer.availability !== input.availability ||
    existingLatestOffer.errorMessage !== input.errorMessage
  );
}

function shouldRefreshLatestOfferObservation({
  existingOfferSeed,
  input,
}: {
  existingOfferSeed?: CommerceOfferSeed;
  input: CommerceOfferLatestRecordInput;
}): boolean {
  const existingLatestOffer = existingOfferSeed?.latestOffer;

  if (!existingLatestOffer) {
    return true;
  }

  return (
    existingLatestOffer.observedAt !== input.observedAt ||
    existingLatestOffer.fetchedAt !== input.fetchedAt
  );
}

const FEED_IMPORT_STALE_SUCCESS_LATEST_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const FEED_IMPORT_STALE_SUCCESS_LATEST_SAMPLE_LIMIT = 5;

function getLatestOfferObservedTime(offerSeed: CommerceOfferSeed): number {
  const timestamp =
    offerSeed.latestOffer?.observedAt ?? offerSeed.latestOffer?.fetchedAt;

  if (!timestamp) {
    return Number.NaN;
  }

  return new Date(timestamp).getTime();
}

function getUrlHost(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function getStaleLatestAgeBucket({
  latestObservedTime,
  observedAtTime,
}: {
  latestObservedTime: number;
  observedAtTime: number;
}): ExistingStaleSuccessLatestDiagnosticRow['ageBucket'] {
  if (!Number.isFinite(latestObservedTime)) {
    return 'unknown';
  }

  const ageMs = observedAtTime - latestObservedTime;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (ageDays <= 7) {
    return '2_7_days';
  }

  if (ageDays <= 30) {
    return '8_30_days';
  }

  return 'over_30_days';
}

function buildStaleLatestReason({
  currentFeedHosts,
  currentFeedMatchedSetIds,
  duplicateSeedKeys,
  merchantId,
  offerSeed,
}: {
  currentFeedHosts: ReadonlySet<string>;
  currentFeedMatchedSetIds: ReadonlySet<string>;
  duplicateSeedKeys: ReadonlySet<string>;
  merchantId: string;
  offerSeed: CommerceOfferSeed;
}): readonly ExistingStaleSuccessLatestReason[] {
  const reasons: ExistingStaleSuccessLatestReason[] = [];
  const duplicateSeedKey = buildCommerceOfferSeedKey({
    merchantId,
    setId: offerSeed.setId,
  });
  const seedUrlHost = getUrlHost(offerSeed.productUrl);

  if (!seedUrlHost) {
    reasons.push('seed_url_missing_or_invalid');
  } else if (currentFeedHosts.has(seedUrlHost)) {
    reasons.push('seed_url_still_same_domain');
  }

  if (duplicateSeedKeys.has(duplicateSeedKey)) {
    reasons.push('duplicate_seed_same_set_merchant');
  }

  if (!currentFeedMatchedSetIds.has(offerSeed.setId)) {
    reasons.push('missing_from_current_feed');
  } else if (!duplicateSeedKeys.has(duplicateSeedKey)) {
    reasons.push('product_id_mismatch_possible');
  }

  if (!offerSeed.notes.toLowerCase().includes('feed-driven')) {
    reasons.push('old_manual_seed');
  }

  return reasons.length > 0 ? reasons : ['missing_from_current_feed'];
}

function getPrimaryStaleLatestReason(
  reasons: readonly ExistingStaleSuccessLatestReason[],
): ExistingStaleSuccessLatestReason {
  const priority: readonly ExistingStaleSuccessLatestReason[] = [
    'seed_url_missing_or_invalid',
    'duplicate_seed_same_set_merchant',
    'old_manual_seed',
    'product_id_mismatch_possible',
    'missing_from_current_feed',
    'seed_url_still_same_domain',
  ];

  return (
    priority.find((reason) => reasons.includes(reason)) ??
    'missing_from_current_feed'
  );
}

function buildExistingStaleSuccessLatestDiagnostics({
  currentFeedHosts,
  currentFeedMatchedSetIds,
  existingOfferSeeds,
  matchedOfferSeedIds,
  merchantId,
  observedAt,
}: {
  currentFeedHosts: ReadonlySet<string>;
  currentFeedMatchedSetIds: ReadonlySet<string>;
  existingOfferSeeds: readonly CommerceOfferSeed[];
  matchedOfferSeedIds: ReadonlySet<string>;
  merchantId: string;
  observedAt: string;
}): {
  ageBuckets: NonNullable<
    AlternateAffiliateFeedImportResult['existingStaleSuccessLatestByAgeBucket']
  >;
  count: number;
  duplicateSeedCount: number;
  missingFromFeedCount: number;
  reportRows: readonly ExistingStaleSuccessLatestDiagnosticRow[];
  sample: AlternateAffiliateFeedImportResult['existingStaleSuccessLatestSample'];
} {
  const observedAtTime = new Date(observedAt).getTime();
  const staleCutoffTime =
    observedAtTime - FEED_IMPORT_STALE_SUCCESS_LATEST_MAX_AGE_MS;
  const activeValidSeedCountBySetAndMerchantId = existingOfferSeeds.reduce<
    Map<string, number>
  >((counts, offerSeed) => {
    if (
      offerSeed.merchantId !== merchantId ||
      !offerSeed.isActive ||
      offerSeed.validationStatus !== 'valid'
    ) {
      return counts;
    }

    const seedKey = buildCommerceOfferSeedKey({
      merchantId,
      setId: offerSeed.setId,
    });

    counts.set(seedKey, (counts.get(seedKey) ?? 0) + 1);

    return counts;
  }, new Map());
  const duplicateSeedKeys = new Set(
    [...activeValidSeedCountBySetAndMerchantId.entries()]
      .filter(([, count]) => count > 1)
      .map(([seedKey]) => seedKey),
  );
  const staleExistingOfferSeeds = existingOfferSeeds
    .filter((offerSeed) => {
      if (
        offerSeed.merchantId !== merchantId ||
        !offerSeed.isActive ||
        offerSeed.validationStatus !== 'valid' ||
        offerSeed.latestOffer?.fetchStatus !== 'success' ||
        matchedOfferSeedIds.has(offerSeed.id)
      ) {
        return false;
      }

      const latestObservedTime = getLatestOfferObservedTime(offerSeed);

      return (
        Number.isFinite(latestObservedTime) &&
        latestObservedTime < staleCutoffTime
      );
    })
    .sort(
      (left, right) =>
        getLatestOfferObservedTime(left) - getLatestOfferObservedTime(right) ||
        left.setId.localeCompare(right.setId),
    );
  const reportRows = staleExistingOfferSeeds.map((offerSeed) => {
    const latestObservedTime = getLatestOfferObservedTime(offerSeed);
    const ageBucket = getStaleLatestAgeBucket({
      latestObservedTime,
      observedAtTime,
    });
    const likelyReasons = buildStaleLatestReason({
      currentFeedHosts,
      currentFeedMatchedSetIds,
      duplicateSeedKeys,
      merchantId,
      offerSeed,
    });

    const fetchedAt = offerSeed.latestOffer?.fetchedAt;
    const observedLatestAt = offerSeed.latestOffer?.observedAt;
    const seedUrlHost = getUrlHost(offerSeed.productUrl);

    return {
      ageBucket,
      likelyReason: getPrimaryStaleLatestReason(likelyReasons),
      likelyReasons,
      offerSeedId: offerSeed.id,
      productUrl: offerSeed.productUrl,
      setId: offerSeed.setId,
      ...(fetchedAt ? { fetchedAt } : {}),
      ...(observedLatestAt ? { observedAt: observedLatestAt } : {}),
      ...(seedUrlHost ? { seedUrlHost } : {}),
    };
  });
  const ageBuckets = reportRows.reduce<
    NonNullable<
      AlternateAffiliateFeedImportResult['existingStaleSuccessLatestByAgeBucket']
    >
  >(
    (counts, reportRow) => ({
      ...counts,
      [reportRow.ageBucket]: counts[reportRow.ageBucket] + 1,
    }),
    {
      '2_7_days': 0,
      '8_30_days': 0,
      over_30_days: 0,
      unknown: 0,
    },
  );

  return {
    count: staleExistingOfferSeeds.length,
    ageBuckets,
    duplicateSeedCount: reportRows.filter((reportRow) =>
      reportRow.likelyReasons.includes('duplicate_seed_same_set_merchant'),
    ).length,
    missingFromFeedCount: reportRows.filter((reportRow) =>
      reportRow.likelyReasons.includes('missing_from_current_feed'),
    ).length,
    reportRows,
    sample: reportRows.slice(0, FEED_IMPORT_STALE_SUCCESS_LATEST_SAMPLE_LIMIT),
  };
}

function resolveCatalogSetIdForAlternateRow({
  catalogSetIdByIdentifier,
  feedSetNumber,
}: {
  catalogSetIdByIdentifier: ReadonlyMap<string, string>;
  feedSetNumber?: string;
}): string | undefined {
  const normalizedFeedSetNumber = normalizeSetId(feedSetNumber);

  if (!normalizedFeedSetNumber) {
    return undefined;
  }

  const exactCanonicalSetId = catalogSetIdByIdentifier.get(
    normalizedFeedSetNumber,
  );

  if (exactCanonicalSetId) {
    return exactCanonicalSetId;
  }

  if (normalizedFeedSetNumber.includes('-')) {
    const [plainSetNumber] = normalizedFeedSetNumber.split('-', 1);

    return normalizeSetId(plainSetNumber)
      ? catalogSetIdByIdentifier.get(plainSetNumber)
      : undefined;
  }

  return catalogSetIdByIdentifier.get(
    buildSourceStyleSetNumber(normalizedFeedSetNumber),
  );
}

function normalizeCurrency(value?: string): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue.toUpperCase() : undefined;
}

function parsePriceMinor(value?: number | string): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const compactValue = trimmedValue
    .replace(/\u00a0/g, ' ')
    .replace(/,\s*-\s*$/u, ',00')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=.*\.)/g, '.');

  if (
    !compactValue ||
    compactValue === '-' ||
    compactValue === ',' ||
    compactValue === '.'
  ) {
    return undefined;
  }

  let normalizedValue = compactValue;
  const lastCommaIndex = compactValue.lastIndexOf(',');
  const lastDotIndex = compactValue.lastIndexOf('.');

  if (lastCommaIndex >= 0 && lastDotIndex >= 0) {
    normalizedValue =
      lastCommaIndex > lastDotIndex
        ? compactValue.replace(/\./g, '').replace(',', '.')
        : compactValue.replace(/,/g, '');
  } else if (lastCommaIndex >= 0) {
    normalizedValue =
      compactValue.length - lastCommaIndex - 1 >= 1 &&
      compactValue.length - lastCommaIndex - 1 <= 2
        ? compactValue.replace(/\./g, '').replace(',', '.')
        : compactValue.replace(/,/g, '');
  } else if (lastDotIndex >= 0 && compactValue.length - lastDotIndex - 1 > 2) {
    normalizedValue = compactValue.replace(/\./g, '');
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return Math.round(parsedValue * 100);
}

function normalizeAvailability(
  availabilityText?: string,
): 'in_stock' | 'limited' | 'out_of_stock' | 'preorder' | 'unknown' {
  const normalizedValue = availabilityText?.trim().toLowerCase() ?? '';

  if (!normalizedValue) {
    return 'unknown';
  }

  if (
    normalizedValue.includes('uitverkocht') ||
    normalizedValue.includes('niet op voorraad') ||
    normalizedValue.includes('niet beschikbaar') ||
    normalizedValue.includes('out of stock')
  ) {
    return 'out_of_stock';
  }

  if (
    normalizedValue.includes('pre-order') ||
    normalizedValue.includes('preorder') ||
    normalizedValue.includes('verwacht')
  ) {
    return 'preorder';
  }

  if (
    normalizedValue.includes('beperkte voorraad') ||
    normalizedValue.includes('limited stock') ||
    normalizedValue.includes('laatste stuks')
  ) {
    return 'limited';
  }

  if (
    normalizedValue.includes('op voorraad') ||
    normalizedValue.includes('direct leverbaar') ||
    normalizedValue.includes('in stock')
  ) {
    return 'in_stock';
  }

  return 'unknown';
}

function normalizeOptionalText(value?: string): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function buildAffiliateFeedOfferSeedNotes({
  merchant,
  row,
}: {
  merchant: AffiliateFeedMerchantConfig;
  row: AlternateAffiliateFeedRow;
}): string {
  const baseNotes =
    merchant.sourceType === 'affiliate' && merchant.affiliateNetwork
      ? `Feed-driven ${merchant.name} import via ${merchant.affiliateNetwork}. Exact matched by LEGO set number. Product title: ${row.productTitle ?? 'unknown'}.`
      : `Feed-driven ${merchant.name} import. Exact matched by LEGO set number. Product title: ${row.productTitle ?? 'unknown'}.`;
  const sourceMetadata = Object.fromEntries(
    Object.entries(row.sourceMetadata ?? {}).filter(
      ([, value]) => value !== undefined,
    ),
  );

  return Object.keys(sourceMetadata).length > 0
    ? `${baseNotes} Source metadata: ${JSON.stringify(sourceMetadata)}.`
    : baseNotes;
}

function sortUnmatchedSetSummaries(
  left: AlternateAffiliateFeedUnmatchedSetSummary,
  right: AlternateAffiliateFeedUnmatchedSetSummary,
): number {
  return (
    right.count - left.count ||
    left.legoSetNumber.localeCompare(right.legoSetNumber) ||
    (left.productTitle ?? '').localeCompare(right.productTitle ?? '')
  );
}

function buildUnmatchedDebugInfo({
  sampleLimit,
  unmatchedRowsBySetId,
}: {
  sampleLimit?: number;
  unmatchedRowsBySetId: ReadonlyMap<
    string,
    {
      brand?: string;
      category?: string;
      count: number;
      currency?: string;
      legoSetNumber: string;
      productTitle?: string;
    }
  >;
}): AlternateAffiliateFeedUnmatchedDebugInfo {
  const unmatchedSets = [...unmatchedRowsBySetId.values()].sort(
    sortUnmatchedSetSummaries,
  );
  const totalUnmatchedRows = unmatchedSets.reduce(
    (totalCount, unmatchedSet) => totalCount + unmatchedSet.count,
    0,
  );
  const categoryCountByName = unmatchedSets.reduce<Map<string, number>>(
    (counts, unmatchedSet) => {
      const categoryName = unmatchedSet.category ?? 'Onbekend';

      counts.set(
        categoryName,
        (counts.get(categoryName) ?? 0) + unmatchedSet.count,
      );

      return counts;
    },
    new Map(),
  );
  const byCategory = [...categoryCountByName.entries()]
    .map(([category, count]) => ({
      category,
      count,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.category.localeCompare(right.category),
    );
  const resolvedSampleLimit =
    typeof sampleLimit === 'number' && sampleLimit > 0
      ? sampleLimit
      : unmatchedSets.length;

  return {
    byCategory,
    sampleRows: unmatchedSets.slice(0, resolvedSampleLimit),
    totalUnmatchedRows,
    uniqueUnmatchedSetCount: unmatchedSets.length,
    unmatchedSets,
  };
}

function startTimer(): () => number {
  const startedAt = Date.now();

  return () => Date.now() - startedAt;
}

function buildCommerceOfferSeedInputKey(input: CommerceOfferSeedInput): string {
  return buildCommerceOfferSeedKey({
    merchantId: input.merchantId,
    setId: input.setId,
  });
}

async function defaultLegacyBulkUpsertCommerceOfferSeedsByCompositeKey({
  inputs,
  upsertCommerceOfferSeedByCompositeKeyFn,
}: {
  inputs: readonly CommerceOfferSeedInput[];
  upsertCommerceOfferSeedByCompositeKeyFn: typeof upsertCommerceOfferSeedByCompositeKey;
}): Promise<CommerceOfferSeed[]> {
  return Promise.all(
    inputs.map((input) =>
      upsertCommerceOfferSeedByCompositeKeyFn({
        input,
      }),
    ),
  );
}

async function defaultLegacyBulkUpsertCommerceOfferLatestRecords({
  inputs,
  upsertCommerceOfferLatestRecordFn,
}: {
  inputs: readonly CommerceOfferLatestRecordInput[];
  upsertCommerceOfferLatestRecordFn: typeof upsertCommerceOfferLatestRecord;
}): Promise<void> {
  await Promise.all(
    inputs.map((input) =>
      upsertCommerceOfferLatestRecordFn({
        input,
      }),
    ),
  );
}

async function defaultLegacyBulkRefreshCommerceOfferLatestObservations({
  fetchedAt,
  offerSeedIds,
  observedAt,
  refreshCommerceOfferLatestObservationFn,
}: {
  fetchedAt: string;
  offerSeedIds: readonly string[];
  observedAt: string;
  refreshCommerceOfferLatestObservationFn: typeof refreshCommerceOfferLatestObservation;
}): Promise<number> {
  await Promise.all(
    offerSeedIds.map((offerSeedId) =>
      refreshCommerceOfferLatestObservationFn({
        fetchedAt,
        observedAt,
        offerSeedId,
      }),
    ),
  );

  return new Set(offerSeedIds).size;
}

async function ensureAffiliateMerchant({
  createCommerceMerchantFn,
  dryRun,
  listCommerceMerchantsFn,
  merchantConfig,
  updateCommerceMerchantFn,
}: {
  createCommerceMerchantFn: typeof createCommerceMerchant;
  dryRun?: boolean;
  listCommerceMerchantsFn: typeof listCommerceMerchants;
  merchantConfig: AffiliateFeedMerchantConfig;
  updateCommerceMerchantFn: typeof updateCommerceMerchant;
}): Promise<{
  merchant: CommerceMerchant;
  merchantCreated: boolean;
}> {
  const existingMerchant = (await listCommerceMerchantsFn()).find(
    (merchant) => merchant.slug === merchantConfig.slug,
  );

  return ensureAffiliateMerchantFromExisting({
    createCommerceMerchantFn,
    dryRun,
    existingMerchant,
    merchantConfig,
    updateCommerceMerchantFn,
  });
}

async function ensureAffiliateMerchantFromExisting({
  createCommerceMerchantFn,
  dryRun,
  existingMerchant,
  merchantConfig,
  updateCommerceMerchantFn,
}: {
  createCommerceMerchantFn: typeof createCommerceMerchant;
  dryRun?: boolean;
  existingMerchant?: CommerceMerchant;
  merchantConfig: AffiliateFeedMerchantConfig;
  updateCommerceMerchantFn: typeof updateCommerceMerchant;
}): Promise<{
  merchant: CommerceMerchant;
  merchantCreated: boolean;
}> {
  const sourceType = merchantConfig.sourceType ?? 'affiliate';
  const merchantInput: CommerceMerchantInput = {
    slug: merchantConfig.slug,
    name: merchantConfig.name,
    isActive: true,
    sourceType,
    affiliateNetwork:
      sourceType === 'affiliate' ? merchantConfig.affiliateNetwork : undefined,
    notes: merchantConfig.notes,
  };

  if (dryRun) {
    return {
      merchant: existingMerchant ?? {
        affiliateNetwork: merchantInput.affiliateNetwork,
        createdAt: '',
        id: `dry-run-${merchantConfig.slug}`,
        isActive: merchantInput.isActive,
        name: merchantInput.name,
        notes: merchantInput.notes ?? '',
        slug: merchantInput.slug,
        sourceType: merchantInput.sourceType,
        updatedAt: '',
      },
      merchantCreated: false,
    };
  }

  if (!existingMerchant) {
    return {
      merchant: await createCommerceMerchantFn({
        input: merchantInput,
      }),
      merchantCreated: true,
    };
  }

  if (
    existingMerchant.name !== merchantInput.name ||
    existingMerchant.isActive !== merchantInput.isActive ||
    existingMerchant.sourceType !== merchantInput.sourceType ||
    existingMerchant.affiliateNetwork !== merchantInput.affiliateNetwork ||
    existingMerchant.notes !== merchantInput.notes
  ) {
    return {
      merchant: await updateCommerceMerchantFn({
        input: merchantInput,
        merchantId: existingMerchant.id,
      }),
      merchantCreated: false,
    };
  }

  return {
    merchant: existingMerchant,
    merchantCreated: false,
  };
}

export async function importAffiliateFeedRowsForMerchant({
  dependencies = {},
  merchant,
  options,
  rows,
}: {
  dependencies?: AlternateAffiliateFeedImportDependencies;
  merchant: AffiliateFeedMerchantConfig;
  options?: AlternateAffiliateFeedImportOptions;
  rows: readonly AlternateAffiliateFeedRow[];
}): Promise<AlternateAffiliateFeedImportResult> {
  const {
    bulkRefreshCommerceOfferLatestObservationsFn,
    bulkUpsertCommerceOfferLatestRecordsFn,
    bulkUpsertCommerceOfferSeedsByCompositeKeyFn,
    createCommerceMerchantFn = createCommerceMerchant,
    getNow = () => new Date(),
    listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
    listCommerceMerchantsFn = listCommerceMerchants,
    listCommerceOfferSeedsFn = listCommerceOfferSeeds,
    markCommerceOfferLatestUnavailableFn = markCommerceOfferLatestUnavailable,
    refreshCommerceOfferLatestObservationFn = refreshCommerceOfferLatestObservation,
    upsertCommerceOfferLatestRecordFn = upsertCommerceOfferLatestRecord,
    upsertCommerceOfferSeedByCompositeKeyFn = upsertCommerceOfferSeedByCompositeKey,
    upsertDiscoveredAffiliateSetFn = upsertCommerceAffiliateDiscoveredSet,
    updateCommerceMerchantFn = updateCommerceMerchant,
  } = dependencies;
  const loadCommerceMerchantImportReadModelFn =
    dependencies.loadCommerceMerchantImportReadModelFn ??
    loadCommerceMerchantImportReadModel;
  const resolvedBulkUpsertCommerceOfferSeedsByCompositeKeyFn =
    bulkUpsertCommerceOfferSeedsByCompositeKeyFn ??
    (dependencies.upsertCommerceOfferSeedByCompositeKeyFn
      ? (input: { inputs: readonly CommerceOfferSeedInput[] }) =>
          defaultLegacyBulkUpsertCommerceOfferSeedsByCompositeKey({
            inputs: input.inputs,
            upsertCommerceOfferSeedByCompositeKeyFn,
          })
      : bulkUpsertCommerceOfferSeedsByCompositeKey);
  const resolvedBulkUpsertCommerceOfferLatestRecordsFn =
    bulkUpsertCommerceOfferLatestRecordsFn ??
    (dependencies.upsertCommerceOfferLatestRecordFn
      ? (input: { inputs: readonly CommerceOfferLatestRecordInput[] }) =>
          defaultLegacyBulkUpsertCommerceOfferLatestRecords({
            inputs: input.inputs,
            upsertCommerceOfferLatestRecordFn,
          })
      : bulkUpsertCommerceOfferLatestRecords);
  const resolvedBulkRefreshCommerceOfferLatestObservationsFn =
    bulkRefreshCommerceOfferLatestObservationsFn ??
    (dependencies.refreshCommerceOfferLatestObservationFn
      ? (input: {
          fetchedAt: string;
          observedAt: string;
          offerSeedIds: readonly string[];
        }) =>
          defaultLegacyBulkRefreshCommerceOfferLatestObservations({
            fetchedAt: input.fetchedAt,
            observedAt: input.observedAt,
            offerSeedIds: input.offerSeedIds,
            refreshCommerceOfferLatestObservationFn,
          })
      : bulkRefreshCommerceOfferLatestObservations);
  const stopTotalTimer = startTimer();
  const phaseTimingsMs: AffiliateFeedImportPhaseTimings = {
    catalogMatch: 0,
    latestUpsert: 0,
    seedUpsert: 0,
    snapshotCurrentOfferUpdate: 0,
    staleMark: 0,
    total: 0,
  };
  const shouldPersistDiscoveredSets =
    !options?.dryRun &&
    Boolean(options?.persistDiscoveredSets ?? options?.discoverMissingSets);
  const shouldLoadExistingOfferSeeds = !(
    options?.dryRun && !options.collectStaleLatestDiagnostics
  );
  const useInjectedLegacyMerchantSeedLoaders =
    Boolean(dependencies.listCommerceMerchantsFn) ||
    Boolean(dependencies.listCommerceOfferSeedsFn);
  const scopedImportReadModel = useInjectedLegacyMerchantSeedLoaders
    ? undefined
    : await loadCommerceMerchantImportReadModelFn({
        includeOfferSeeds: shouldLoadExistingOfferSeeds,
        merchantSlug: merchant.slug,
      });
  const { merchant: resolvedMerchant, merchantCreated } = scopedImportReadModel
    ? await ensureAffiliateMerchantFromExisting({
        createCommerceMerchantFn,
        dryRun: options?.dryRun,
        existingMerchant: scopedImportReadModel.merchant,
        merchantConfig: merchant,
        updateCommerceMerchantFn,
      })
    : await ensureAffiliateMerchant({
        createCommerceMerchantFn,
        dryRun: options?.dryRun,
        listCommerceMerchantsFn,
        merchantConfig: merchant,
        updateCommerceMerchantFn,
      });
  const existingOfferSeedsPromise =
    !shouldLoadExistingOfferSeeds || merchantCreated
      ? Promise.resolve([])
      : scopedImportReadModel
        ? Promise.resolve(scopedImportReadModel.offerSeeds)
        : dependencies.listCommerceOfferSeedsFn
          ? listCommerceOfferSeedsFn()
          : Promise.resolve([]);
  const [canonicalCatalogSets, existingOfferSeeds] = await Promise.all([
    listCanonicalCatalogSetsFn(),
    existingOfferSeedsPromise,
  ]);
  const catalogSetIdByIdentifier =
    buildCatalogSetIdLookup(canonicalCatalogSets);
  const catalogSetSlugById = new Map(
    canonicalCatalogSets.flatMap((catalogSet) =>
      catalogSet.slug ? [[catalogSet.setId, catalogSet.slug] as const] : [],
    ),
  );
  const existingOfferSeedBySetAndMerchantId = new Map(
    existingOfferSeeds.map((offerSeed) => [
      buildCommerceOfferSeedKey({
        merchantId: offerSeed.merchantId,
        setId: offerSeed.setId,
      }),
      offerSeed,
    ]),
  );
  const observedAt = getNow().toISOString();
  const matchedCatalogSetIds = new Set<string>();
  const matchedOfferSeedIds = new Set<string>();
  const currentFeedHosts = new Set(
    rows.flatMap((row) => {
      const host = getUrlHost(row.affiliateDeeplink);

      return host ? [host] : [];
    }),
  );
  const upsertedSeedIds = new Set<string>();
  const upsertedLatestSeedIds = new Set<string>();
  const timestampRefreshedLatestSeedIds = new Set<string>();
  const changedSetIds = new Set<string>();
  const discoveredMissingSetIds = new Set<string>();
  const autoImportableMissingSetIds = new Set<string>();
  const reviewNeededMissingSetIds = new Set<string>();
  const ignoredOrNonSetMissingSetIds = new Set<string>();
  let skippedNonLegoCount = 0;
  let skippedNonNewCount = 0;
  let skippedMissingSetNumberCount = 0;
  let skippedUnmatchedSetCount = 0;
  let skippedInvalidCurrencyCount = 0;
  let skippedInvalidPriceCount = 0;
  let skippedInvalidDeeplinkCount = 0;
  let unchangedLatestRefreshSkippedCount = 0;
  let staleMarkSkippedReason:
    | AlternateAffiliateFeedImportResult['staleMarkSkippedReason']
    | undefined;
  const unmatchedRowsBySetId = new Map<
    string,
    AlternateAffiliateFeedUnmatchedSetSummary
  >();
  const pendingMatchedOffers: {
    existingOfferSeed?: CommerceOfferSeed;
    latestOfferInput: Omit<CommerceOfferLatestRecordInput, 'offerSeedId'>;
    matchedCatalogSetId: string;
    offerSeedInput: CommerceOfferSeedInput;
  }[] = [];
  const stopCatalogMatchTimer = startTimer();

  for (const row of rows) {
    if (!isLegoBrand(row.brand)) {
      skippedNonLegoCount += 1;
      continue;
    }

    if (!isNewCondition(row.condition)) {
      skippedNonNewCount += 1;
      continue;
    }

    const setId = normalizeSetId(row.legoSetNumber);

    if (!setId) {
      skippedMissingSetNumberCount += 1;
      continue;
    }

    const matchedCatalogSetId = resolveCatalogSetIdForAlternateRow({
      catalogSetIdByIdentifier,
      feedSetNumber: setId,
    });

    if (!matchedCatalogSetId) {
      skippedUnmatchedSetCount += 1;
      let deeplinkUrl: URL | undefined;

      try {
        deeplinkUrl = row.affiliateDeeplink
          ? new URL(row.affiliateDeeplink)
          : undefined;
      } catch {
        deeplinkUrl = undefined;
      }

      if (deeplinkUrl && shouldPersistDiscoveredSets) {
        const discoveredSet = await upsertDiscoveredAffiliateSetFn({
          input: {
            affiliateId: resolvedMerchant.id,
            currencyCode: normalizeCurrency(row.currency),
            imageUrl: normalizeOptionalText(row.imageUrl),
            observedAt,
            priceMinor: parsePriceMinor(row.price),
            productTitle: normalizeOptionalText(row.productTitle),
            productUrl: deeplinkUrl.toString(),
            rawPayload: {
              ...row,
            },
            setNumber: setId,
          },
        });

        if (discoveredSet) {
          discoveredMissingSetIds.add(discoveredSet.id);

          if (
            discoveredSet.status === 'ignored' ||
            discoveredSet.status === 'non_set'
          ) {
            ignoredOrNonSetMissingSetIds.add(discoveredSet.id);
          } else if (discoveredSet.confidence === 'high') {
            autoImportableMissingSetIds.add(discoveredSet.id);
          } else {
            reviewNeededMissingSetIds.add(discoveredSet.id);
          }
        }
      } else if (options?.dryRun) {
        const dryRunConfidence = scoreCommerceAffiliateDiscoveredSet({
          imageUrl: row.imageUrl,
          productTitle: row.productTitle,
          productUrl: row.affiliateDeeplink,
          setNumber: setId,
        });

        discoveredMissingSetIds.add(`${resolvedMerchant.id}:${setId}`);

        if (dryRunConfidence === 'high') {
          autoImportableMissingSetIds.add(`${resolvedMerchant.id}:${setId}`);
        } else {
          reviewNeededMissingSetIds.add(`${resolvedMerchant.id}:${setId}`);
        }
      }

      if (options?.collectUnmatchedDebug) {
        const existingUnmatchedSet = unmatchedRowsBySetId.get(setId);
        const observedPriceMinor = parsePriceMinor(row.price);
        const normalizedProductId = normalizeOptionalText(row.productId);

        unmatchedRowsBySetId.set(setId, {
          legoSetNumber: setId,
          ...(existingUnmatchedSet?.productId || normalizedProductId
            ? {
                productId:
                  existingUnmatchedSet?.productId ?? normalizedProductId,
              }
            : {}),
          productTitle:
            existingUnmatchedSet?.productTitle ??
            normalizeOptionalText(row.productTitle),
          brand:
            existingUnmatchedSet?.brand ?? normalizeOptionalText(row.brand),
          currency:
            existingUnmatchedSet?.currency ?? normalizeCurrency(row.currency),
          category:
            existingUnmatchedSet?.category ??
            normalizeOptionalText(row.category),
          highestPriceMinor:
            typeof observedPriceMinor === 'number'
              ? Math.max(
                  existingUnmatchedSet?.highestPriceMinor ?? observedPriceMinor,
                  observedPriceMinor,
                )
              : existingUnmatchedSet?.highestPriceMinor,
          lowestPriceMinor:
            typeof observedPriceMinor === 'number'
              ? Math.min(
                  existingUnmatchedSet?.lowestPriceMinor ?? observedPriceMinor,
                  observedPriceMinor,
                )
              : existingUnmatchedSet?.lowestPriceMinor,
          count: (existingUnmatchedSet?.count ?? 0) + 1,
        });
      }

      continue;
    }

    if (normalizeCurrency(row.currency) !== 'EUR') {
      skippedInvalidCurrencyCount += 1;
      continue;
    }

    const priceMinor = parsePriceMinor(row.price);

    if (typeof priceMinor !== 'number') {
      skippedInvalidPriceCount += 1;
      continue;
    }

    let deeplinkUrl: URL;

    try {
      deeplinkUrl = new URL(row.affiliateDeeplink);
    } catch {
      skippedInvalidDeeplinkCount += 1;
      continue;
    }

    if (options?.dryRun) {
      const existingOfferSeed = existingOfferSeedBySetAndMerchantId.get(
        buildCommerceOfferSeedKey({
          merchantId: resolvedMerchant.id,
          setId: matchedCatalogSetId,
        }),
      );

      matchedCatalogSetIds.add(matchedCatalogSetId);
      if (existingOfferSeed) {
        matchedOfferSeedIds.add(existingOfferSeed.id);
      }
      continue;
    }

    const existingOfferSeed = existingOfferSeedBySetAndMerchantId.get(
      buildCommerceOfferSeedKey({
        merchantId: resolvedMerchant.id,
        setId: matchedCatalogSetId,
      }),
    );
    const offerSeedInput: CommerceOfferSeedInput = {
      setId: matchedCatalogSetId,
      merchantId: resolvedMerchant.id,
      productUrl: deeplinkUrl.toString(),
      isActive: true,
      validationStatus: 'valid',
      lastVerifiedAt: observedAt,
      notes: buildAffiliateFeedOfferSeedNotes({
        merchant,
        row,
      }),
    };
    const latestOfferInput: Omit<
      CommerceOfferLatestRecordInput,
      'offerSeedId'
    > = {
      fetchStatus: 'success',
      priceMinor,
      currencyCode: 'EUR',
      availability: normalizeAvailability(row.availabilityText),
      observedAt,
      fetchedAt: observedAt,
    };

    pendingMatchedOffers.push({
      existingOfferSeed,
      latestOfferInput,
      matchedCatalogSetId,
      offerSeedInput,
    });
  }

  phaseTimingsMs.catalogMatch = stopCatalogMatchTimer();

  if (!options?.dryRun && pendingMatchedOffers.length > 0) {
    const seedInputsToUpsertByKey = new Map<string, CommerceOfferSeedInput>();

    for (const pendingOffer of pendingMatchedOffers) {
      if (
        hasOfferSeedContentChanged({
          existingOfferSeed: pendingOffer.existingOfferSeed,
          input: pendingOffer.offerSeedInput,
        })
      ) {
        seedInputsToUpsertByKey.set(
          buildCommerceOfferSeedInputKey(pendingOffer.offerSeedInput),
          pendingOffer.offerSeedInput,
        );
      }
    }

    const stopSeedUpsertTimer = startTimer();
    const upsertedOfferSeeds =
      await resolvedBulkUpsertCommerceOfferSeedsByCompositeKeyFn({
        inputs: [...seedInputsToUpsertByKey.values()],
      });
    phaseTimingsMs.seedUpsert = stopSeedUpsertTimer();
    const offerSeedBySetAndMerchantId = new Map(
      existingOfferSeeds.map((offerSeed) => [
        buildCommerceOfferSeedKey({
          merchantId: offerSeed.merchantId,
          setId: offerSeed.setId,
        }),
        offerSeed,
      ]),
    );

    for (const offerSeed of upsertedOfferSeeds) {
      offerSeedBySetAndMerchantId.set(
        buildCommerceOfferSeedKey({
          merchantId: offerSeed.merchantId,
          setId: offerSeed.setId,
        }),
        offerSeed,
      );
      upsertedSeedIds.add(offerSeed.id);
    }

    const latestInputsToUpsert: CommerceOfferLatestRecordInput[] = [];
    const latestOfferSeedIdsToRefresh: string[] = [];

    for (const pendingOffer of pendingMatchedOffers) {
      const seedKey = buildCommerceOfferSeedInputKey(
        pendingOffer.offerSeedInput,
      );
      const offerSeed = offerSeedBySetAndMerchantId.get(seedKey);

      if (!offerSeed) {
        throw new Error(
          'Unable to resolve the commerce offer seed after upsert.',
        );
      }

      const latestOfferInput: CommerceOfferLatestRecordInput = {
        ...pendingOffer.latestOfferInput,
        offerSeedId: offerSeed.id,
      };
      const seedContentChanged = seedInputsToUpsertByKey.has(seedKey);
      const latestOfferContentChanged = hasLatestOfferContentChanged({
        existingOfferSeed: pendingOffer.existingOfferSeed,
        input: latestOfferInput,
      });
      const latestOfferObservationChanged = shouldRefreshLatestOfferObservation(
        {
          existingOfferSeed: pendingOffer.existingOfferSeed,
          input: latestOfferInput,
        },
      );

      if (latestOfferContentChanged) {
        latestInputsToUpsert.push(latestOfferInput);
      } else if (latestOfferObservationChanged) {
        latestOfferSeedIdsToRefresh.push(offerSeed.id);
      } else {
        unchangedLatestRefreshSkippedCount += 1;
      }

      matchedCatalogSetIds.add(pendingOffer.matchedCatalogSetId);
      matchedOfferSeedIds.add(offerSeed.id);

      if (seedContentChanged) {
        changedSetIds.add(pendingOffer.matchedCatalogSetId);
      }

      if (latestOfferContentChanged) {
        upsertedLatestSeedIds.add(offerSeed.id);
        changedSetIds.add(pendingOffer.matchedCatalogSetId);
      }
    }

    const stopLatestUpsertTimer = startTimer();
    const latestInputsToUpsertBySeedId = new Map(
      latestInputsToUpsert.map((input) => [input.offerSeedId, input] as const),
    );
    const uniqueLatestOfferSeedIdsToRefresh = [
      ...new Set(latestOfferSeedIdsToRefresh),
    ];

    await resolvedBulkUpsertCommerceOfferLatestRecordsFn({
      inputs: [...latestInputsToUpsertBySeedId.values()],
    });
    const refreshedLatestCount =
      await resolvedBulkRefreshCommerceOfferLatestObservationsFn({
        fetchedAt: observedAt,
        observedAt,
        offerSeedIds: uniqueLatestOfferSeedIdsToRefresh,
      });

    for (const offerSeedId of uniqueLatestOfferSeedIdsToRefresh) {
      timestampRefreshedLatestSeedIds.add(offerSeedId);
    }

    if (refreshedLatestCount !== uniqueLatestOfferSeedIdsToRefresh.length) {
      throw new Error(
        'Unable to refresh all unchanged commerce latest offers.',
      );
    }

    phaseTimingsMs.latestUpsert = stopLatestUpsertTimer();
  } else if (options?.dryRun) {
    phaseTimingsMs.seedUpsert = 0;
    phaseTimingsMs.latestUpsert = 0;
  }

  const staleLatestOfferSeedIds =
    !options?.dryRun &&
    !merchantCreated &&
    options?.markUnseenLatestOffersUnavailable !== false &&
    options?.markUnseenLatestOffersUnavailableAuthoritative === true &&
    rows.length > 0 &&
    matchedOfferSeedIds.size > 0
      ? existingOfferSeeds
          .filter(
            (offerSeed) =>
              offerSeed.merchantId === resolvedMerchant.id &&
              offerSeed.isActive &&
              offerSeed.validationStatus === 'valid' &&
              offerSeed.latestOffer?.fetchStatus === 'success' &&
              !matchedOfferSeedIds.has(offerSeed.id),
          )
          .map((offerSeed) => offerSeed.id)
      : [];

  let latestRowsMarkedStaleCount = 0;

  const stopStaleMarkTimer = startTimer();

  if (staleLatestOfferSeedIds.length > 0) {
    latestRowsMarkedStaleCount = await markCommerceOfferLatestUnavailableFn({
      fetchedAt: observedAt,
      observedAt,
      offerSeedIds: staleLatestOfferSeedIds,
    });
  } else if (options?.dryRun) {
    staleMarkSkippedReason = 'dry_run';
  } else if (merchantCreated) {
    staleMarkSkippedReason = 'merchant_created';
  } else if (options?.markUnseenLatestOffersUnavailable === false) {
    staleMarkSkippedReason = 'disabled';
  } else if (options?.markUnseenLatestOffersUnavailableAuthoritative !== true) {
    staleMarkSkippedReason = 'non_authoritative_feed';
  } else if (rows.length === 0 || matchedOfferSeedIds.size === 0) {
    staleMarkSkippedReason = 'no_confident_feed_matches';
  }

  phaseTimingsMs.staleMark = stopStaleMarkTimer();

  const existingStaleSuccessLatestDiagnostics =
    (!options?.dryRun || options.collectStaleLatestDiagnostics) &&
    !merchantCreated
      ? buildExistingStaleSuccessLatestDiagnostics({
          currentFeedHosts,
          currentFeedMatchedSetIds: matchedCatalogSetIds,
          existingOfferSeeds,
          matchedOfferSeedIds,
          merchantId: resolvedMerchant.id,
          observedAt,
        })
      : {
          ageBuckets: {
            '2_7_days': 0,
            '8_30_days': 0,
            over_30_days: 0,
            unknown: 0,
          },
          count: 0,
          duplicateSeedCount: 0,
          missingFromFeedCount: 0,
          reportRows: [],
          sample: [],
        };

  phaseTimingsMs.total = stopTotalTimer();

  return {
    changedSetIds: [...changedSetIds].sort(),
    changedSetSlugs: [...changedSetIds]
      .flatMap((setId) => {
        const slug = catalogSetSlugById.get(setId);

        return slug ? [slug] : [];
      })
      .sort(),
    changedLatestOfferCount: upsertedLatestSeedIds.size,
    importedOfferCount: upsertedLatestSeedIds.size,
    matchedOfferCount: matchedOfferSeedIds.size,
    matchedCatalogSetCount: matchedCatalogSetIds.size,
    merchantCreated,
    merchantSlug: resolvedMerchant.slug,
    skippedInvalidCurrencyCount,
    skippedInvalidDeeplinkCount,
    skippedInvalidPriceCount,
    skippedMissingSetNumberCount,
    skippedNonLegoCount,
    skippedNonNewCount,
    skippedUnmatchedSetCount,
    totalRowCount: rows.length,
    existingStaleSuccessLatestCount:
      existingStaleSuccessLatestDiagnostics.count,
    existingStaleSuccessLatestByAgeBucket:
      existingStaleSuccessLatestDiagnostics.ageBuckets,
    existingStaleSuccessLatestDuplicateSeedCount:
      existingStaleSuccessLatestDiagnostics.duplicateSeedCount,
    existingStaleSuccessLatestMissingFromFeedCount:
      existingStaleSuccessLatestDiagnostics.missingFromFeedCount,
    existingStaleSuccessLatestReportRows:
      existingStaleSuccessLatestDiagnostics.reportRows,
    existingStaleSuccessLatestSample:
      existingStaleSuccessLatestDiagnostics.sample,
    latestRowsMarkedStaleCount,
    latestRowsSeenCount: matchedOfferSeedIds.size,
    ...(staleMarkSkippedReason ? { staleMarkSkippedReason } : {}),
    unchangedLatestRefreshSkippedCount,
    unchangedLatestTimestampRefreshedCount:
      timestampRefreshedLatestSeedIds.size,
    upsertedLatestCount: upsertedLatestSeedIds.size,
    upsertedSeedCount: upsertedSeedIds.size,
    discoveredMissingSetCount: discoveredMissingSetIds.size,
    autoImportableMissingSetCount: autoImportableMissingSetIds.size,
    reviewNeededMissingSetCount: reviewNeededMissingSetIds.size,
    ignoredOrNonSetMissingSetCount: ignoredOrNonSetMissingSetIds.size,
    phaseTimingsMs,
    ...(options?.collectUnmatchedDebug && skippedUnmatchedSetCount > 0
      ? {
          unmatchedDebug: buildUnmatchedDebugInfo({
            sampleLimit: options.unmatchedSampleLimit,
            unmatchedRowsBySetId,
          }),
        }
      : {}),
  };
}

export async function importAlternateAffiliateFeedRows({
  dependencies = {},
  options,
  rows,
}: {
  dependencies?: AlternateAffiliateFeedImportDependencies;
  options?: AlternateAffiliateFeedImportOptions;
  rows: readonly AlternateAffiliateFeedRow[];
}): Promise<AlternateAffiliateFeedImportResult> {
  return importAffiliateFeedRowsForMerchant({
    dependencies,
    merchant: ALTERNATE_MERCHANT_CONFIG,
    options,
    rows,
  });
}
