import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import {
  createCommerceMerchant,
  listCommerceMerchants,
  upsertCommerceOfferLatestRecord,
  upsertCommerceOfferSeedByCompositeKey,
  updateCommerceMerchant,
} from '@lego-platform/commerce/data-access-server';
import type {
  CommerceMerchant,
  CommerceMerchantInput,
} from '@lego-platform/commerce/util';

export interface AffiliateFeedMerchantConfig {
  affiliateNetwork: string;
  name: string;
  notes: string;
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
}

export interface AlternateAffiliateFeedImportResult {
  importedOfferCount: number;
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
  upsertedLatestCount: number;
  upsertedSeedCount: number;
}

export interface AlternateAffiliateFeedImportDependencies {
  createCommerceMerchantFn?: typeof createCommerceMerchant;
  getNow?: () => Date;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommerceMerchantsFn?: typeof listCommerceMerchants;
  upsertCommerceOfferLatestRecordFn?: typeof upsertCommerceOfferLatestRecord;
  upsertCommerceOfferSeedByCompositeKeyFn?: typeof upsertCommerceOfferSeedByCompositeKey;
  updateCommerceMerchantFn?: typeof updateCommerceMerchant;
}

export interface AlternateAffiliateFeedImportOptions {
  collectUnmatchedDebug?: boolean;
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

async function ensureAffiliateMerchant({
  createCommerceMerchantFn,
  listCommerceMerchantsFn,
  merchantConfig,
  updateCommerceMerchantFn,
}: {
  createCommerceMerchantFn: typeof createCommerceMerchant;
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
  const merchantInput: CommerceMerchantInput = {
    slug: merchantConfig.slug,
    name: merchantConfig.name,
    isActive: true,
    sourceType: 'affiliate',
    affiliateNetwork: merchantConfig.affiliateNetwork,
    notes: merchantConfig.notes,
  };

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
    createCommerceMerchantFn = createCommerceMerchant,
    getNow = () => new Date(),
    listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
    listCommerceMerchantsFn = listCommerceMerchants,
    upsertCommerceOfferLatestRecordFn = upsertCommerceOfferLatestRecord,
    upsertCommerceOfferSeedByCompositeKeyFn = upsertCommerceOfferSeedByCompositeKey,
    updateCommerceMerchantFn = updateCommerceMerchant,
  } = dependencies;
  const { merchant: resolvedMerchant, merchantCreated } =
    await ensureAffiliateMerchant({
      createCommerceMerchantFn,
      listCommerceMerchantsFn,
      merchantConfig: merchant,
      updateCommerceMerchantFn,
    });
  const catalogSetIdByIdentifier = buildCatalogSetIdLookup(
    await listCanonicalCatalogSetsFn(),
  );
  const observedAt = getNow().toISOString();
  const matchedCatalogSetIds = new Set<string>();
  const upsertedSeedIds = new Set<string>();
  const upsertedLatestSeedIds = new Set<string>();
  let skippedNonLegoCount = 0;
  let skippedNonNewCount = 0;
  let skippedMissingSetNumberCount = 0;
  let skippedUnmatchedSetCount = 0;
  let skippedInvalidCurrencyCount = 0;
  let skippedInvalidPriceCount = 0;
  let skippedInvalidDeeplinkCount = 0;
  const unmatchedRowsBySetId = new Map<
    string,
    AlternateAffiliateFeedUnmatchedSetSummary
  >();

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

    const offerSeed = await upsertCommerceOfferSeedByCompositeKeyFn({
      input: {
        setId: matchedCatalogSetId,
        merchantId: resolvedMerchant.id,
        productUrl: deeplinkUrl.toString(),
        isActive: true,
        validationStatus: 'valid',
        lastVerifiedAt: observedAt,
        notes: `Feed-driven ${merchant.name} import via ${merchant.affiliateNetwork}. Exact matched by LEGO set number.`,
      },
    });

    await upsertCommerceOfferLatestRecordFn({
      input: {
        offerSeedId: offerSeed.id,
        fetchStatus: 'success',
        priceMinor,
        currencyCode: 'EUR',
        availability: normalizeAvailability(row.availabilityText),
        observedAt,
        fetchedAt: observedAt,
      },
    });

    matchedCatalogSetIds.add(matchedCatalogSetId);
    upsertedSeedIds.add(offerSeed.id);
    upsertedLatestSeedIds.add(offerSeed.id);
  }

  return {
    importedOfferCount: upsertedLatestSeedIds.size,
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
    unmatchedDebug:
      options?.collectUnmatchedDebug && skippedUnmatchedSetCount > 0
        ? buildUnmatchedDebugInfo({
            sampleLimit: options.unmatchedSampleLimit,
            unmatchedRowsBySetId,
          })
        : undefined,
    upsertedLatestCount: upsertedLatestSeedIds.size,
    upsertedSeedCount: upsertedSeedIds.size,
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
