export const commerceMerchantSourceTypes = [
  'direct',
  'affiliate',
  'marketplace',
] as const;

export const commerceOfferSeedValidationStatuses = [
  'pending',
  'valid',
  'invalid',
  'stale',
] as const;

export const commerceOfferLatestFetchStatuses = [
  'pending',
  'success',
  'unavailable',
  'error',
] as const;

export type CommerceMerchantSourceType =
  (typeof commerceMerchantSourceTypes)[number];

export type CommerceOfferSeedValidationStatus =
  (typeof commerceOfferSeedValidationStatuses)[number];

export type CommerceOfferLatestFetchStatus =
  (typeof commerceOfferLatestFetchStatuses)[number];

export const DEFAULT_COMMERCE_STALE_DAYS = 14;

export interface CommerceMerchant {
  affiliateNetwork?: string;
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string;
  slug: string;
  sourceType: CommerceMerchantSourceType;
  updatedAt: string;
}

export interface CommerceMerchantInput {
  affiliateNetwork?: string;
  isActive: boolean;
  name: string;
  notes?: string;
  slug: string;
  sourceType: CommerceMerchantSourceType;
}

export interface CommerceOfferLatestRecord {
  availability?: string;
  createdAt: string;
  currencyCode?: string;
  errorMessage?: string;
  fetchedAt?: string;
  fetchStatus: CommerceOfferLatestFetchStatus;
  id: string;
  merchantId: string;
  observedAt?: string;
  offerSeedId: string;
  priceMinor?: number;
  productUrl: string;
  setId: string;
  updatedAt: string;
}

export interface CommerceOfferLatestRecordInput {
  availability?: string;
  currencyCode?: string;
  errorMessage?: string;
  fetchedAt?: string;
  fetchStatus: CommerceOfferLatestFetchStatus;
  observedAt?: string;
  offerSeedId: string;
  priceMinor?: number;
}

export interface CommerceOfferSeed {
  createdAt: string;
  id: string;
  isActive: boolean;
  lastVerifiedAt?: string;
  latestOffer?: CommerceOfferLatestRecord;
  merchant?: CommerceMerchant;
  merchantId: string;
  notes: string;
  productUrl: string;
  setId: string;
  updatedAt: string;
  validationStatus: CommerceOfferSeedValidationStatus;
}

export interface CommerceOfferSeedInput {
  isActive: boolean;
  lastVerifiedAt?: string;
  merchantId: string;
  notes?: string;
  productUrl: string;
  setId: string;
  validationStatus: CommerceOfferSeedValidationStatus;
}

export interface CommerceBenchmarkSet {
  createdAt: string;
  notes: string;
  setId: string;
  updatedAt: string;
}

export interface CommerceBenchmarkSetInput {
  notes?: string;
  setId: string;
}

export interface CommerceCoverageSetOption {
  id: string;
  name: string;
  theme: string;
}

export type CommerceBenchmarkMerchantCoverageStatus =
  | 'covered'
  | 'missing'
  | 'pending'
  | 'review';

export interface CommerceBenchmarkMerchantCoverage {
  merchantId: string;
  merchantName: string;
  offerSeed?: CommerceOfferSeed;
  status: CommerceBenchmarkMerchantCoverageStatus;
}

export interface CommerceBenchmarkCoverageRow {
  activeMerchantTargetCount: number;
  activeSeedCount: number;
  latestValidMerchantCount: number;
  merchantCoverage: CommerceBenchmarkMerchantCoverage[];
  missingMerchantNames: string[];
  notes: string;
  pendingMerchantNames: string[];
  reviewMerchantNames: string[];
  setId: string;
  setName: string;
  theme: string;
}

export interface CommerceCoverageSnapshot {
  activeMerchantCount: number;
  activeSeedCount: number;
  brokenSeeds: CommerceOfferSeed[];
  catalogSetCount: number;
  inactiveSeedCount: number;
  merchantsWithoutActiveSeeds: CommerceMerchant[];
  seededSetCount: number;
  staleSeeds: CommerceOfferSeed[];
  uncoveredSets: CommerceCoverageSetOption[];
}

