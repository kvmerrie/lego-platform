export const commerceMerchantSourceTypes = [
  'direct',
  'affiliate',
  'marketplace',
] as const;

export const commerceMerchantSupportTiers = [
  'primary',
  'secondary',
  'blocked',
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

export type CommerceMerchantSupportTier =
  (typeof commerceMerchantSupportTiers)[number];

export type CommerceOfferSeedValidationStatus =
  (typeof commerceOfferSeedValidationStatuses)[number];

export type CommerceOfferLatestFetchStatus =
  (typeof commerceOfferLatestFetchStatuses)[number];

export const DEFAULT_COMMERCE_STALE_DAYS = 14;

export interface CommerceMerchantSupportProfile {
  defaultSeedGeneration: boolean;
  defaultRefresh: boolean;
  operatorLabel: string;
  tier: CommerceMerchantSupportTier;
}

const commerceMerchantSupportProfiles = {
  'lego-nl': {
    tier: 'primary',
    defaultSeedGeneration: true,
    defaultRefresh: true,
    operatorLabel: 'Primary',
  },
  intertoys: {
    tier: 'primary',
    defaultSeedGeneration: true,
    defaultRefresh: true,
    operatorLabel: 'Primary',
  },
  bol: {
    tier: 'primary',
    defaultSeedGeneration: true,
    defaultRefresh: true,
    operatorLabel: 'Primary',
  },
  misterbricks: {
    tier: 'primary',
    defaultSeedGeneration: true,
    defaultRefresh: true,
    operatorLabel: 'Primary',
  },
  kruidvat: {
    tier: 'secondary',
    defaultSeedGeneration: false,
    defaultRefresh: false,
    operatorLabel: 'Secondary',
  },
  wehkamp: {
    tier: 'secondary',
    defaultSeedGeneration: false,
    defaultRefresh: false,
    operatorLabel: 'Secondary',
  },
  top1toys: {
    tier: 'secondary',
    defaultSeedGeneration: false,
    defaultRefresh: true,
    operatorLabel: 'Secondary',
  },
  'smyths-toys': {
    tier: 'secondary',
    defaultSeedGeneration: false,
    defaultRefresh: true,
    operatorLabel: 'Secondary',
  },
  'amazon-nl': {
    tier: 'blocked',
    defaultSeedGeneration: false,
    defaultRefresh: false,
    operatorLabel: 'Blocked',
  },
  proshop: {
    tier: 'blocked',
    defaultSeedGeneration: false,
    defaultRefresh: false,
    operatorLabel: 'Blocked',
  },
} as const satisfies Record<string, CommerceMerchantSupportProfile>;

const defaultCommerceMerchantSupportProfile: CommerceMerchantSupportProfile = {
  tier: 'secondary',
  defaultSeedGeneration: false,
  defaultRefresh: false,
  operatorLabel: 'Secondary',
};

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

export const commercePrimaryCoverageStatuses = [
  'no_primary_seeds',
  'no_valid_primary_offers',
  'partial_primary_coverage',
  'full_primary_coverage',
] as const;

export const commerceCoverageEligibilityStatuses = [
  'active',
  'retired',
  'deprioritized',
] as const;

export const commerceGapRecoveryPriorities = [
  'recover_now',
  'verify_first',
  'parked',
] as const;

export type CommercePrimaryCoverageStatus =
  (typeof commercePrimaryCoverageStatuses)[number];

export type CommerceCoverageEligibilityStatus =
  (typeof commerceCoverageEligibilityStatuses)[number];

export type CommerceGapRecoveryPriority =
  (typeof commerceGapRecoveryPriorities)[number];

export type CommerceGapRecoveryType =
  | 'missing_seed'
  | 'seed_pending'
  | 'seed_invalid'
  | 'seed_stale'
  | 'no_latest_refresh'
  | 'refresh_pending'
  | 'refresh_unavailable'
  | 'refresh_error';

export interface CommerceCoverageEligibilityProfile {
  operatorLabel: string;
  status: CommerceCoverageEligibilityStatus;
}

export interface CommerceGapRecoveryProfile {
  priority: CommerceGapRecoveryPriority;
  reason: string;
}

export interface CommercePrimaryCoverageRow {
  missingPrimarySeedMerchantNames: string[];
  missingPrimarySeedMerchantSlugs: string[];
  missingValidPrimaryOfferMerchantNames: string[];
  missingValidPrimaryOfferMerchantSlugs: string[];
  primaryMerchantTargetCount: number;
  primarySeedCount: number;
  setId: string;
  setName: string;
  status: CommercePrimaryCoverageStatus;
  theme: string;
  validPrimaryOfferCount: number;
}

export interface CommercePrimaryCoverageSummary {
  fullPrimaryCoverageCount: number;
  noPrimarySeedsCount: number;
  noValidPrimaryOffersCount: number;
  partialPrimaryCoverageCount: number;
  primaryMerchantSlugs: readonly string[];
  rows: CommercePrimaryCoverageRow[];
  totalSetCount: number;
}

const commerceCoverageEligibilityProfiles = {
  '70728': {
    status: 'retired',
    operatorLabel: 'Retired',
  },
} as const satisfies Record<string, CommerceCoverageEligibilityProfile>;

const defaultCommerceCoverageEligibilityProfile: CommerceCoverageEligibilityProfile =
  {
    status: 'active',
    operatorLabel: 'Active',
  };

export type CommerceCoverageQueueSetSource = 'overlay' | 'snapshot';

export type CommerceCoverageQueueMerchantState =
  | 'missing'
  | 'not_available_confirmed'
  | 'pending'
  | 'review'
  | 'stale'
  | 'unavailable'
  | 'valid';

export type CommerceCoverageQueueNextAction =
  | 'add_seed_manually'
  | 'edit_seed'
  | 'no_action_needed'
  | 'recheck_later';

export type CommerceCoverageQueueHealthFilter =
  | 'all'
  | 'fully_covered'
  | 'needs_review'
  | 'stale'
  | 'under_covered'
  | 'zero_valid';

export type CommerceCoverageQueuePriorityFilter = 'all' | 'benchmark_only';

export type CommerceCoverageQueueSourceFilter =
  | 'all'
  | CommerceCoverageQueueSetSource;

export interface CommerceCoverageQueueSetOption
  extends CommerceCoverageSetOption {
  createdAt?: string;
  slug: string;
  source: CommerceCoverageQueueSetSource;
}

export interface CommerceCoverageQueueMerchantStatus {
  lastCheckedAt?: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  offerSeed?: CommerceOfferSeed;
  state: CommerceCoverageQueueMerchantState;
}

export interface CommerceCoverageQueueRow {
  activeSeedCount: number;
  isBenchmark: boolean;
  latestCheckedAt?: string;
  merchantStatuses: CommerceCoverageQueueMerchantStatus[];
  merchantsCheckedCount: number;
  missingMerchantIds: string[];
  missingMerchantNames: string[];
  missingMerchantSlugs: string[];
  needsReviewCount: number;
  notAvailableConfirmedMerchantCount: number;
  notAvailableConfirmedMerchantNames: string[];
  recommendedMerchantId?: string;
  recommendedMerchantName?: string;
  recommendedNextAction: CommerceCoverageQueueNextAction;
  setId: string;
  setName: string;
  source: CommerceCoverageQueueSetSource;
  sourceCreatedAt?: string;
  staleMerchantCount: number;
  statusSummary: string;
  theme: string;
  unavailableMerchantCount: number;
  validMerchantCount: number;
}

export interface CommerceSetRefreshResult {
  invalidCount: number;
  setId: string;
  staleCount: number;
  successCount: number;
  totalCount: number;
  unavailableCount: number;
}

export interface CommerceCoverageQueueFilters {
  healthFilter?: CommerceCoverageQueueHealthFilter;
  merchantGapMerchantId?: string;
  minimumValidMerchantCount?: number;
  priorityFilter?: CommerceCoverageQueuePriorityFilter;
  search?: string;
  sourceFilter?: CommerceCoverageQueueSourceFilter;
}

export const commerceMerchantSearchableSlugs = [
  'amazon-nl',
  'bol',
  'intertoys',
  'kruidvat',
  'misterbricks',
  'lego-nl',
  'proshop',
  'smyths-toys',
  'top1toys',
  'wehkamp',
] as const;

export type CommerceMerchantSearchableSlug =
  (typeof commerceMerchantSearchableSlugs)[number];

export function getCommerceMerchantSupportProfile(
  merchantSlug: string,
): CommerceMerchantSupportProfile {
  const normalizedMerchantSlug = normalizeCommerceSlug(merchantSlug);

  return (
    commerceMerchantSupportProfiles[
      normalizedMerchantSlug as keyof typeof commerceMerchantSupportProfiles
    ] ?? defaultCommerceMerchantSupportProfile
  );
}

export function getCommerceMerchantSupportTier(
  merchantSlug: string,
): CommerceMerchantSupportTier {
  return getCommerceMerchantSupportProfile(merchantSlug).tier;
}

export function getCommerceMerchantSupportTierLabel(merchantSlug: string) {
  return getCommerceMerchantSupportProfile(merchantSlug).operatorLabel;
}

function getCommerceMerchantSupportTierPriority(merchantSlug: string): number {
  switch (getCommerceMerchantSupportTier(merchantSlug)) {
    case 'primary':
      return 0;
    case 'secondary':
      return 1;
    case 'blocked':
    default:
      return 2;
  }
}

export function compareCommerceMerchantsByOperationalPriority(
  left: Pick<CommerceMerchant, 'name' | 'slug'>,
  right: Pick<CommerceMerchant, 'name' | 'slug'>,
): number {
  return (
    getCommerceMerchantSupportTierPriority(left.slug) -
      getCommerceMerchantSupportTierPriority(right.slug) ||
    left.name.localeCompare(right.name) ||
    left.slug.localeCompare(right.slug)
  );
}

export function includeCommerceMerchantInDefaultSeedGeneration(
  merchantSlug: string,
): boolean {
  return getCommerceMerchantSupportProfile(merchantSlug).defaultSeedGeneration;
}

export function includeCommerceMerchantInDefaultRefresh(
  merchantSlug: string,
): boolean {
  return getCommerceMerchantSupportProfile(merchantSlug).defaultRefresh;
}

export function getCommerceCoverageEligibilityProfile(
  setId: string,
): CommerceCoverageEligibilityProfile {
  return (
    commerceCoverageEligibilityProfiles[
      setId.trim() as keyof typeof commerceCoverageEligibilityProfiles
    ] ?? defaultCommerceCoverageEligibilityProfile
  );
}

export function getCommerceCoverageEligibilityStatus(
  setId: string,
): CommerceCoverageEligibilityStatus {
  return getCommerceCoverageEligibilityProfile(setId).status;
}

export function includeCatalogSetInDefaultCommerceCoverage(
  setId: string,
): boolean {
  return getCommerceCoverageEligibilityStatus(setId) === 'active';
}

export function getCommerceGapRecoveryProfile({
  gapType,
  merchantSlug,
}: {
  gapType: CommerceGapRecoveryType;
  merchantSlug: string;
}): CommerceGapRecoveryProfile {
  const normalizedMerchantSlug = normalizeCommerceSlug(merchantSlug);

  if (gapType === 'missing_seed') {
    return {
      priority: 'recover_now',
      reason:
        'Er ontbreekt nog helemaal een seed, dus dit is de schoonste en goedkoopste recovery-stap.',
    };
  }

  if (
    normalizedMerchantSlug === 'lego-nl' &&
    gapType === 'refresh_unavailable'
  ) {
    return {
      priority: 'parked',
      reason:
        'LEGO.nl refresh_unavailable bleek in de huidige runs meestal echte niet-op-voorraad-status, niet een snelle recovery.',
    };
  }

  if (normalizedMerchantSlug === 'intertoys' && gapType === 'seed_invalid') {
    return {
      priority: 'parked',
      reason:
        'Intertoys seed_invalid wijst nu meestal op generieke of verkeerde zoekresultaten, niet op een snelle lokale fix.',
    };
  }

  if (
    normalizedMerchantSlug === 'misterbricks' &&
    (gapType === 'seed_invalid' || gapType === 'seed_stale')
  ) {
    return {
      priority: 'parked',
      reason:
        'MisterBricks seed-invalidaties en stale-cases wijzen nu vooral op upstream no-results of verkeerde producthits.',
    };
  }

  if (
    gapType === 'refresh_unavailable' ||
    gapType === 'seed_stale' ||
    gapType === 'seed_invalid'
  ) {
    return {
      priority: 'verify_first',
      reason:
        'Dit kan nog recoverable zijn, maar vraagt eerst een gerichte inspectie voordat write of sync zinvol is.',
    };
  }

  return {
    priority: 'verify_first',
    reason:
      'Deze gap vraagt eerst een kleine verificatiestap; de huidige heuristiek ziet hem niet als directe cheap win of expliciet parked.',
  };
}

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

export function isCommerceMerchantSearchableSlug(
  value: string,
): value is CommerceMerchantSearchableSlug {
  return commerceMerchantSearchableSlugs.includes(
    value as CommerceMerchantSearchableSlug,
  );
}

export function supportsCommerceMerchantSearch(merchantSlug: string): boolean {
  return isCommerceMerchantSearchableSlug(merchantSlug);
}

export function supportsCommerceMerchantManualSeed(
  merchantSlug: string,
): boolean {
  return normalizeCommerceSlug(merchantSlug).length > 0;
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
    case 'kruidvat':
      return `https://www.kruidvat.nl/search?q=${encodedQuery}`;
    case 'wehkamp':
      return `https://www.wehkamp.nl/zoeken/?term=${encodedQuery}&type=manual`;
    case 'misterbricks':
      return `https://misterbricks.nl/catalogsearch/result/?q=${encodedQuery}`;
    case 'lego-nl':
      return `https://www.lego.com/nl-nl/search?q=${encodedQuery}`;
    case 'proshop':
      return `https://www.proshop.nl/?s=${encodedQuery}`;
    case 'smyths-toys':
      return `https://www.smythstoys.com/nl/nl-nl/search?text=${encodedQuery}`;
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
    .sort(compareCommerceMerchantsByOperationalPriority);
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

function compareCommercePrimaryCoverageRows(
  left: CommercePrimaryCoverageRow,
  right: CommercePrimaryCoverageRow,
): number {
  const getStatusPriority = (status: CommercePrimaryCoverageStatus) => {
    switch (status) {
      case 'no_primary_seeds':
        return 0;
      case 'no_valid_primary_offers':
        return 1;
      case 'partial_primary_coverage':
        return 2;
      case 'full_primary_coverage':
      default:
        return 3;
    }
  };

  return (
    getStatusPriority(left.status) - getStatusPriority(right.status) ||
    left.theme.localeCompare(right.theme) ||
    left.setName.localeCompare(right.setName) ||
    left.setId.localeCompare(right.setId)
  );
}

function buildCommercePrimaryCoverageStatus({
  primaryMerchantTargetCount,
  primarySeedCount,
  validPrimaryOfferCount,
}: {
  primaryMerchantTargetCount: number;
  primarySeedCount: number;
  validPrimaryOfferCount: number;
}): CommercePrimaryCoverageStatus {
  if (primarySeedCount === 0) {
    return 'no_primary_seeds';
  }

  if (validPrimaryOfferCount === 0) {
    return 'no_valid_primary_offers';
  }

  if (validPrimaryOfferCount < primaryMerchantTargetCount) {
    return 'partial_primary_coverage';
  }

  return 'full_primary_coverage';
}

export function buildCommercePrimaryCoverageRows({
  catalogSets,
  merchants,
  offerSeeds,
}: {
  catalogSets: readonly CommerceCoverageSetOption[];
  merchants: readonly CommerceMerchant[];
  offerSeeds: readonly CommerceOfferSeed[];
}): CommercePrimaryCoverageRow[] {
  const activePrimaryMerchants = merchants
    .filter(
      (merchant) =>
        merchant.isActive &&
        getCommerceMerchantSupportTier(merchant.slug) === 'primary',
    )
    .sort(compareCommerceMerchantsByOperationalPriority);
  const primaryMerchantIdSet = new Set(
    activePrimaryMerchants.map((merchant) => merchant.id),
  );

  return [...catalogSets]
    .map((catalogSet) => {
      const setPrimarySeeds = offerSeeds.filter(
        (offerSeed) =>
          offerSeed.setId === catalogSet.id &&
          primaryMerchantIdSet.has(offerSeed.merchantId),
      );
      const primarySeedMerchantIds = new Set(
        setPrimarySeeds.map((offerSeed) => offerSeed.merchantId),
      );
      const validPrimaryOfferMerchantIds = new Set(
        setPrimarySeeds
          .filter((offerSeed) => isOfferSeedCoveredState(offerSeed))
          .map((offerSeed) => offerSeed.merchantId),
      );
      const missingPrimarySeedMerchants = activePrimaryMerchants.filter(
        (merchant) => !primarySeedMerchantIds.has(merchant.id),
      );
      const missingValidPrimaryOfferMerchants = activePrimaryMerchants.filter(
        (merchant) => !validPrimaryOfferMerchantIds.has(merchant.id),
      );

      return {
        setId: catalogSet.id,
        setName: catalogSet.name,
        theme: catalogSet.theme,
        primaryMerchantTargetCount: activePrimaryMerchants.length,
        primarySeedCount: primarySeedMerchantIds.size,
        validPrimaryOfferCount: validPrimaryOfferMerchantIds.size,
        missingPrimarySeedMerchantNames: missingPrimarySeedMerchants.map(
          (merchant) => merchant.name,
        ),
        missingPrimarySeedMerchantSlugs: missingPrimarySeedMerchants.map(
          (merchant) => merchant.slug,
        ),
        missingValidPrimaryOfferMerchantNames:
          missingValidPrimaryOfferMerchants.map((merchant) => merchant.name),
        missingValidPrimaryOfferMerchantSlugs:
          missingValidPrimaryOfferMerchants.map((merchant) => merchant.slug),
        status: buildCommercePrimaryCoverageStatus({
          primaryMerchantTargetCount: activePrimaryMerchants.length,
          primarySeedCount: primarySeedMerchantIds.size,
          validPrimaryOfferCount: validPrimaryOfferMerchantIds.size,
        }),
      } satisfies CommercePrimaryCoverageRow;
    })
    .sort(compareCommercePrimaryCoverageRows);
}

export function buildCommercePrimaryCoverageSummary({
  catalogSets,
  merchants,
  offerSeeds,
}: {
  catalogSets: readonly CommerceCoverageSetOption[];
  merchants: readonly CommerceMerchant[];
  offerSeeds: readonly CommerceOfferSeed[];
}): CommercePrimaryCoverageSummary {
  const activePrimaryMerchantSlugs = merchants
    .filter(
      (merchant) =>
        merchant.isActive &&
        getCommerceMerchantSupportTier(merchant.slug) === 'primary',
    )
    .sort(compareCommerceMerchantsByOperationalPriority)
    .map((merchant) => merchant.slug);
  const rows = buildCommercePrimaryCoverageRows({
    catalogSets,
    merchants,
    offerSeeds,
  });

  return {
    rows,
    totalSetCount: rows.length,
    primaryMerchantSlugs: activePrimaryMerchantSlugs,
    noPrimarySeedsCount: rows.filter((row) => row.status === 'no_primary_seeds')
      .length,
    noValidPrimaryOffersCount: rows.filter(
      (row) => row.status === 'no_valid_primary_offers',
    ).length,
    partialPrimaryCoverageCount: rows.filter(
      (row) => row.status === 'partial_primary_coverage',
    ).length,
    fullPrimaryCoverageCount: rows.filter(
      (row) => row.status === 'full_primary_coverage',
    ).length,
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

const COMMERCE_COVERAGE_UNAVAILABLE_RECHECK_DAYS = 14;

function getTimestampMs(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = new Date(value);

  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue.getTime();
}

function getLatestTimestamp(
  values: readonly (string | undefined)[],
): string | undefined {
  let latestValue: string | undefined;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const timestamp = getTimestampMs(value);

    if (timestamp === null || timestamp <= latestTimestamp) {
      continue;
    }

    latestTimestamp = timestamp;
    latestValue = value;
  }

  return latestValue;
}

function isWithinLastDays({
  now,
  days,
  value,
}: {
  now: Date;
  days: number;
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
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  return parsedValue.getTime() >= cutoff.getTime();
}

function getCoverageQueueMerchantStatePriority(
  state: CommerceCoverageQueueMerchantState,
): number {
  switch (state) {
    case 'valid':
      return 0;
    case 'review':
      return 1;
    case 'stale':
      return 2;
    case 'unavailable':
      return 3;
    case 'pending':
      return 4;
    case 'not_available_confirmed':
      return 5;
    case 'missing':
    default:
      return 6;
  }
}

function getOfferSeedCoverageQueueState({
  now,
  offerSeed,
  staleAfterDays,
}: {
  now: Date;
  offerSeed: CommerceOfferSeed;
  staleAfterDays: number;
}): Exclude<CommerceCoverageQueueMerchantState, 'missing'> {
  if (
    offerSeed.validationStatus === 'invalid' ||
    offerSeed.latestOffer?.fetchStatus === 'error'
  ) {
    return 'review';
  }

  if (offerSeed.latestOffer?.fetchStatus === 'unavailable') {
    return 'unavailable';
  }

  if (
    offerSeed.validationStatus === 'stale' ||
    isOlderThanDays({
      now,
      staleAfterDays,
      value: offerSeed.lastVerifiedAt,
    }) ||
    isOlderThanDays({
      now,
      staleAfterDays,
      value: offerSeed.latestOffer?.fetchedAt,
    })
  ) {
    return 'stale';
  }

  if (isOfferSeedCoveredState(offerSeed)) {
    return 'valid';
  }

  return 'pending';
}

function buildCoverageQueueStatusSummary({
  activeSeedCount,
  actionableMissingCount,
  merchantsCheckedCount,
  minimumValidMerchantCount,
  needsReviewCount,
  notAvailableConfirmedMerchantCount,
  staleMerchantCount,
  unavailableMerchantCount,
  validMerchantCount,
}: {
  activeSeedCount: number;
  actionableMissingCount: number;
  merchantsCheckedCount: number;
  minimumValidMerchantCount: number;
  needsReviewCount: number;
  notAvailableConfirmedMerchantCount: number;
  staleMerchantCount: number;
  unavailableMerchantCount: number;
  validMerchantCount: number;
}): string {
  if (needsReviewCount > 0) {
    return 'Review nodig';
  }

  if (
    validMerchantCount === 0 &&
    activeSeedCount === 0 &&
    merchantsCheckedCount === 0
  ) {
    return 'Seed nodig';
  }

  if (
    validMerchantCount < minimumValidMerchantCount &&
    actionableMissingCount === 0 &&
    notAvailableConfirmedMerchantCount > 0 &&
    staleMerchantCount === 0
  ) {
    return 'Later opnieuw checken';
  }

  if (validMerchantCount === 0) {
    return '0 geldige merchants';
  }

  if (staleMerchantCount > 0) {
    return 'Stale offers aanwezig';
  }

  if (
    unavailableMerchantCount > 0 &&
    validMerchantCount < minimumValidMerchantCount
  ) {
    return 'Te weinig bruikbare offers';
  }

  if (validMerchantCount < minimumValidMerchantCount) {
    return `${validMerchantCount} geldige merchant${
      validMerchantCount === 1 ? '' : 's'
    }`;
  }

  return 'Goed gedekt';
}

function isCoverageQueueActionable(row: CommerceCoverageQueueRow): boolean {
  return (
    row.recommendedNextAction !== 'no_action_needed' &&
    row.recommendedNextAction !== 'recheck_later'
  );
}

function compareCoverageQueueRows(
  left: CommerceCoverageQueueRow,
  right: CommerceCoverageQueueRow,
  minimumValidMerchantCount: number,
): number {
  if (left.isBenchmark !== right.isBenchmark) {
    return left.isBenchmark ? -1 : 1;
  }

  const leftIsActionable = isCoverageQueueActionable(left);
  const rightIsActionable = isCoverageQueueActionable(right);

  if (leftIsActionable !== rightIsActionable) {
    return leftIsActionable ? -1 : 1;
  }

  const leftHasZeroValid = left.validMerchantCount === 0;
  const rightHasZeroValid = right.validMerchantCount === 0;

  if (leftHasZeroValid !== rightHasZeroValid) {
    return leftHasZeroValid ? -1 : 1;
  }

  const leftIsUnderCovered =
    left.validMerchantCount < minimumValidMerchantCount;
  const rightIsUnderCovered =
    right.validMerchantCount < minimumValidMerchantCount;

  if (leftIsUnderCovered !== rightIsUnderCovered) {
    return leftIsUnderCovered ? -1 : 1;
  }

  if (left.source !== right.source) {
    return left.source === 'overlay' ? -1 : 1;
  }

  if (left.source === 'overlay' && right.source === 'overlay') {
    const leftSourceCreatedAt = getTimestampMs(left.sourceCreatedAt) ?? 0;
    const rightSourceCreatedAt = getTimestampMs(right.sourceCreatedAt) ?? 0;

    if (leftSourceCreatedAt !== rightSourceCreatedAt) {
      return rightSourceCreatedAt - leftSourceCreatedAt;
    }
  }

  if (left.needsReviewCount !== right.needsReviewCount) {
    return right.needsReviewCount - left.needsReviewCount;
  }

  if (left.staleMerchantCount !== right.staleMerchantCount) {
    return right.staleMerchantCount - left.staleMerchantCount;
  }

  if (left.unavailableMerchantCount !== right.unavailableMerchantCount) {
    return right.unavailableMerchantCount - left.unavailableMerchantCount;
  }

  return (
    left.theme.localeCompare(right.theme) ||
    left.setName.localeCompare(right.setName) ||
    left.setId.localeCompare(right.setId)
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
    .sort(compareCommerceMerchantsByOperationalPriority);
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

export function buildCommerceCoverageQueueRows({
  benchmarkSets,
  catalogSets,
  merchants,
  now = new Date(),
  offerSeeds,
  staleAfterDays = DEFAULT_COMMERCE_STALE_DAYS,
  minimumValidMerchantCount = 3,
}: {
  benchmarkSets: readonly CommerceBenchmarkSet[];
  catalogSets: readonly CommerceCoverageQueueSetOption[];
  merchants: readonly CommerceMerchant[];
  now?: Date;
  offerSeeds: readonly CommerceOfferSeed[];
  staleAfterDays?: number;
  minimumValidMerchantCount?: number;
}): CommerceCoverageQueueRow[] {
  const activeMerchants = merchants
    .filter((merchant) => merchant.isActive)
    .sort(compareCommerceMerchantsByOperationalPriority);
  const activeOfferSeeds = offerSeeds.filter(
    (offerSeed) => offerSeed.isActive && offerSeed.merchant?.isActive === true,
  );
  const benchmarkSetIds = new Set(
    benchmarkSets.map((benchmarkSet) => benchmarkSet.setId),
  );

  return [...catalogSets]
    .map((catalogSet) => {
      const setActiveOfferSeeds = activeOfferSeeds.filter(
        (offerSeed) => offerSeed.setId === catalogSet.id,
      );
      const merchantStatuses = activeMerchants.map((merchant) => {
        const merchantOfferSeeds = setActiveOfferSeeds
          .filter(
            (offerSeed) =>
              offerSeed.setId === catalogSet.id &&
              offerSeed.merchantId === merchant.id,
          )
          .sort((left, right) => {
            const leftState = getOfferSeedCoverageQueueState({
              now,
              offerSeed: left,
              staleAfterDays,
            });
            const rightState = getOfferSeedCoverageQueueState({
              now,
              offerSeed: right,
              staleAfterDays,
            });

            return (
              getCoverageQueueMerchantStatePriority(leftState) -
                getCoverageQueueMerchantStatePriority(rightState) ||
              (getTimestampMs(
                getLatestTimestamp([
                  right.lastVerifiedAt,
                  right.latestOffer?.fetchedAt,
                  right.latestOffer?.observedAt,
                ]),
              ) ?? 0) -
                (getTimestampMs(
                  getLatestTimestamp([
                    left.lastVerifiedAt,
                    left.latestOffer?.fetchedAt,
                    left.latestOffer?.observedAt,
                  ]),
                ) ?? 0)
            );
          });
        const preferredOfferSeed = merchantOfferSeeds[0];
        const seedState = preferredOfferSeed
          ? getOfferSeedCoverageQueueState({
              now,
              offerSeed: preferredOfferSeed,
              staleAfterDays,
            })
          : undefined;
        const lastCheckedAt = getLatestTimestamp([
          preferredOfferSeed?.lastVerifiedAt,
          preferredOfferSeed?.latestOffer?.fetchedAt,
          preferredOfferSeed?.latestOffer?.observedAt,
        ]);
        const isRecentConfirmedUnavailable =
          isWithinLastDays({
            now,
            days: COMMERCE_COVERAGE_UNAVAILABLE_RECHECK_DAYS,
            value: lastCheckedAt,
          }) && seedState === 'unavailable';
        const state: CommerceCoverageQueueMerchantState = preferredOfferSeed
          ? seedState === 'unavailable'
            ? isRecentConfirmedUnavailable
              ? 'not_available_confirmed'
              : 'missing'
            : (seedState ?? 'pending')
          : isRecentConfirmedUnavailable
            ? 'not_available_confirmed'
            : 'missing';

        return {
          merchantId: merchant.id,
          merchantName: merchant.name,
          merchantSlug: merchant.slug,
          offerSeed: preferredOfferSeed,
          state,
          lastCheckedAt,
        } satisfies CommerceCoverageQueueMerchantStatus;
      });
      const validMerchantCount = merchantStatuses.filter(
        (merchantStatus) => merchantStatus.state === 'valid',
      ).length;
      const needsReviewCount = merchantStatuses.filter(
        (merchantStatus) => merchantStatus.state === 'review',
      ).length;
      const staleMerchantCount = merchantStatuses.filter(
        (merchantStatus) => merchantStatus.state === 'stale',
      ).length;
      const unavailableMerchantCount = 0;
      const notAvailableConfirmedMerchantStatuses = merchantStatuses.filter(
        (merchantStatus) => merchantStatus.state === 'not_available_confirmed',
      );
      const merchantsCheckedCount = merchantStatuses.filter(
        (merchantStatus) => merchantStatus.state !== 'missing',
      ).length;
      const missingMerchantStatuses = merchantStatuses.filter(
        (merchantStatus) => merchantStatus.state === 'missing',
      );
      const firstManualSeedMerchant = missingMerchantStatuses.find(
        (merchantStatus) =>
          supportsCommerceMerchantManualSeed(merchantStatus.merchantSlug),
      );
      const fixableSeedMerchant = merchantStatuses.find(
        (merchantStatus) =>
          Boolean(merchantStatus.offerSeed) &&
          merchantStatus.state !== 'valid' &&
          merchantStatus.state !== 'missing' &&
          merchantStatus.state !== 'not_available_confirmed',
      );
      const recommendedAction = fixableSeedMerchant
        ? ({
            action: 'edit_seed',
            merchantId: fixableSeedMerchant.merchantId,
            merchantName: fixableSeedMerchant.merchantName,
          } as const)
        : validMerchantCount < minimumValidMerchantCount &&
            firstManualSeedMerchant
          ? ({
              action: 'add_seed_manually',
              merchantId: firstManualSeedMerchant.merchantId,
              merchantName: firstManualSeedMerchant.merchantName,
            } as const)
          : validMerchantCount < minimumValidMerchantCount &&
              notAvailableConfirmedMerchantStatuses.length > 0
            ? ({
                action: 'recheck_later',
              } as const)
            : ({
                action: 'no_action_needed',
              } as const);

      return {
        setId: catalogSet.id,
        setName: catalogSet.name,
        theme: catalogSet.theme,
        source: catalogSet.source,
        sourceCreatedAt: catalogSet.createdAt,
        isBenchmark: benchmarkSetIds.has(catalogSet.id),
        validMerchantCount,
        activeSeedCount: setActiveOfferSeeds.length,
        merchantsCheckedCount,
        missingMerchantIds: missingMerchantStatuses.map(
          (merchantStatus) => merchantStatus.merchantId,
        ),
        missingMerchantNames: missingMerchantStatuses.map(
          (merchantStatus) => merchantStatus.merchantName,
        ),
        missingMerchantSlugs: missingMerchantStatuses.map(
          (merchantStatus) => merchantStatus.merchantSlug,
        ),
        needsReviewCount,
        notAvailableConfirmedMerchantCount:
          notAvailableConfirmedMerchantStatuses.length,
        notAvailableConfirmedMerchantNames:
          notAvailableConfirmedMerchantStatuses.map(
            (merchantStatus) => merchantStatus.merchantName,
          ),
        staleMerchantCount,
        unavailableMerchantCount,
        latestCheckedAt: getLatestTimestamp(
          merchantStatuses.map(
            (merchantStatus) => merchantStatus.lastCheckedAt,
          ),
        ),
        merchantStatuses,
        statusSummary: buildCoverageQueueStatusSummary({
          activeSeedCount: setActiveOfferSeeds.length,
          actionableMissingCount: missingMerchantStatuses.length,
          merchantsCheckedCount,
          minimumValidMerchantCount,
          needsReviewCount,
          notAvailableConfirmedMerchantCount:
            notAvailableConfirmedMerchantStatuses.length,
          staleMerchantCount,
          unavailableMerchantCount,
          validMerchantCount,
        }),
        recommendedNextAction: recommendedAction.action,
        recommendedMerchantId: recommendedAction.merchantId,
        recommendedMerchantName: recommendedAction.merchantName,
      } satisfies CommerceCoverageQueueRow;
    })
    .sort((left, right) =>
      compareCoverageQueueRows(left, right, minimumValidMerchantCount),
    );
}

export function filterCommerceCoverageQueueRows({
  healthFilter = 'all',
  merchantGapMerchantId = 'all',
  minimumValidMerchantCount = 3,
  priorityFilter = 'all',
  rows,
  search = '',
  sourceFilter = 'all',
}: CommerceCoverageQueueFilters & {
  rows: readonly CommerceCoverageQueueRow[];
}): CommerceCoverageQueueRow[] {
  const normalizedSearch = search.trim().toLowerCase();

  return rows.filter((row) => {
    if (
      healthFilter === 'under_covered' &&
      row.validMerchantCount >= minimumValidMerchantCount
    ) {
      return false;
    }

    if (healthFilter === 'zero_valid' && row.validMerchantCount > 0) {
      return false;
    }

    if (healthFilter === 'stale' && row.staleMerchantCount === 0) {
      return false;
    }

    if (healthFilter === 'needs_review' && row.needsReviewCount === 0) {
      return false;
    }

    if (
      healthFilter === 'fully_covered' &&
      !(
        row.validMerchantCount >= minimumValidMerchantCount &&
        row.needsReviewCount === 0 &&
        row.staleMerchantCount === 0 &&
        row.unavailableMerchantCount === 0
      )
    ) {
      return false;
    }

    if (sourceFilter !== 'all' && row.source !== sourceFilter) {
      return false;
    }

    if (priorityFilter === 'benchmark_only' && !row.isBenchmark) {
      return false;
    }

    if (
      merchantGapMerchantId !== 'all' &&
      !row.missingMerchantIds.includes(merchantGapMerchantId)
    ) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return (
      row.setId.toLowerCase().includes(normalizedSearch) ||
      row.setName.toLowerCase().includes(normalizedSearch) ||
      row.theme.toLowerCase().includes(normalizedSearch)
    );
  });
}