export const commerceMerchantSearchableSlugs = [
  'amazon-nl',
  'bol',
  'intertoys',
  'lego-nl',
  'top1toys',
] as const;

export type CommerceMerchantSearchableSlug =
  (typeof commerceMerchantSearchableSlugs)[number];

function assertObjectRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must include a ${key}.`);
  }

  return value.trim();
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string when provided.`);
  }

  return value.trim() || undefined;
}

function readRequiredBoolean(
  record: Record<string, unknown>,
  key: string,
  label: string,
): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new Error(`${label} must include a boolean ${key}.`);
  }

  return value;
}

function readOptionalTimestamp(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string | undefined {
  const value = readOptionalString(record, key);

  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`${label} has an invalid ${key} timestamp.`);
  }

  return timestamp.toISOString();
}

function assertAllowedValue<TValue extends string>(
  value: string,
  allowedValues: readonly TValue[],
  label: string,
): TValue {
  if (!allowedValues.includes(value as TValue)) {
    throw new Error(`${label} must use one of: ${allowedValues.join(', ')}.`);
  }

  return value as TValue;
}

export function normalizeCommerceSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCommerceSearchQueryPart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isCommerceMerchantSearchableSlug(
  value: string,
): value is CommerceMerchantSearchableSlug {
  return commerceMerchantSearchableSlugs.includes(
    value as CommerceMerchantSearchableSlug,
  );
}

export function buildCommerceMerchantSearchQuery({
  setId,
}: {
  setId: string;
}): string {
  return normalizeCommerceSearchQueryPart(setId);
}

export function buildCommerceMerchantSearchUrl({
  merchantSlug,
  query,
}: {
  merchantSlug: string;
  query: string;
}): string | undefined {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return undefined;
  }

  if (!isCommerceMerchantSearchableSlug(merchantSlug)) {
    return undefined;
  }

  const encodedQuery = encodeURIComponent(normalizedQuery);

  switch (merchantSlug) {
    case 'top1toys':
      return `https://www.top1toys.nl/catalogsearch/result/?q=${encodedQuery}`;
    case 'intertoys':
      return `https://www.intertoys.nl/search?searchTerm=${encodedQuery}`;
    case 'bol':
      return `https://www.bol.com/nl/nl/s/?searchtext=${encodedQuery}`;
    case 'amazon-nl':
      return `https://www.amazon.nl/s?k=${encodedQuery}`;
    case 'lego-nl':
      return `https://www.lego.com/nl-nl/search?q=${encodedQuery}`;
    default:
      return undefined;
  }
}

export function validateCommerceMerchantInput(
  value: unknown,
): CommerceMerchantInput {
  const record = assertObjectRecord(value, 'Commerce merchant input');
  const slug = normalizeCommerceSlug(
    readRequiredString(record, 'slug', 'Commerce merchant input'),
  );

  if (!slug) {
    throw new Error('Commerce merchant input must include a valid slug.');
  }

  return {
    slug,
    name: readRequiredString(record, 'name', 'Commerce merchant input'),
    isActive: readRequiredBoolean(
      record,
      'isActive',
      'Commerce merchant input',
    ),
    sourceType: assertAllowedValue(
      readRequiredString(record, 'sourceType', 'Commerce merchant input'),
      commerceMerchantSourceTypes,
      'Commerce merchant input sourceType',
    ),
    affiliateNetwork: readOptionalString(record, 'affiliateNetwork'),
    notes: readOptionalString(record, 'notes') ?? '',
  };
}

export function validateCommerceOfferSeedInput(
  value: unknown,
): CommerceOfferSeedInput {
  const record = assertObjectRecord(value, 'Commerce offer seed input');
  const setId = readRequiredString(
    record,
    'setId',
    'Commerce offer seed input',
  );
  const merchantId = readRequiredString(
    record,
    'merchantId',
    'Commerce offer seed input',
  );
  const productUrl = readRequiredString(
    record,
    'productUrl',
    'Commerce offer seed input',
  );

  try {
    new URL(productUrl);
  } catch {
    throw new Error(
      'Commerce offer seed input must include a valid productUrl.',
    );
  }

  return {
    setId,
    merchantId,
    productUrl,
    isActive: readRequiredBoolean(
      record,
      'isActive',
      'Commerce offer seed input',
    ),
    validationStatus: assertAllowedValue(
      readRequiredString(
        record,
        'validationStatus',
        'Commerce offer seed input',
      ),
      commerceOfferSeedValidationStatuses,
      'Commerce offer seed input validationStatus',
    ),
    lastVerifiedAt: readOptionalTimestamp(
      record,
      'lastVerifiedAt',
      'Commerce offer seed input',
    ),
    notes: readOptionalString(record, 'notes') ?? '',
  };
}

export function validateCommerceBenchmarkSetInput(
  value: unknown,
): CommerceBenchmarkSetInput {
  const record = assertObjectRecord(value, 'Commerce benchmark set input');

  return {
    setId: readRequiredString(record, 'setId', 'Commerce benchmark set input'),
    notes: readOptionalString(record, 'notes') ?? '',
  };
}

function isOlderThanDays({
  now,
  staleAfterDays,
  value,
}: {
  now: Date;
  staleAfterDays: number;
  value?: string;
}): boolean {
  if (!value) {
    return false;
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return false;
  }

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - staleAfterDays);

  return parsedValue.getTime() < cutoff.getTime();
}

export function buildCommerceCoverageSnapshot({
  catalogSets,
  merchants,
  now = new Date(),
  offerSeeds,
  staleAfterDays = DEFAULT_COMMERCE_STALE_DAYS,
}: {
  catalogSets: readonly CommerceCoverageSetOption[];
  merchants: readonly CommerceMerchant[];
  now?: Date;
  offerSeeds: readonly CommerceOfferSeed[];
  staleAfterDays?: number;
}): CommerceCoverageSnapshot {
  const activeMerchants = merchants
    .filter((merchant) => merchant.isActive)
    .sort((left, right) => left.name.localeCompare(right.name));
  const activeOfferSeeds = offerSeeds.filter((offerSeed) => offerSeed.isActive);
  const coveredSetIds = new Set(
    activeOfferSeeds.map((offerSeed) => offerSeed.setId),
  );
  const uncoveredSets = [...catalogSets]
    .filter((catalogSet) => !coveredSetIds.has(catalogSet.id))
    .sort(
      (left, right) =>
        left.theme.localeCompare(right.theme) ||
        left.name.localeCompare(right.name),
    );
  const merchantsWithoutActiveSeeds = activeMerchants.filter(
    (merchant) =>
      !activeOfferSeeds.some(
        (offerSeed) => offerSeed.merchantId === merchant.id,
      ),
  );
  const brokenSeeds = activeOfferSeeds
    .filter(
      (offerSeed) =>
        offerSeed.validationStatus === 'invalid' ||
        offerSeed.latestOffer?.fetchStatus === 'error' ||
        offerSeed.latestOffer?.fetchStatus === 'unavailable',
    )
    .sort((left, right) => left.setId.localeCompare(right.setId));
  const staleSeeds = activeOfferSeeds
    .filter(
      (offerSeed) =>
        !brokenSeeds.some((brokenSeed) => brokenSeed.id === offerSeed.id) &&
        (offerSeed.validationStatus === 'stale' ||
          isOlderThanDays({
            now,
            staleAfterDays,
            value: offerSeed.lastVerifiedAt,
          }) ||
          isOlderThanDays({
            now,
            staleAfterDays,
            value: offerSeed.latestOffer?.fetchedAt,
          })),
    )
    .sort((left, right) => left.setId.localeCompare(right.setId));

  return {
    catalogSetCount: catalogSets.length,
    activeMerchantCount: activeMerchants.length,
    activeSeedCount: activeOfferSeeds.length,
    inactiveSeedCount: offerSeeds.length - activeOfferSeeds.length,
    seededSetCount: coveredSetIds.size,
    uncoveredSets,
    merchantsWithoutActiveSeeds,
    brokenSeeds,
    staleSeeds,
  };
}

function isOfferSeedReviewState(offerSeed: CommerceOfferSeed): boolean {
  return (
    offerSeed.validationStatus === 'invalid' ||
    offerSeed.validationStatus === 'stale' ||
    offerSeed.latestOffer?.fetchStatus === 'error' ||
    offerSeed.latestOffer?.fetchStatus === 'unavailable'
  );
}

function isOfferSeedCoveredState(offerSeed: CommerceOfferSeed): boolean {
  return (
    offerSeed.validationStatus === 'valid' &&
    offerSeed.latestOffer?.fetchStatus === 'success'
  );
}

export function buildCommerceBenchmarkCoverageRows({
  benchmarkSets,
  catalogSets,
  merchants,
  offerSeeds,
}: {
  benchmarkSets: readonly CommerceBenchmarkSet[];
  catalogSets: readonly CommerceCoverageSetOption[];
  merchants: readonly CommerceMerchant[];
  offerSeeds: readonly CommerceOfferSeed[];
}): CommerceBenchmarkCoverageRow[] {
  const activeMerchants = merchants
    .filter((merchant) => merchant.isActive)
    .sort((left, right) => left.name.localeCompare(right.name));
  const activeOfferSeeds = offerSeeds.filter(
    (offerSeed) => offerSeed.isActive && offerSeed.merchant?.isActive === true,
  );
  const catalogSetById = new Map(
    catalogSets.map((catalogSet) => [catalogSet.id, catalogSet] as const),
  );

  return [...benchmarkSets]
    .map((benchmarkSet) => {
      const catalogSet = catalogSetById.get(benchmarkSet.setId);
      const merchantCoverage = activeMerchants.map((merchant) => {
        const matchingSeed = activeOfferSeeds.find(
          (offerSeed) =>
            offerSeed.setId === benchmarkSet.setId &&
            offerSeed.merchantId === merchant.id,
        );

        if (!matchingSeed) {
          return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            status: 'missing',
          } satisfies CommerceBenchmarkMerchantCoverage;
        }

        if (isOfferSeedReviewState(matchingSeed)) {
          return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            offerSeed: matchingSeed,
            status: 'review',
          } satisfies CommerceBenchmarkMerchantCoverage;
        }

        if (isOfferSeedCoveredState(matchingSeed)) {
          return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            offerSeed: matchingSeed,
            status: 'covered',
          } satisfies CommerceBenchmarkMerchantCoverage;
        }

        return {
          merchantId: merchant.id,
          merchantName: merchant.name,
          offerSeed: matchingSeed,
          status: 'pending',
        } satisfies CommerceBenchmarkMerchantCoverage;
      });

      return {
        setId: benchmarkSet.setId,
        setName: catalogSet?.name ?? benchmarkSet.setId,
        theme: catalogSet?.theme ?? 'Unknown',
        notes: benchmarkSet.notes,
        activeMerchantTargetCount: activeMerchants.length,
        activeSeedCount: merchantCoverage.filter(
          (merchantStatus) => merchantStatus.status !== 'missing',
        ).length,
        latestValidMerchantCount: merchantCoverage.filter(
          (merchantStatus) => merchantStatus.status === 'covered',
        ).length,
        missingMerchantNames: merchantCoverage
          .filter((merchantStatus) => merchantStatus.status === 'missing')
          .map((merchantStatus) => merchantStatus.merchantName),
        pendingMerchantNames: merchantCoverage
          .filter((merchantStatus) => merchantStatus.status === 'pending')
          .map((merchantStatus) => merchantStatus.merchantName),
        reviewMerchantNames: merchantCoverage
          .filter((merchantStatus) => merchantStatus.status === 'review')
          .map((merchantStatus) => merchantStatus.merchantName),
        merchantCoverage,
      } satisfies CommerceBenchmarkCoverageRow;
    })
    .sort(
      (left, right) =>
        left.theme.localeCompare(right.theme) ||
        left.setName.localeCompare(right.setName),
    );
}
