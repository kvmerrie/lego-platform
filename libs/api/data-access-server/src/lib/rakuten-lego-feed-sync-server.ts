import { PassThrough, Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import {
  getRakutenLegoFeedConfig,
  resolveRakutenLegoFeedFilename,
  type RakutenLegoFeedConfig,
} from '@lego-platform/shared/config';
import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import SftpClient from 'ssh2-sftp-client';
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import {
  importAffiliateFeedRowsForMerchant,
  type AffiliateFeedMerchantConfig,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedRow,
} from './alternate-affiliate-feed-server';

type RakutenXmlProduct = Readonly<Record<string, string | undefined>>;

export interface RakutenLegoFeedAuditOptions {
  feedFilename?: string;
  maxProducts?: number;
  sampleLimit?: number;
  templateFilename?: string;
}

export interface RakutenLegoFeedDiscoveryAuditOptions {
  maxProductsPerFile?: number;
  redirectSampleLimit?: number;
  templateFilename?: string;
}

export interface RakutenLegoFeedAuditReport {
  assetMetadata: {
    ageFieldCount: number;
    categoryCounts: Readonly<Record<string, number>>;
    descriptionCount: number;
    eanCount: number;
    imageCount: number;
    imageHosts: Readonly<Record<string, number>>;
    piecesFieldCount: number;
  };
  deeplink: {
    affiliateReadyCount: number;
    hostCounts: Readonly<Record<string, number>>;
    localeCounts: Readonly<Record<string, number>>;
    missingCount: number;
    murlHostCounts: Readonly<Record<string, number>>;
    queryParamCounts: Readonly<Record<string, number>>;
    sampleHosts: readonly string[];
  };
  feed: {
    filename: string;
    maxProducts: number;
    templateFilename?: string;
  };
  offerQuality: {
    availabilityCounts: Readonly<Record<string, number>>;
    currencyCounts: Readonly<Record<string, number>>;
    duplicateProductIdCount: number;
    duplicateSetNumberCount: number;
    invalidPriceCount: number;
    missingPriceCount: number;
    priceCount: number;
    saleSignalCount: number;
  };
  phaseOneReadiness: {
    blockers: readonly string[];
    dryRunMappedOfferCount: number;
    gates: {
      currencyAcceptable: boolean;
      importWithoutCatalogMutation: boolean;
      localeAcceptable: boolean;
      matchPrecisionAcceptable: boolean;
      matchedOffersLookLogical: boolean;
      nonSetFilteringReliable: boolean;
      observabilityPresent: boolean;
    };
    recommendation: 'blocked' | 'ready_with_caution';
    warnings: readonly string[];
  };
  parsedProductsCount: number;
  risks: readonly string[];
  samples: {
    dryRunOffers: readonly RakutenLegoOfferDryRunMapping[];
    excluded: readonly RakutenLegoExcludedProductSample[];
    matched: readonly RakutenLegoDebugSample[];
    nonSet: readonly RakutenLegoDebugSample[];
    unmatched: readonly RakutenLegoDebugSample[];
  };
  schema: {
    observedFields: readonly string[];
    templatePreview?: string;
    templateSuggestedFields: readonly string[];
  };
  setMatching: {
    catalogSetCount: number;
    catalogSetsWithoutLegoOfferSample: readonly string[];
    detectedSetNumberCount: number;
    duplicateSetNumbers: readonly {
      count: number;
      setNumber: string;
    }[];
    excludedByReason: Readonly<
      Record<RakutenLegoProductExclusionReason, number>
    >;
    falsePositiveRiskCount: number;
    legoCandidateCount: number;
    matchQuality: {
      accessoryOrNonSetCandidateCount: number;
      catalogCoverageGapCount: number;
      duplicateFeedSetNumberCount: number;
      formatMismatchRecoveredCount: number;
      reliablePartNumberCandidateCount: number;
      textOnlySetNumberCount: number;
      unmatchedReliableCandidateCount: number;
    };
    matchedCatalogCount: number;
    nonSetProductCount: number;
    unmatchedLegoFeedProducts: readonly {
      category?: string;
      productId?: string;
      setNumber?: string;
      title?: string;
    }[];
  };
}

export interface RakutenLegoFeedDiscoveryAuditReport {
  conclusion: {
    likelyNlFeedAvailable: boolean;
    phaseOneFileRecommendation?: string;
    summary: string;
  };
  files: {
    all: readonly RakutenLegoFeedFileDiscoveryEntry[];
    failures: readonly RakutenSftpListFailure[];
    groups: Readonly<Record<RakutenLegoFeedFileKind, number>>;
    relevantFeedFiles: readonly string[];
    successfulPaths: readonly string[];
  };
  perFileAudits: readonly RakutenLegoFeedFileLocaleAudit[];
  redirectAudits: readonly RakutenLegoDeeplinkRedirectAudit[];
  template: {
    filename?: string;
    hasCountryOrLanguageFields: boolean;
    localeFieldHints: readonly string[];
    preview?: string;
    suggestedFields: readonly string[];
  };
}

export type RakutenLegoFeedFileKind = 'delta' | 'full' | 'other' | 'template';

export interface RakutenLegoFeedFileDiscoveryEntry {
  filename: string;
  kind: RakutenLegoFeedFileKind;
  listPath: string;
  localeHints: readonly string[];
  modifiedAt?: string;
  modifyTime?: number;
  path: string;
  size?: number;
  type?: string;
}

export interface RakutenLegoFeedFileLocaleAudit {
  currencyCounts: Readonly<Record<string, number>>;
  deeplinkHostCounts: Readonly<Record<string, number>>;
  file: RakutenLegoFeedFileDiscoveryEntry;
  localeCounts: Readonly<Record<string, number>>;
  murlHostCounts: Readonly<Record<string, number>>;
  observedFields: readonly string[];
  productCountEstimate: {
    lowerBound: number;
    sampledProductCount: number;
    stoppedAtSampleLimit: boolean;
  };
  sampleDeeplinks: readonly string[];
  templateCompatible: boolean;
}

export interface RakutenLegoDeeplinkRedirectAudit {
  chain: readonly {
    location?: string;
    status: number;
    url: string;
  }[];
  error?: string;
  finalLocale?: string;
  initialLocale?: string;
  productTitle?: string;
  setNumber?: string;
}

export interface RakutenLegoOfferDryRunMapping {
  availability?: string;
  currency?: string;
  imageUrl?: string;
  merchantSlug: 'rakuten-lego-eu';
  price?: string;
  productId?: string;
  productTitle?: string;
  productUrl: string;
  setId: string;
  setNumber: string;
  source: 'rakuten-lego-eu';
}

export type RakutenLegoProductExclusionReason =
  | 'accessory_or_merchandise'
  | 'invalid_or_missing_deeplink'
  | 'invalid_or_missing_price'
  | 'missing_lego_brand'
  | 'missing_reliable_part_number'
  | 'non_eur_currency'
  | 'service_or_parts';

export interface RakutenLegoExcludedProductSample {
  productId?: string;
  reason: RakutenLegoProductExclusionReason;
  setNumber?: string;
  title?: string;
}

export interface RakutenLegoDebugSample {
  normalizedRow: AlternateAffiliateFeedRow;
  rawAvailability?: string;
  rawCurrency?: string;
  rawPrice?: string;
  rawProductId?: string;
  rawTitle?: string;
  selectedLegoSetNumber?: string;
  setNumberCandidateFields: readonly string[];
}

export interface RakutenLegoDebugInfo {
  fetchedProductCount: number;
  legoCandidateCount: number;
  sampleCount: number;
  samples: readonly RakutenLegoDebugSample[];
}

export interface RakutenLegoPhaseOneImportSummary {
  availabilityCounts: Readonly<Record<string, number>>;
  duplicateSetNumberCount: number;
  duplicateSetNumbers: readonly {
    count: number;
    setNumber: string;
  }[];
  eligibleImportRowCount: number;
  excludedByReason: Readonly<Record<string, number>>;
  guard: {
    matchRate: number;
    matchedCatalogSetCount: number;
    missingDeeplinkCount: number;
    nonEurCurrencyCount: number;
    nonNlLocaleCount: number;
    parseFailureCount: number;
  };
  localeCounts: Readonly<Record<string, number>>;
  sampleEligibleSetNumbers: readonly string[];
}

export interface RakutenLegoFeedSyncOptions {
  collectUnmatchedDebug?: boolean;
  debugSamples?: number;
  dryRun?: boolean;
  maxProducts?: number;
  persistDiscoveredSets?: boolean;
  unmatchedSampleLimit?: number;
}

export interface RakutenLegoFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  debugInfo?: RakutenLegoDebugInfo;
  fetchedProductCount: number;
  legoCandidateCount: number;
  merchantName: string;
  merchantSlug: string;
  normalizedRowCount: number;
  parseFailureCount: number;
  preflightImportSummary?: {
    matchedCatalogSetCount: number;
    matchRate: number;
    skippedUnmatchedSetCount: number;
  };
  phaseOneImportSummary: RakutenLegoPhaseOneImportSummary;
}

export interface RakutenSftpListEntry {
  listPath: string;
  modifyTime?: number;
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface RakutenSftpListFailure {
  message: string;
  path: string;
}

export interface RakutenSftpListResult {
  entries: readonly RakutenSftpListEntry[];
  failures: readonly RakutenSftpListFailure[];
  pwd?: string;
  successfulPaths: readonly string[];
}

interface RakutenSftpClient {
  connect(config: {
    host: string;
    password: string;
    port: number;
    readyTimeout?: number;
    username: string;
  }): Promise<unknown>;
  createReadStream(path: string): NodeJS.ReadableStream;
  end(): Promise<unknown>;
  get(path: string): Promise<Buffer | NodeJS.ReadableStream | string>;
  list(path: string): Promise<
    readonly {
      modifyTime?: number;
      name: string;
      size?: number;
      type?: string;
    }[]
  >;
  pwd?(): Promise<string>;
}

export interface RakutenLegoFeedSyncDependencies {
  createSftpClientFn?: () => RakutenSftpClient;
  getRakutenLegoFeedConfigFn?: typeof getRakutenLegoFeedConfig;
  importAffiliateFeedRowsForMerchantFn?: typeof importAffiliateFeedRowsForMerchant;
}

const RAKUTEN_LEGO_MERCHANT_NOTES =
  'Feed-driven merchant. Current offer state is imported from the LEGO Rakuten Product Catalog feed.';
const RAKUTEN_LEGO_PHASE_ONE_MERCHANT_SLUG = 'rakuten-lego-eu';
const RAKUTEN_LEGO_EXPECTED_CURRENCY = 'EUR';
const RAKUTEN_LEGO_MAX_NON_NL_LOCALE_RATIO = 0.01;
const RAKUTEN_LEGO_MAX_NON_NL_LOCALE_COUNT = 5;
const RAKUTEN_LEGO_MAX_PARSE_FAILURE_RATIO = 0.01;
const RAKUTEN_LEGO_MAX_PARSE_FAILURE_COUNT = 10;
const RAKUTEN_LEGO_MIN_PHASE_ONE_MATCH_RATE = 0.75;

const NON_BUILDING_SET_PATTERN =
  /\b(?:boek|books?|game|games|software|playstation|xbox|nintendo|switch|pc|kleding|shirt|t-shirt|hoodie|pyjama|sokken|cap|rugzak|backpack|tas|bag|sleutelhanger|keychain|keyring|porte-cl[eé]s|lamp|lighting|light kit|display case|vitrine|beker|mok|mug|tasse|drinkfles|sali[eè]re|poivri[eè]re|sticker|poster|puzzel|puzzle|plush|knuffel|costume|kostuum|watch|horloge|mini-bo[iî]te|serious play)\b/i;
const LEGO_SET_NUMBER_PATTERN = /\b(?:LEGO\s*)?(\d{4,6})(?:-\d+)?\b/i;
const RAKUTEN_LEGO_NL_LOCALE = 'nl-nl';
const PRODUCT_TAG_NAMES = new Set(['product', 'item']);
const RAKUTEN_PIPE_FIELD_NAMES = [
  'product_id',
  'product_name',
  'sku_number',
  'primary_category',
  'secondary_category',
  'linkurl',
  'imageurl',
  'alternate_image_url',
  'short_description',
  'description',
  'keywords',
  'unused_11',
  'unused_12',
  'price',
  'sale_price',
  'retail_price',
  'brand',
  'shipping',
  'unused_18',
  'part_number',
  'manufacturer_name',
  'shipping_info',
  'availability',
  'ean',
  'unused_24',
  'currency',
  'stock_quantity',
  'impression_url',
  'created_at',
  'audience',
  'unused_30',
  'theme',
] as const;

function incrementCount(counts: Record<string, number>, value?: string): void {
  const key = value?.trim() || 'missing';

  counts[key] = (counts[key] ?? 0) + 1;
}

function parseAuditPriceMinor(value?: string | number): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalizedValue = String(value).replace(',', '.').trim();
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.round(parsedValue * 100)
    : undefined;
}

function getUrlHost(value?: string): string | undefined {
  try {
    return value ? new URL(value).host : undefined;
  } catch {
    return undefined;
  }
}

function getUrlQueryParamNames(value?: string): readonly string[] {
  try {
    return value ? [...new URL(value).searchParams.keys()].sort() : [];
  } catch {
    return [];
  }
}

function getRakutenDeeplinkMurl(value?: string): URL | undefined {
  try {
    const murl = value ? new URL(value).searchParams.get('murl') : undefined;

    return murl ? new URL(murl) : undefined;
  } catch {
    return undefined;
  }
}

function getLegoUrlLocale(value?: string): string | undefined {
  const murl = getRakutenDeeplinkMurl(value);
  const pathLocale = murl?.pathname.match(
    /\/([a-z]{2}-[a-z]{2})(?:\/|$)/iu,
  )?.[1];

  return pathLocale?.toLowerCase();
}

function getUrlLocale(value?: string): string | undefined {
  try {
    const url = value ? new URL(value) : undefined;
    const pathLocale = url?.pathname.match(
      /\/([a-z]{2}-[a-z]{2})(?:\/|$)/iu,
    )?.[1];

    return pathLocale?.toLowerCase();
  } catch {
    return undefined;
  }
}

function createDefaultSftpClient(): RakutenSftpClient {
  return new SftpClient() as unknown as RakutenSftpClient;
}

function joinRemotePath(
  directory: string | undefined,
  filename: string,
): string {
  const trimmedFilename = filename.trim();
  const rawDirectory = directory?.trim();
  const trimmedDirectory = rawDirectory?.replace(/\/+$/u, '');

  if (rawDirectory === '/' && !trimmedFilename.startsWith('/')) {
    return `/${trimmedFilename.replace(/^\/+/u, '')}`;
  }

  if (!trimmedDirectory || trimmedFilename.startsWith('/')) {
    return trimmedFilename;
  }

  return `${trimmedDirectory}/${trimmedFilename.replace(/^\/+/u, '')}`;
}

export function resolveRakutenLegoFeedRemotePath(
  config: Pick<RakutenLegoFeedConfig, 'filename' | 'mid' | 'remoteDir' | 'sid'>,
): string {
  if (config.filename?.trim()) {
    return config.filename.trim();
  }

  return joinRemotePath(
    config.remoteDir,
    resolveRakutenLegoFeedFilename(config),
  );
}

function buildRakutenListCandidatePaths(
  config: Pick<RakutenLegoFeedConfig, 'mid' | 'remoteDir'>,
): readonly string[] {
  return [
    '.',
    config.remoteDir,
    '/',
    config.mid,
    '/Global',
    '/global',
    '/GLOBAL',
    'Global',
    'global',
    'GLOBAL',
    '/Global/NL-NL_EUR',
    '/global/NL-NL_EUR',
    '/GLOBAL/NL-NL_EUR',
  ].reduce<string[]>((paths, path) => {
    const trimmedPath = path?.trim();

    if (trimmedPath && !paths.includes(trimmedPath)) {
      paths.push(trimmedPath);
    }

    return paths;
  }, []);
}

function shouldExploreRakutenDirectory({
  config,
  name,
}: {
  config: Pick<RakutenLegoFeedConfig, 'mid'>;
  name: string;
}): boolean {
  const trimmedName = name.trim();
  const normalizedName = trimmedName.toLowerCase();

  return (
    ['global', 'nl-nl_eur', 'nl_nl_eur'].includes(normalizedName) ||
    /^(?:nl[-_]nl|nl[-_]be|be[-_]nl|nld|netherlands)(?:[-_]eur)?$/iu.test(
      trimmedName,
    ) ||
    (/^\d+$/u.test(trimmedName) &&
      (!config.mid?.trim() || config.mid.trim() === trimmedName))
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withTimeout<T>({
  message,
  promise,
  timeoutMs,
}: {
  message: string;
  promise: Promise<T>;
  timeoutMs: number;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function readString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmedValue = String(value).trim();

  return trimmedValue ? trimmedValue : undefined;
}

function normalizeLookupKey(value: string): string {
  return value
    .replace(/^[^:]+:/u, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function readProductField(
  product: RakutenXmlProduct,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const value = product[normalizeLookupKey(alias)] ?? product[alias];
    const trimmedValue = readString(value);

    if (trimmedValue) {
      return trimmedValue;
    }
  }

  return undefined;
}

function buildHumanSetNumberCandidateFields(
  product: RakutenXmlProduct,
): readonly string[] {
  return [
    readProductField(product, [
      'product_name',
      'productname',
      'name',
      'title',
      'product_title',
      'producttitle',
    ]),
    readProductField(product, [
      'short_description',
      'shortdescription',
      'short_desc',
      'summary',
    ]),
    readProductField(product, [
      'description',
      'description_long',
      'long_description',
    ]),
    readProductField(product, [
      'category',
      'category_name',
      'categoryname',
      'category_primary',
      'category_secondary',
      'primary_category',
      'product_category',
      'primary',
      'secondary',
    ]),
  ].filter((value): value is string => Boolean(value));
}

function buildProductTextFields(product: RakutenXmlProduct): readonly string[] {
  return [
    readProductField(product, [
      'product_name',
      'productname',
      'name',
      'title',
      'product_title',
      'producttitle',
    ]),
    readProductField(product, [
      'short_description',
      'shortdescription',
      'short_desc',
      'summary',
    ]),
    readProductField(product, [
      'description',
      'description_long',
      'long_description',
    ]),
    readProductField(product, ['attribute_class_theme', 'theme']),
  ].filter((value): value is string => Boolean(value));
}

export function extractRakutenLegoSetNumberFromHumanFields(
  product: RakutenXmlProduct,
): string | undefined {
  for (const fieldValue of buildHumanSetNumberCandidateFields(product)) {
    const match = LEGO_SET_NUMBER_PATTERN.exec(fieldValue);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function normalizeRakutenLegoSetNumber(value?: string): string | undefined {
  const match = LEGO_SET_NUMBER_PATTERN.exec(value ?? '');
  const rawSetNumber = match?.[1];

  if (!rawSetNumber) {
    return undefined;
  }

  const withoutLeadingZeros = rawSetNumber.replace(/^0+(?=\d{4,}$)/u, '');

  return withoutLeadingZeros || rawSetNumber;
}

export function extractRakutenLegoSetNumberFromProductFields(
  product: RakutenXmlProduct,
): string | undefined {
  const partNumber = readProductField(product, [
    'part_number',
    'manufacturer_part_number',
    'mpn',
  ]);

  return normalizeRakutenLegoSetNumber(partNumber);
}

function getSearchText(product: RakutenXmlProduct): string {
  return buildHumanSetNumberCandidateFields(product).join(' ');
}

function getRakutenLegoProductExclusionReason(
  product: RakutenXmlProduct,
): RakutenLegoProductExclusionReason | undefined {
  const searchText = getSearchText(product);
  const productText = buildProductTextFields(product).join(' ');
  const brand = readProductField(product, [
    'brand',
    'manufacturer',
    'manufacturer_name',
    'product_brand',
    'make',
  ]);

  if (!/\blego\b/i.test(`${brand ?? ''} ${searchText}`)) {
    return 'missing_lego_brand';
  }

  if (
    /\b(?:serious play|service|services|replacement parts?|pi[eè]ces d[eé]tach[eé]es|pick a brick)\b/iu.test(
      productText,
    )
  ) {
    return 'service_or_parts';
  }

  if (NON_BUILDING_SET_PATTERN.test(productText)) {
    return 'accessory_or_merchandise';
  }

  if (!extractRakutenLegoSetNumberFromProductFields(product)) {
    return 'missing_reliable_part_number';
  }

  const currency = readRakutenCurrency(product);
  const price = readProductField(product, [
    'price',
    'price_retail',
    'retail',
    'sale_price',
    'saleprice',
    'retail_price',
    'retailprice',
  ]);
  const affiliateDeeplink = readProductField(product, [
    'linkurl',
    'link_url',
    'clickurl',
    'click_url',
    'deeplink',
    'product_url',
    'producturl',
    'url_product',
    'url',
  ]);

  if (currency !== 'EUR') {
    return 'non_eur_currency';
  }

  if (parseAuditPriceMinor(price) === undefined) {
    return 'invalid_or_missing_price';
  }

  try {
    new URL(affiliateDeeplink ?? '');
  } catch {
    return 'invalid_or_missing_deeplink';
  }

  return undefined;
}

function getRakutenLegoPhaseOneImportExclusionReason(
  product: RakutenXmlProduct,
): string | undefined {
  const baseExclusionReason = getRakutenLegoProductExclusionReason(product);

  if (baseExclusionReason) {
    return baseExclusionReason;
  }

  const normalizedRow = normalizeRakutenLegoProductToAffiliateFeedRow(product);

  if (
    getLegoUrlLocale(normalizedRow.affiliateDeeplink) !== RAKUTEN_LEGO_NL_LOCALE
  ) {
    return 'non_nl_deeplink_locale';
  }

  if (!readRakutenAvailabilityText(product)) {
    return 'invalid_or_missing_availability';
  }

  return undefined;
}

export function isStrictRakutenLegoSetCandidate(
  product: RakutenXmlProduct,
): boolean {
  return getRakutenLegoProductExclusionReason(product) === undefined;
}

function readRakutenAvailabilityText(
  product: RakutenXmlProduct,
): string | undefined {
  const rawValue = readProductField(product, [
    'availability',
    'availability_status',
    'stock_status',
    'stock',
    'shipping_availability',
    'instock',
    'in_stock',
    'inventory',
  ]);

  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (
    ['1', 'true', 'yes', 'y', 'available', 'instock', 'in-stock'].includes(
      normalizedValue,
    )
  ) {
    return 'In stock';
  }

  if (
    [
      '0',
      'false',
      'no',
      'n',
      'unavailable',
      'outofstock',
      'out-of-stock',
    ].includes(normalizedValue)
  ) {
    return 'Out of stock';
  }

  return rawValue;
}

function readRakutenCurrency(product: RakutenXmlProduct): string | undefined {
  return readProductField(product, [
    'currency',
    'price_currency',
    'price_retail_currency',
    'currency_code',
  ])
    ?.trim()
    .toUpperCase();
}

export function normalizeRakutenLegoProductToAffiliateFeedRow(
  product: RakutenXmlProduct,
): AlternateAffiliateFeedRow {
  const isLegoSetCandidate = isStrictRakutenLegoSetCandidate(product);
  const productTitle = readProductField(product, [
    'product_name',
    'productname',
    'name',
    'title',
    'product_title',
    'producttitle',
  ]);

  return {
    affiliateDeeplink:
      readProductField(product, [
        'linkurl',
        'link_url',
        'clickurl',
        'click_url',
        'deeplink',
        'product_url',
        'producturl',
        'url_product',
        'url',
      ]) ?? '',
    availabilityText: readRakutenAvailabilityText(product),
    brand: isLegoSetCandidate ? 'LEGO' : undefined,
    category: readProductField(product, [
      'category',
      'category_name',
      'categoryname',
      'category_primary',
      'category_secondary',
      'primary_category',
      'product_category',
      'primary',
      'secondary',
    ]),
    condition: readProductField(product, ['condition', 'item_condition']),
    currency: readRakutenCurrency(product),
    description: readProductField(product, [
      'description',
      'description_long',
      'short_description',
      'shortdescription',
      'long_description',
      'long',
    ]),
    ean: readProductField(product, ['ean', 'gtin', 'upc']),
    imageUrl: readProductField(product, [
      'imageurl',
      'image_url',
      'image',
      'largeimage',
      'large_image',
      'url_product_image',
      'url_productimage',
      'productimage',
      'thumbnail',
    ]),
    legoSetNumber: isLegoSetCandidate
      ? extractRakutenLegoSetNumberFromProductFields(product)
      : undefined,
    price: readProductField(product, [
      'price',
      'price_retail',
      'retail',
      'sale_price',
      'saleprice',
      'retail_price',
      'retailprice',
    ]),
    productId: readProductField(product, [
      'product_id',
      'productid',
      'sku',
      'merchant_sku',
      'rakuten_product_id',
      'id',
    ]),
    productTitle,
    shippingCost: readProductField(product, ['shipping', 'shipping_cost']),
  };
}

async function* iterateTextChunks(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();

  for await (const chunk of chunks) {
    if (typeof chunk === 'string') {
      yield chunk;
    } else {
      yield decoder.decode(chunk, {
        stream: true,
      });
    }
  }

  const finalChunk = decoder.decode();

  if (finalChunk) {
    yield finalChunk;
  }
}

function setProductField({
  currentProduct,
  fieldName,
  value,
}: {
  currentProduct: Record<string, string | undefined>;
  fieldName: string;
  value: string;
}): void {
  const normalizedFieldName = normalizeLookupKey(fieldName);

  if (!normalizedFieldName || currentProduct[normalizedFieldName]) {
    return;
  }

  currentProduct[normalizedFieldName] = value;
}

export async function* parseRakutenLegoProductFeedXmlStream(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
  options?: {
    maxProducts?: number;
    onParseFailure?: () => void;
  },
): AsyncGenerator<RakutenXmlProduct> {
  const parser = new SaxesParser({
    xmlns: false,
  });
  const productQueue: RakutenXmlProduct[] = [];
  const pendingErrors: Error[] = [];
  const path: string[] = [];
  let currentProduct: Record<string, string | undefined> | undefined;
  let currentProductDepth = 0;
  let currentText = '';
  let productCount = 0;
  let shouldStop = false;
  let parserEnded = false;

  parser.on('opentag', (tag: SaxesTagPlain) => {
    const tagName = tag.name;
    path.push(tagName);
    currentText = '';

    if (shouldStop) {
      return;
    }

    if (
      !currentProduct &&
      PRODUCT_TAG_NAMES.has(normalizeLookupKey(tagName)) &&
      path.length <= 2
    ) {
      currentProduct = {};
      currentProductDepth = path.length;

      for (const [attributeName, attributeValue] of Object.entries(
        tag.attributes,
      )) {
        const value = readString(attributeValue);

        if (value) {
          setProductField({
            currentProduct,
            fieldName: attributeName,
            value,
          });
        }
      }
    } else if (currentProduct) {
      for (const [attributeName, attributeValue] of Object.entries(
        tag.attributes,
      )) {
        const value = readString(attributeValue);

        if (value) {
          setProductField({
            currentProduct,
            fieldName: `${tagName}_${attributeName}`,
            value,
          });
        }
      }
    }
  });
  parser.on('text', (text) => {
    if (!shouldStop) {
      currentText += text;
    }
  });
  parser.on('cdata', (text) => {
    if (!shouldStop) {
      currentText += text;
    }
  });
  parser.on('error', (error) => {
    options?.onParseFailure?.();
    pendingErrors.push(error);
  });
  parser.on('closetag', (tag) => {
    if (shouldStop) {
      path.pop();

      return;
    }

    const normalizedTagName = normalizeLookupKey(tag.name);
    const text = currentText.trim();

    try {
      if (
        currentProduct &&
        text &&
        !(
          PRODUCT_TAG_NAMES.has(normalizedTagName) &&
          path.length === currentProductDepth
        )
      ) {
        const parentTagName = path[path.length - 2];
        const fieldName =
          parentTagName && path.length > currentProductDepth + 1
            ? `${parentTagName}_${tag.name}`
            : tag.name;

        setProductField({
          currentProduct,
          fieldName,
          value: text,
        });
      }

      if (
        currentProduct &&
        PRODUCT_TAG_NAMES.has(normalizedTagName) &&
        path.length === currentProductDepth
      ) {
        productQueue.push(currentProduct);
        currentProduct = undefined;
        currentProductDepth = 0;
        productCount += 1;

        if (options?.maxProducts && productCount >= options.maxProducts) {
          shouldStop = true;
        }
      }
    } catch {
      options?.onParseFailure?.();
    } finally {
      path.pop();
      currentText = '';
    }
  });
  parser.on('end', () => {
    parserEnded = true;
  });

  for await (const chunk of iterateTextChunks(chunks)) {
    if (!shouldStop) {
      parser.write(chunk);
    }

    while (productQueue.length > 0) {
      const product = productQueue.shift();

      if (product) {
        yield product;
      }
    }

    if (pendingErrors.length > 0) {
      throw pendingErrors[0];
    }
  }

  if (!parserEnded && !shouldStop) {
    parser.close();
  }

  while (productQueue.length > 0) {
    const product = productQueue.shift();

    if (product) {
      yield product;
    }
  }

  if (pendingErrors.length > 0) {
    throw pendingErrors[0];
  }
}

function parseRakutenPipeProductLine(
  line: string,
): RakutenXmlProduct | undefined {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith('HDR|') || trimmedLine === 'TRL') {
    return undefined;
  }

  const columns = line.split('|');
  const product: Record<string, string | undefined> = {};

  RAKUTEN_PIPE_FIELD_NAMES.forEach((fieldName, index) => {
    const value = readString(columns[index]);

    if (value) {
      product[fieldName] = value;
    }
  });

  return Object.keys(product).length > 0 ? product : undefined;
}

async function* parseRakutenLegoPipeProductFeedStream(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
  options?: {
    maxProducts?: number;
  },
): AsyncGenerator<RakutenXmlProduct> {
  let bufferedText = '';
  let productCount = 0;

  for await (const chunk of iterateTextChunks(chunks)) {
    bufferedText += chunk;
    const lines = bufferedText.split(/\r?\n/u);
    bufferedText = lines.pop() ?? '';

    for (const line of lines) {
      const product = parseRakutenPipeProductLine(line);

      if (!product) {
        continue;
      }

      yield product;
      productCount += 1;

      if (options?.maxProducts && productCount >= options.maxProducts) {
        return;
      }
    }
  }

  const product = parseRakutenPipeProductLine(bufferedText);

  if (
    product &&
    (!options?.maxProducts || productCount < options.maxProducts)
  ) {
    yield product;
  }
}

export async function* parseRakutenLegoProductFeedStream(
  chunks: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
  options?: {
    maxProducts?: number;
    onParseFailure?: () => void;
  },
): AsyncGenerator<RakutenXmlProduct> {
  const iterator =
    Symbol.asyncIterator in chunks
      ? chunks[Symbol.asyncIterator]()
      : (async function* () {
          yield* chunks as Iterable<Buffer | string>;
        })();
  const previewChunks: (Buffer | string)[] = [];
  let previewText = '';

  const firstChunkResult = await iterator.next();

  if (firstChunkResult.done) {
    return;
  }

  const firstChunk = firstChunkResult.value;
  previewChunks.push(firstChunk);

  previewText += Buffer.isBuffer(firstChunk)
    ? firstChunk.toString('utf8')
    : String(firstChunk);

  async function* replayChunks(): AsyncGenerator<Buffer | string> {
    for (const previewChunk of previewChunks) {
      yield previewChunk;
    }

    while (true) {
      const result = await iterator.next();

      if (result.done) {
        return;
      }

      yield result.value;
    }
  }

  while (!previewText.trim() && previewText.length < 4096) {
    const nextChunkResult = await iterator.next();

    if (nextChunkResult.done) {
      break;
    }

    previewChunks.push(nextChunkResult.value);
    previewText += Buffer.isBuffer(nextChunkResult.value)
      ? nextChunkResult.value.toString('utf8')
      : String(nextChunkResult.value);
  }

  const isXml = previewText.trimStart().startsWith('<');

  yield* isXml
    ? parseRakutenLegoProductFeedXmlStream(replayChunks(), options)
    : parseRakutenLegoPipeProductFeedStream(replayChunks(), options);
}

function toReadableStream(
  input: Buffer | NodeJS.ReadableStream | string,
): Readable {
  if (Buffer.isBuffer(input) || typeof input === 'string') {
    return Readable.from([input]);
  }

  return input instanceof Readable ? input : Readable.from(input);
}

async function downloadRakutenFeedXmlStream({
  config,
  createSftpClientFn,
  filename,
}: {
  config: RakutenLegoFeedConfig;
  createSftpClientFn: () => RakutenSftpClient;
  filename: string;
}): Promise<Readable> {
  const client = createSftpClientFn();

  await client.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 30_000,
  });

  const output = new PassThrough();
  const remoteStream =
    typeof client.createReadStream === 'function'
      ? toReadableStream(client.createReadStream(filename))
      : toReadableStream(await client.get(filename));
  const gunzipStream = remoteStream.pipe(createGunzip());
  let closed = false;
  const closeClient = () => {
    if (closed) {
      return;
    }

    closed = true;
    void client.end().catch(() => undefined);
  };

  gunzipStream.on('error', (error) => {
    output.destroy(error);
    closeClient();
  });
  gunzipStream.on('end', closeClient);
  gunzipStream.on('close', closeClient);
  remoteStream.on('error', (error) => {
    output.destroy(error);
    closeClient();
  });

  return gunzipStream.pipe(output);
}

export async function listRakutenLegoFeedFiles({
  dependencies,
}: {
  dependencies?: RakutenLegoFeedSyncDependencies;
} = {}): Promise<RakutenSftpListResult> {
  const getRakutenLegoFeedConfigFn =
    dependencies?.getRakutenLegoFeedConfigFn ?? getRakutenLegoFeedConfig;
  const createSftpClientFn =
    dependencies?.createSftpClientFn ?? createDefaultSftpClient;
  const config = getRakutenLegoFeedConfigFn();
  const client = createSftpClientFn();
  const entries: RakutenSftpListEntry[] = [];
  const failures: RakutenSftpListFailure[] = [];
  const successfulPaths: string[] = [];
  let pwd: string | undefined;

  await client.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 30_000,
  });

  try {
    if (typeof client.pwd === 'function') {
      try {
        pwd = await client.pwd();
      } catch {
        pwd = undefined;
      }
    }

    const listedPaths = new Set<string>();
    const pathsToList = [...buildRakutenListCandidatePaths(config)];

    for (let pathIndex = 0; pathIndex < pathsToList.length; pathIndex += 1) {
      const listPath = pathsToList[pathIndex];

      const canonicalListPath = getCanonicalRakutenFeedPath(listPath || '.');

      if (listedPaths.has(canonicalListPath)) {
        continue;
      }

      listedPaths.add(canonicalListPath);

      try {
        const listEntries = await withTimeout({
          message: `list timed out for ${listPath}`,
          promise: client.list(listPath),
          timeoutMs: ['.', '/', config.remoteDir, config.mid].includes(listPath)
            ? 90_000
            : 15_000,
        });
        successfulPaths.push(listPath);

        for (const entry of listEntries) {
          const path = joinRemotePath(
            listPath === '.' ? undefined : listPath,
            entry.name,
          );

          entries.push({
            listPath,
            modifyTime: entry.modifyTime,
            name: entry.name,
            path,
            size: entry.size,
            type: entry.type,
          });

          if (
            entry.type === 'd' &&
            !['.', '..'].includes(entry.name) &&
            shouldExploreRakutenDirectory({
              config,
              name: entry.name,
            }) &&
            !listedPaths.has(getCanonicalRakutenFeedPath(path))
          ) {
            pathsToList.push(path);
          }
        }
      } catch (error) {
        failures.push({
          message: getErrorMessage(error),
          path: listPath,
        });
      }
    }
  } finally {
    await client.end();
  }

  return {
    entries: entries.sort((left, right) => left.path.localeCompare(right.path)),
    failures,
    pwd,
    successfulPaths,
  };
}

async function readStreamPreview(
  stream: NodeJS.ReadableStream,
  maxCharacters: number,
): Promise<string> {
  const chunks: string[] = [];
  let characterCount = 0;

  for await (const chunk of stream) {
    const text = Buffer.isBuffer(chunk)
      ? chunk.toString('utf8')
      : String(chunk);
    const remainingCharacters = maxCharacters - characterCount;

    if (remainingCharacters <= 0) {
      break;
    }

    chunks.push(text.slice(0, remainingCharacters));
    characterCount += Math.min(text.length, remainingCharacters);

    if (characterCount >= maxCharacters) {
      break;
    }
  }

  const destroyableStream = stream as NodeJS.ReadableStream & {
    destroy?: () => void;
  };

  if (typeof destroyableStream.destroy === 'function') {
    destroyableStream.destroy();
  }

  return chunks.join('');
}

function buildCatalogSetIdLookupForAudit(
  catalogSets: readonly CatalogCanonicalSet[],
): ReadonlyMap<string, CatalogCanonicalSet> {
  const lookup = new Map<string, CatalogCanonicalSet>();

  for (const catalogSet of catalogSets) {
    const normalizedSetId = normalizeRakutenLegoSetNumber(catalogSet.setId);

    lookup.set(catalogSet.setId, catalogSet);

    if (normalizedSetId) {
      lookup.set(normalizedSetId, catalogSet);
      lookup.set(`${normalizedSetId}-1`, catalogSet);
    }

    if (catalogSet.sourceSetNumber) {
      lookup.set(catalogSet.sourceSetNumber, catalogSet);

      const normalizedSourceSetNumber = normalizeRakutenLegoSetNumber(
        catalogSet.sourceSetNumber,
      );

      if (normalizedSourceSetNumber) {
        lookup.set(normalizedSourceSetNumber, catalogSet);
        lookup.set(`${normalizedSourceSetNumber}-1`, catalogSet);
      }
    }

    lookup.set(`${catalogSet.setId}-1`, catalogSet);
  }

  return lookup;
}

function resolveAuditCatalogSet({
  catalogSetByIdentifier,
  setNumber,
}: {
  catalogSetByIdentifier: ReadonlyMap<string, CatalogCanonicalSet>;
  setNumber?: string;
}): CatalogCanonicalSet | undefined {
  if (!setNumber) {
    return undefined;
  }

  const normalizedSetNumber = normalizeRakutenLegoSetNumber(setNumber);

  return (
    catalogSetByIdentifier.get(setNumber) ??
    (normalizedSetNumber
      ? catalogSetByIdentifier.get(normalizedSetNumber)
      : undefined) ??
    (normalizedSetNumber
      ? catalogSetByIdentifier.get(`${normalizedSetNumber}-1`)
      : undefined) ??
    catalogSetByIdentifier.get(`${setNumber}-1`) ??
    catalogSetByIdentifier.get(setNumber.replace(/-1$/u, ''))
  );
}

function getTemplateSuggestedFields(
  templatePreview?: string,
): readonly string[] {
  if (!templatePreview) {
    return [];
  }

  if (templatePreview.trimStart().startsWith('HDR|')) {
    return [...RAKUTEN_PIPE_FIELD_NAMES];
  }

  const fieldCandidates = new Set<string>();
  const firstLines = templatePreview.split(/\r?\n/u).slice(0, 20);

  for (const line of firstLines) {
    for (const field of line.split(/\t|,|;|\|/u)) {
      const normalizedField = normalizeLookupKey(field);

      if (normalizedField && normalizedField.length <= 80) {
        fieldCandidates.add(normalizedField);
      }
    }
  }

  return [...fieldCandidates].sort();
}

function classifyRakutenFeedFile(name: string): RakutenLegoFeedFileKind {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes('template')) {
    return 'template';
  }

  if (normalizedName.includes('delta')) {
    return 'delta';
  }

  if (/\.(?:xml|txt)(?:\.gz)?$/iu.test(normalizedName)) {
    return 'full';
  }

  return 'other';
}

function getRakutenFeedFilenameLocaleHints(name: string): readonly string[] {
  const hints = new Set<string>();
  const normalizedName = name.toLowerCase();

  for (const match of normalizedName.matchAll(
    /\b([a-z]{2}[-_][a-z]{2})\b/giu,
  )) {
    hints.add(match[1].replace('_', '-'));
  }

  for (const match of normalizedName.matchAll(
    /(?:^|[^a-z0-9])((?:nl[-_]nl|nl[-_]be|be[-_]nl)(?:[-_]eur)?|nld|netherlands)(?=$|[^a-z0-9])/giu,
  )) {
    hints.add(match[1].replace(/_/gu, '-'));
  }

  for (const country of ['nl', 'be', 'fr', 'de', 'eu']) {
    if (new RegExp(`(?:^|[_\\-.])${country}(?:[_\\-.]|$)`, 'iu').test(name)) {
      hints.add(country);
    }
  }

  return [...hints].sort();
}

function buildFileDiscoveryEntry(
  entry: RakutenSftpListEntry,
): RakutenLegoFeedFileDiscoveryEntry {
  return {
    filename: entry.name,
    kind: classifyRakutenFeedFile(entry.name),
    listPath: entry.listPath,
    localeHints: getRakutenFeedFilenameLocaleHints(entry.name),
    ...(entry.modifyTime
      ? { modifiedAt: new Date(entry.modifyTime).toISOString() }
      : {}),
    modifyTime: entry.modifyTime,
    path: entry.path,
    size: entry.size,
    type: entry.type,
  };
}

function isRelevantRakutenFeedFile(
  entry: RakutenLegoFeedFileDiscoveryEntry,
): boolean {
  return (
    (entry.kind === 'full' || entry.kind === 'delta') &&
    /\.xml\.gz$/iu.test(entry.filename)
  );
}

function getCanonicalRakutenFeedPath(path: string): string {
  return path.replace(/^\/+/u, '');
}

function dedupeRakutenFeedFiles(
  files: readonly RakutenLegoFeedFileDiscoveryEntry[],
): readonly RakutenLegoFeedFileDiscoveryEntry[] {
  const filesByCanonicalPath = new Map<
    string,
    RakutenLegoFeedFileDiscoveryEntry
  >();

  for (const file of files) {
    const key = getCanonicalRakutenFeedPath(file.path);
    const existingFile = filesByCanonicalPath.get(key);

    if (!existingFile || file.path.startsWith('/')) {
      filesByCanonicalPath.set(key, file);
    }
  }

  return [...filesByCanonicalPath.values()].sort((left, right) => {
    const kindOrder = { full: 0, delta: 1, template: 2, other: 3 } as const;

    return (
      kindOrder[left.kind] - kindOrder[right.kind] ||
      left.path.localeCompare(right.path)
    );
  });
}

function hasTemplateCompatibleFields(
  observedFields: ReadonlySet<string>,
  templateSuggestedFields: readonly string[],
): boolean {
  if (templateSuggestedFields.length === 0) {
    return true;
  }

  const compatibleFields = templateSuggestedFields.filter((fieldName) =>
    observedFields.has(normalizeLookupKey(fieldName)),
  );

  return compatibleFields.length >= 5;
}

function getLocaleFieldHintsFromTemplate(
  templatePreview?: string,
): readonly string[] {
  if (!templatePreview) {
    return [];
  }

  return getTemplateSuggestedFields(templatePreview).filter((fieldName) =>
    /(?:country|locale|language|destination|url|murl|market)/iu.test(fieldName),
  );
}

async function auditRakutenLegoFeedFileLocale({
  config,
  createSftpClientFn,
  file,
  maxProducts,
  templateSuggestedFields,
}: {
  config: RakutenLegoFeedConfig;
  createSftpClientFn: () => RakutenSftpClient;
  file: RakutenLegoFeedFileDiscoveryEntry;
  maxProducts: number;
  templateSuggestedFields: readonly string[];
}): Promise<RakutenLegoFeedFileLocaleAudit> {
  const stream = await downloadRakutenFeedXmlStream({
    config,
    createSftpClientFn,
    filename: file.path,
  });
  const currencyCounts: Record<string, number> = {};
  const deeplinkHostCounts: Record<string, number> = {};
  const localeCounts: Record<string, number> = {};
  const murlHostCounts: Record<string, number> = {};
  const observedFields = new Set<string>();
  const sampleDeeplinks: string[] = [];
  let sampledProductCount = 0;

  try {
    for await (const product of parseRakutenLegoProductFeedStream(stream, {
      maxProducts,
    })) {
      sampledProductCount += 1;

      for (const fieldName of Object.keys(product)) {
        observedFields.add(fieldName);
      }

      const row = normalizeRakutenLegoProductToAffiliateFeedRow(product);
      incrementCount(currencyCounts, row.currency);
      incrementCount(deeplinkHostCounts, getUrlHost(row.affiliateDeeplink));
      incrementCount(
        murlHostCounts,
        getRakutenDeeplinkMurl(row.affiliateDeeplink)?.host,
      );
      incrementCount(localeCounts, getLegoUrlLocale(row.affiliateDeeplink));

      if (row.affiliateDeeplink && sampleDeeplinks.length < 3) {
        sampleDeeplinks.push(row.affiliateDeeplink);
      }
    }
  } finally {
    if (typeof stream.destroy === 'function') {
      stream.destroy();
    }
  }

  return {
    currencyCounts,
    deeplinkHostCounts,
    file,
    localeCounts,
    murlHostCounts,
    observedFields: [...observedFields].sort(),
    productCountEstimate: {
      lowerBound: sampledProductCount,
      sampledProductCount,
      stoppedAtSampleLimit: sampledProductCount >= maxProducts,
    },
    sampleDeeplinks,
    templateCompatible: hasTemplateCompatibleFields(
      observedFields,
      templateSuggestedFields,
    ),
  };
}

async function auditRakutenDeeplinkRedirect({
  deeplink,
  productTitle,
  setNumber,
}: {
  deeplink: string;
  productTitle?: string;
  setNumber?: string;
}): Promise<RakutenLegoDeeplinkRedirectAudit> {
  const chain: {
    location?: string;
    status: number;
    url: string;
  }[] = [];
  let currentUrl = deeplink;

  try {
    for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      });
      const location = response.headers.get('location') ?? undefined;

      chain.push({
        ...(location ? { location } : {}),
        status: response.status,
        url: currentUrl,
      });

      if (!location || response.status < 300 || response.status >= 400) {
        break;
      }

      currentUrl = new URL(location, currentUrl).toString();
    }

    return {
      chain,
      finalLocale: getUrlLocale(chain.at(-1)?.location ?? chain.at(-1)?.url),
      initialLocale: getLegoUrlLocale(deeplink),
      productTitle,
      setNumber,
    };
  } catch (error) {
    return {
      chain,
      error: getErrorMessage(error),
      initialLocale: getLegoUrlLocale(deeplink),
      productTitle,
      setNumber,
    };
  }
}

function hasSaleSignal(product: RakutenXmlProduct): boolean {
  return Boolean(
    readProductField(product, [
      'sale_price',
      'saleprice',
      'discount',
      'discount_amount',
      'promotion',
      'is_sale',
      'sale',
    ]),
  );
}

function hasFalsePositiveRisk(product: RakutenXmlProduct): boolean {
  const normalizedText = buildProductTextFields(product)
    .join(' ')
    .toLowerCase();

  return (
    NON_BUILDING_SET_PATTERN.test(normalizedText) ||
    /\b(?:storage|display case|light kit|book|keychain|game)\b/iu.test(
      normalizedText,
    )
  );
}

export async function auditRakutenLegoFeed({
  dependencies,
  options,
}: {
  dependencies?: RakutenLegoFeedSyncDependencies & {
    listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  };
  options?: RakutenLegoFeedAuditOptions;
} = {}): Promise<RakutenLegoFeedAuditReport> {
  const getRakutenLegoFeedConfigFn =
    dependencies?.getRakutenLegoFeedConfigFn ?? getRakutenLegoFeedConfig;
  const createSftpClientFn =
    dependencies?.createSftpClientFn ?? createDefaultSftpClient;
  const listCanonicalCatalogSetsFn =
    dependencies?.listCanonicalCatalogSetsFn ?? listCanonicalCatalogSets;
  const config = getRakutenLegoFeedConfigFn();
  const filename =
    options?.feedFilename?.trim() || resolveRakutenLegoFeedRemotePath(config);
  const templateFilename = options?.templateFilename?.trim();
  const maxProducts = Math.max(1, Math.floor(options?.maxProducts ?? 500));
  const sampleLimit = Math.max(1, Math.floor(options?.sampleLimit ?? 10));
  const [catalogSets, templatePreview] = await Promise.all([
    listCanonicalCatalogSetsFn(),
    templateFilename
      ? downloadRakutenFeedXmlStream({
          config,
          createSftpClientFn,
          filename: templateFilename,
        })
          .then((stream) => readStreamPreview(stream, 8_000))
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  const catalogSetByIdentifier = buildCatalogSetIdLookupForAudit(catalogSets);
  const xmlStream = await downloadRakutenFeedXmlStream({
    config,
    createSftpClientFn,
    filename,
  });
  const observedFields = new Set<string>();
  const matchedSetIds = new Set<string>();
  const detectedSetNumbers = new Set<string>();
  const legoCandidateSetNumbers = new Set<string>();
  const nonSetProductIds = new Set<string>();
  const productIdCounts = new Map<string, number>();
  const setNumberCounts = new Map<string, number>();
  const currencyCounts: Record<string, number> = {};
  const availabilityCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const imageHosts: Record<string, number> = {};
  const deeplinkHosts: Record<string, number> = {};
  const deeplinkLocaleCounts: Record<string, number> = {};
  const deeplinkMurlHostCounts: Record<string, number> = {};
  const queryParamCounts: Record<string, number> = {};
  const excludedByReason: Record<RakutenLegoProductExclusionReason, number> = {
    accessory_or_merchandise: 0,
    invalid_or_missing_deeplink: 0,
    invalid_or_missing_price: 0,
    missing_lego_brand: 0,
    missing_reliable_part_number: 0,
    non_eur_currency: 0,
    service_or_parts: 0,
  };
  const matchedSamples: RakutenLegoDebugSample[] = [];
  const unmatchedSamples: RakutenLegoDebugSample[] = [];
  const nonSetSamples: RakutenLegoDebugSample[] = [];
  const excludedSamples: RakutenLegoExcludedProductSample[] = [];
  const dryRunOfferSamples: RakutenLegoOfferDryRunMapping[] = [];
  const unmatchedFeedProducts: {
    category?: string;
    productId?: string;
    setNumber?: string;
    title?: string;
  }[] = [];
  let parsedProductsCount = 0;
  let legoCandidateCount = 0;
  let missingPriceCount = 0;
  let invalidPriceCount = 0;
  let priceCount = 0;
  let saleSignalCount = 0;
  let imageCount = 0;
  let descriptionCount = 0;
  let eanCount = 0;
  let ageFieldCount = 0;
  let piecesFieldCount = 0;
  let deeplinkMissingCount = 0;
  let affiliateReadyCount = 0;
  let falsePositiveRiskCount = 0;
  let formatMismatchRecoveredCount = 0;
  let textOnlySetNumberCount = 0;

  try {
    for await (const product of parseRakutenLegoProductFeedStream(xmlStream, {
      maxProducts,
    })) {
      parsedProductsCount += 1;

      for (const fieldName of Object.keys(product)) {
        observedFields.add(fieldName);
      }

      const normalizedRow =
        normalizeRakutenLegoProductToAffiliateFeedRow(product);
      const productId = normalizedRow.productId;
      const selectedSetNumber =
        extractRakutenLegoSetNumberFromProductFields(product);
      const humanSetNumber =
        extractRakutenLegoSetNumberFromHumanFields(product);
      const exclusionReason = getRakutenLegoProductExclusionReason(product);
      const matchedCatalogSet = resolveAuditCatalogSet({
        catalogSetByIdentifier,
        setNumber: selectedSetNumber,
      });

      if (!selectedSetNumber && humanSetNumber) {
        textOnlySetNumberCount += 1;
      }

      if (
        selectedSetNumber &&
        matchedCatalogSet &&
        !catalogSetByIdentifier.get(selectedSetNumber)
      ) {
        formatMismatchRecoveredCount += 1;
      }

      if (productId) {
        productIdCounts.set(
          productId,
          (productIdCounts.get(productId) ?? 0) + 1,
        );
      }

      if (selectedSetNumber) {
        detectedSetNumbers.add(selectedSetNumber);
        setNumberCounts.set(
          selectedSetNumber,
          (setNumberCounts.get(selectedSetNumber) ?? 0) + 1,
        );
      }

      incrementCount(currencyCounts, normalizedRow.currency);
      incrementCount(availabilityCounts, normalizedRow.availabilityText);
      incrementCount(categoryCounts, normalizedRow.category);

      const imageHost = getUrlHost(normalizedRow.imageUrl);
      if (imageHost) {
        imageCount += 1;
        incrementCount(imageHosts, imageHost);
      }

      if (normalizedRow.description) {
        descriptionCount += 1;
      }

      if (normalizedRow.ean) {
        eanCount += 1;
      }

      if (
        readProductField(product, [
          'age',
          'age_range',
          'age_range_min',
          'attribute_class_age',
        ])
      ) {
        ageFieldCount += 1;
      }

      if (readProductField(product, ['pieces', 'piece_count', 'num_parts'])) {
        piecesFieldCount += 1;
      }

      const deeplinkHost = getUrlHost(normalizedRow.affiliateDeeplink);
      if (deeplinkHost) {
        incrementCount(deeplinkHosts, deeplinkHost);
        incrementCount(
          deeplinkMurlHostCounts,
          getRakutenDeeplinkMurl(normalizedRow.affiliateDeeplink)?.host,
        );
        incrementCount(
          deeplinkLocaleCounts,
          getLegoUrlLocale(normalizedRow.affiliateDeeplink),
        );
        for (const queryParamName of getUrlQueryParamNames(
          normalizedRow.affiliateDeeplink,
        )) {
          incrementCount(queryParamCounts, queryParamName);
        }

        if (
          /linksynergy|rakuten|click|click\.linksynergy/iu.test(deeplinkHost)
        ) {
          affiliateReadyCount += 1;
        }
      } else {
        deeplinkMissingCount += 1;
      }

      if (hasSaleSignal(product)) {
        saleSignalCount += 1;
      }

      if (!normalizedRow.price) {
        missingPriceCount += 1;
      } else if (parseAuditPriceMinor(normalizedRow.price) === undefined) {
        invalidPriceCount += 1;
      } else {
        priceCount += 1;
      }

      const debugSample = buildDebugSample(product);

      if (!exclusionReason) {
        legoCandidateCount += 1;

        if (selectedSetNumber) {
          legoCandidateSetNumbers.add(selectedSetNumber);
        }

        if (matchedCatalogSet) {
          matchedSetIds.add(matchedCatalogSet.setId);

          if (matchedSamples.length < sampleLimit) {
            matchedSamples.push(debugSample);
          }
        } else if (unmatchedSamples.length < sampleLimit) {
          unmatchedSamples.push(debugSample);
        }

        if (!matchedCatalogSet && unmatchedFeedProducts.length < sampleLimit) {
          unmatchedFeedProducts.push({
            category: normalizedRow.category,
            productId,
            setNumber: selectedSetNumber,
            title: normalizedRow.productTitle,
          });
        }
      } else {
        excludedByReason[exclusionReason] += 1;

        if (productId) {
          nonSetProductIds.add(productId);
        }

        if (nonSetSamples.length < sampleLimit) {
          nonSetSamples.push(debugSample);
        }

        if (excludedSamples.length < sampleLimit) {
          excludedSamples.push({
            productId,
            reason: exclusionReason,
            setNumber: selectedSetNumber ?? humanSetNumber,
            title: normalizedRow.productTitle,
          });
        }
      }

      if (hasFalsePositiveRisk(product)) {
        falsePositiveRiskCount += 1;
      }

      if (!exclusionReason && matchedCatalogSet) {
        dryRunOfferSamples.push({
          availability: normalizedRow.availabilityText,
          currency: normalizedRow.currency,
          imageUrl: normalizedRow.imageUrl,
          merchantSlug: 'rakuten-lego-eu',
          price:
            normalizedRow.price === undefined
              ? undefined
              : String(normalizedRow.price),
          productId: normalizedRow.productId,
          productTitle: normalizedRow.productTitle,
          productUrl: normalizedRow.affiliateDeeplink,
          setId: matchedCatalogSet.setId,
          setNumber: selectedSetNumber ?? matchedCatalogSet.setId,
          source: 'rakuten-lego-eu',
        });
      }
    }
  } finally {
    if (typeof xmlStream.destroy === 'function') {
      xmlStream.destroy();
    }
  }

  const risks = [
    'Treat the feed as an offer source first; do not replace Rebrickable identity data.',
    ...(falsePositiveRiskCount > 0
      ? [
          'Some product titles contain accessory/non-set signals; strict filtering must stay enabled.',
        ]
      : []),
    ...(unmatchedFeedProducts.length > 0
      ? [
          'Some LEGO feed set numbers do not exist in the current catalog sample.',
        ]
      : []),
    ...(Object.keys(currencyCounts).some((currency) => currency !== 'EUR')
      ? ['Non-EUR or missing currency values appear in the sample.']
      : []),
    ...(deeplinkMissingCount > 0
      ? ['Some products have no parseable deeplink.']
      : []),
  ];
  const duplicateSetNumbers = [...setNumberCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([setNumber, count]) => ({
      count,
      setNumber,
    }));
  const unmatchedReliableCandidateCount =
    legoCandidateCount - matchedSetIds.size;
  const localeAcceptable =
    Object.keys(deeplinkLocaleCounts).length === 1 &&
    Boolean(deeplinkLocaleCounts['nl-nl']);
  const currencyAcceptable =
    Object.keys(currencyCounts).length === 1 && Boolean(currencyCounts.EUR);
  const matchPrecisionAcceptable =
    dryRunOfferSamples.length > 0 &&
    duplicateSetNumbers.length === 0 &&
    invalidPriceCount === 0 &&
    deeplinkMissingCount === 0 &&
    currencyAcceptable;
  const blockers = [
    ...(localeAcceptable
      ? []
      : [
          `Deeplink locale is not NL-ready: observed locales ${
            Object.entries(deeplinkLocaleCounts)
              .map(([locale, count]) => `${locale}=${count}`)
              .join(', ') || 'none'
          }.`,
        ]),
    ...(matchPrecisionAcceptable
      ? []
      : [
          'Exact-match offer mapping is not rollout-ready yet: verify matched offers, duplicate set numbers, prices, currency and deeplinks.',
        ]),
  ];
  const warnings = [
    ...(unmatchedReliableCandidateCount > 0
      ? [
          `Coverage is incomplete: ${matchedSetIds.size}/${legoCandidateCount} reliable candidates matched the current catalog; unmatched candidates should be logged only in Phase 1.`,
        ]
      : []),
    ...(falsePositiveRiskCount > 0
      ? [
          `Non-set/accessory risk remains visible in ${falsePositiveRiskCount} sampled products; keep audit gates strict before enabling writes.`,
        ]
      : []),
  ];
  const gates = {
    currencyAcceptable,
    importWithoutCatalogMutation: true,
    localeAcceptable,
    matchPrecisionAcceptable,
    matchedOffersLookLogical: dryRunOfferSamples.length > 0,
    nonSetFilteringReliable:
      excludedByReason.accessory_or_merchandise +
        excludedByReason.service_or_parts >
      0,
    observabilityPresent: true,
  };

  return {
    assetMetadata: {
      ageFieldCount,
      categoryCounts,
      descriptionCount,
      eanCount,
      imageCount,
      imageHosts,
      piecesFieldCount,
    },
    deeplink: {
      affiliateReadyCount,
      hostCounts: deeplinkHosts,
      localeCounts: deeplinkLocaleCounts,
      missingCount: deeplinkMissingCount,
      murlHostCounts: deeplinkMurlHostCounts,
      queryParamCounts,
      sampleHosts: Object.keys(deeplinkHosts).slice(0, sampleLimit),
    },
    feed: {
      filename,
      maxProducts,
      ...(templateFilename ? { templateFilename } : {}),
    },
    offerQuality: {
      availabilityCounts,
      currencyCounts,
      duplicateProductIdCount: [...productIdCounts.values()].filter(
        (count) => count > 1,
      ).length,
      duplicateSetNumberCount: [...setNumberCounts.values()].filter(
        (count) => count > 1,
      ).length,
      invalidPriceCount,
      missingPriceCount,
      priceCount,
      saleSignalCount,
    },
    phaseOneReadiness: {
      blockers,
      dryRunMappedOfferCount: dryRunOfferSamples.length,
      gates,
      recommendation:
        blockers.length === 0 && Object.values(gates).every(Boolean)
          ? 'ready_with_caution'
          : 'blocked',
      warnings,
    },
    parsedProductsCount,
    risks,
    samples: {
      dryRunOffers: dryRunOfferSamples.slice(0, sampleLimit),
      excluded: excludedSamples,
      matched: matchedSamples,
      nonSet: nonSetSamples,
      unmatched: unmatchedSamples,
    },
    schema: {
      observedFields: [...observedFields].sort(),
      ...(templatePreview ? { templatePreview } : {}),
      templateSuggestedFields: getTemplateSuggestedFields(templatePreview),
    },
    setMatching: {
      catalogSetCount: catalogSets.length,
      catalogSetsWithoutLegoOfferSample: catalogSets
        .filter((catalogSet) => !matchedSetIds.has(catalogSet.setId))
        .slice(0, sampleLimit)
        .map((catalogSet) => `${catalogSet.setId} ${catalogSet.name}`),
      detectedSetNumberCount: detectedSetNumbers.size,
      duplicateSetNumbers: duplicateSetNumbers.slice(0, sampleLimit),
      excludedByReason,
      falsePositiveRiskCount,
      legoCandidateCount,
      matchQuality: {
        accessoryOrNonSetCandidateCount:
          excludedByReason.accessory_or_merchandise +
          excludedByReason.service_or_parts,
        catalogCoverageGapCount: unmatchedReliableCandidateCount,
        duplicateFeedSetNumberCount: duplicateSetNumbers.length,
        formatMismatchRecoveredCount,
        reliablePartNumberCandidateCount: legoCandidateCount,
        textOnlySetNumberCount,
        unmatchedReliableCandidateCount,
      },
      matchedCatalogCount: matchedSetIds.size,
      nonSetProductCount: nonSetProductIds.size,
      unmatchedLegoFeedProducts: unmatchedFeedProducts,
    },
  };
}

export async function auditRakutenLegoFeedDiscovery({
  dependencies,
  options,
}: {
  dependencies?: RakutenLegoFeedSyncDependencies;
  options?: RakutenLegoFeedDiscoveryAuditOptions;
} = {}): Promise<RakutenLegoFeedDiscoveryAuditReport> {
  const getRakutenLegoFeedConfigFn =
    dependencies?.getRakutenLegoFeedConfigFn ?? getRakutenLegoFeedConfig;
  const createSftpClientFn =
    dependencies?.createSftpClientFn ?? createDefaultSftpClient;
  const config = getRakutenLegoFeedConfigFn();
  const maxProductsPerFile = Math.max(
    1,
    Math.floor(options?.maxProductsPerFile ?? 50),
  );
  const redirectSampleLimit = Math.max(
    0,
    Math.floor(options?.redirectSampleLimit ?? 3),
  );
  const listing = await listRakutenLegoFeedFiles({
    dependencies: {
      createSftpClientFn,
      getRakutenLegoFeedConfigFn,
    },
  });
  const allFilesByPath = new Map<string, RakutenLegoFeedFileDiscoveryEntry>();

  for (const entry of listing.entries) {
    allFilesByPath.set(entry.path, buildFileDiscoveryEntry(entry));
  }

  const allFiles = [...allFilesByPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const groups = allFiles.reduce<Record<RakutenLegoFeedFileKind, number>>(
    (counts, file) => {
      counts[file.kind] += 1;

      return counts;
    },
    {
      delta: 0,
      full: 0,
      other: 0,
      template: 0,
    },
  );
  const relevantFeedFiles = dedupeRakutenFeedFiles(
    allFiles.filter(isRelevantRakutenFeedFile),
  );
  const templateFile =
    (options?.templateFilename
      ? allFiles.find((file) => file.path === options.templateFilename)
      : undefined) ??
    dedupeRakutenFeedFiles(
      allFiles.filter(
        (file) =>
          file.kind === 'template' && /\.txt\.gz$/iu.test(file.filename),
      ),
    ).find((file) => !file.filename.toLowerCase().includes('delta')) ??
    dedupeRakutenFeedFiles(
      allFiles.filter(
        (file) =>
          file.kind === 'template' && /\.txt\.gz$/iu.test(file.filename),
      ),
    )[0];
  const templatePreview = templateFile
    ? await downloadRakutenFeedXmlStream({
        config,
        createSftpClientFn,
        filename: templateFile.path,
      })
        .then((stream) => readStreamPreview(stream, 8_000))
        .catch(() => undefined)
    : undefined;
  const templateSuggestedFields = getTemplateSuggestedFields(templatePreview);
  const perFileAudits: RakutenLegoFeedFileLocaleAudit[] = [];

  for (const file of relevantFeedFiles) {
    perFileAudits.push(
      await auditRakutenLegoFeedFileLocale({
        config,
        createSftpClientFn,
        file,
        maxProducts: maxProductsPerFile,
        templateSuggestedFields,
      }),
    );
  }

  const redirectAudits: RakutenLegoDeeplinkRedirectAudit[] = [];
  const redirectCandidates = perFileAudits
    .flatMap((audit) => audit.sampleDeeplinks)
    .slice(0, redirectSampleLimit);

  for (const deeplink of redirectCandidates) {
    redirectAudits.push(
      await auditRakutenDeeplinkRedirect({
        deeplink,
      }),
    );
  }

  const likelyNlFeed = perFileAudits.some(
    (audit) => (audit.localeCounts['nl-nl'] ?? 0) > 0,
  );
  const recommendedFile = perFileAudits.find(
    (audit) =>
      audit.file.kind === 'full' &&
      (audit.localeCounts['nl-nl'] ?? 0) > 0 &&
      (audit.currencyCounts.EUR ?? 0) > 0,
  )?.file.path;
  const allLocales = new Set(
    perFileAudits.flatMap((audit) => Object.keys(audit.localeCounts)),
  );

  return {
    conclusion: {
      likelyNlFeedAvailable: likelyNlFeed,
      ...(recommendedFile
        ? { phaseOneFileRecommendation: recommendedFile }
        : {}),
      summary: likelyNlFeed
        ? 'At least one visible feed sample contains nl-nl LEGO URLs.'
        : `No visible sampled feed contains nl-nl LEGO URLs. Observed locales: ${
            [...allLocales].sort().join(', ') || 'none'
          }.`,
    },
    files: {
      all: allFiles,
      failures: listing.failures,
      groups,
      relevantFeedFiles: relevantFeedFiles.map((file) => file.path),
      successfulPaths: listing.successfulPaths,
    },
    perFileAudits,
    redirectAudits,
    template: {
      filename: templateFile?.path,
      hasCountryOrLanguageFields:
        getLocaleFieldHintsFromTemplate(templatePreview).length > 0,
      localeFieldHints: getLocaleFieldHintsFromTemplate(templatePreview),
      ...(templatePreview ? { preview: templatePreview } : {}),
      suggestedFields: templateSuggestedFields,
    },
  };
}

function buildDebugSample(product: RakutenXmlProduct): RakutenLegoDebugSample {
  return {
    normalizedRow: normalizeRakutenLegoProductToAffiliateFeedRow(product),
    rawAvailability: readRakutenAvailabilityText(product),
    rawCurrency: readRakutenCurrency(product),
    rawPrice: readProductField(product, [
      'price',
      'price_retail',
      'retail',
      'sale_price',
      'saleprice',
    ]),
    rawProductId: readProductField(product, [
      'product_id',
      'productid',
      'sku',
      'merchant_sku',
      'rakuten_product_id',
      'id',
    ]),
    rawTitle: readProductField(product, [
      'product_name',
      'productname',
      'name',
      'title',
      'product_title',
      'producttitle',
    ]),
    selectedLegoSetNumber:
      extractRakutenLegoSetNumberFromProductFields(product),
    setNumberCandidateFields: buildHumanSetNumberCandidateFields(product),
  };
}

function countNonNlLocales(
  localeCounts: Readonly<Record<string, number>>,
): number {
  return Object.entries(localeCounts).reduce((count, [locale, localeCount]) => {
    return locale === RAKUTEN_LEGO_NL_LOCALE ? count : count + localeCount;
  }, 0);
}

function calculateRatio({
  denominator,
  numerator,
}: {
  denominator: number;
  numerator: number;
}): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function assertRakutenLegoPhaseOneCronGuards({
  enforceMatchRate,
  fetchedProductCount,
  importResult,
  parseFailureCount,
  phaseOneImportSummary,
}: {
  enforceMatchRate: boolean;
  fetchedProductCount: number;
  importResult: AlternateAffiliateFeedImportResult;
  parseFailureCount: number;
  phaseOneImportSummary: RakutenLegoPhaseOneImportSummary;
}): void {
  const failures: string[] = [];
  const localeTolerance = Math.max(
    RAKUTEN_LEGO_MAX_NON_NL_LOCALE_COUNT,
    Math.floor(fetchedProductCount * RAKUTEN_LEGO_MAX_NON_NL_LOCALE_RATIO),
  );
  const parseFailureTolerance = Math.max(
    RAKUTEN_LEGO_MAX_PARSE_FAILURE_COUNT,
    Math.floor(fetchedProductCount * RAKUTEN_LEGO_MAX_PARSE_FAILURE_RATIO),
  );

  if (fetchedProductCount <= 0) {
    failures.push('empty_feed');
  }

  if (phaseOneImportSummary.guard.nonNlLocaleCount > localeTolerance) {
    failures.push(
      `non_nl_locale_count=${phaseOneImportSummary.guard.nonNlLocaleCount} tolerance=${localeTolerance}`,
    );
  }

  if (phaseOneImportSummary.guard.nonEurCurrencyCount > 0) {
    failures.push(
      `non_${RAKUTEN_LEGO_EXPECTED_CURRENCY.toLowerCase()}_currency_count=${phaseOneImportSummary.guard.nonEurCurrencyCount}`,
    );
  }

  if (phaseOneImportSummary.guard.missingDeeplinkCount > 0) {
    failures.push(
      `missing_deeplink_count=${phaseOneImportSummary.guard.missingDeeplinkCount}`,
    );
  }

  if (parseFailureCount > parseFailureTolerance) {
    failures.push(
      `parse_failure_count=${parseFailureCount} tolerance=${parseFailureTolerance}`,
    );
  }

  if (
    enforceMatchRate &&
    phaseOneImportSummary.eligibleImportRowCount > 0 &&
    phaseOneImportSummary.guard.matchRate <
      RAKUTEN_LEGO_MIN_PHASE_ONE_MATCH_RATE
  ) {
    failures.push(
      `match_rate=${phaseOneImportSummary.guard.matchRate.toFixed(3)} min=${RAKUTEN_LEGO_MIN_PHASE_ONE_MATCH_RATE}`,
    );
  }

  if (
    enforceMatchRate &&
    phaseOneImportSummary.eligibleImportRowCount > 0 &&
    importResult.matchedCatalogSetCount <= 0
  ) {
    failures.push('no_matched_catalog_sets');
  }

  if (failures.length > 0) {
    throw new Error(
      `Rakuten LEGO Phase 1 cron guard failed: ${failures.join(', ')}.`,
    );
  }
}

export async function syncRakutenLegoFeed({
  dependencies,
  options,
}: {
  dependencies?: RakutenLegoFeedSyncDependencies;
  options?: RakutenLegoFeedSyncOptions;
} = {}): Promise<RakutenLegoFeedSyncResult> {
  const getRakutenLegoFeedConfigFn =
    dependencies?.getRakutenLegoFeedConfigFn ?? getRakutenLegoFeedConfig;
  const createSftpClientFn =
    dependencies?.createSftpClientFn ?? createDefaultSftpClient;
  const importAffiliateFeedRowsForMerchantFn =
    dependencies?.importAffiliateFeedRowsForMerchantFn ??
    importAffiliateFeedRowsForMerchant;
  const config = getRakutenLegoFeedConfigFn();

  if (config.merchantSlug !== RAKUTEN_LEGO_PHASE_ONE_MERCHANT_SLUG) {
    throw new Error(
      `Rakuten LEGO Phase 1 requires merchant slug ${RAKUTEN_LEGO_PHASE_ONE_MERCHANT_SLUG}; received ${config.merchantSlug}.`,
    );
  }

  if (!options?.dryRun && !config.enablePhaseOneImport) {
    throw new Error(
      'Rakuten LEGO Phase 1 import is disabled. Set RAKUTEN_LEGO_PHASE1_IMPORT_ENABLED=true to allow offer writes.',
    );
  }

  const filename = resolveRakutenLegoFeedRemotePath(config);
  const xmlStream = await downloadRakutenFeedXmlStream({
    config,
    createSftpClientFn,
    filename,
  });
  const rows: AlternateAffiliateFeedRow[] = [];
  const debugSamples: RakutenLegoDebugSample[] = [];
  const importExcludedByReason: Record<string, number> = {};
  const importAvailabilityCounts: Record<string, number> = {};
  const importLocaleCounts: Record<string, number> = {};
  const importSetNumberCounts = new Map<string, number>();
  let fetchedProductCount = 0;
  let legoCandidateCount = 0;
  let parseFailureCount = 0;

  for await (const product of parseRakutenLegoProductFeedStream(xmlStream, {
    maxProducts: options?.maxProducts,
    onParseFailure: () => {
      parseFailureCount += 1;
    },
  })) {
    fetchedProductCount += 1;

    if (isStrictRakutenLegoSetCandidate(product)) {
      legoCandidateCount += 1;
    }

    if (
      options?.debugSamples &&
      options.debugSamples > 0 &&
      debugSamples.length < options.debugSamples
    ) {
      debugSamples.push(buildDebugSample(product));
    }

    const normalizedRow =
      normalizeRakutenLegoProductToAffiliateFeedRow(product);
    const phaseOneExclusionReason =
      getRakutenLegoPhaseOneImportExclusionReason(product);

    incrementCount(importAvailabilityCounts, normalizedRow.availabilityText);
    incrementCount(
      importLocaleCounts,
      getLegoUrlLocale(normalizedRow.affiliateDeeplink),
    );

    if (phaseOneExclusionReason) {
      incrementCount(importExcludedByReason, phaseOneExclusionReason);
      continue;
    }

    if (normalizedRow.legoSetNumber) {
      importSetNumberCounts.set(
        normalizedRow.legoSetNumber,
        (importSetNumberCounts.get(normalizedRow.legoSetNumber) ?? 0) + 1,
      );
    }

    rows.push(normalizedRow);
  }

  const duplicateSetNumbers = [...importSetNumberCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([setNumber, count]) => ({
      count,
      setNumber,
    }));
  const phaseOneImportSummary: RakutenLegoPhaseOneImportSummary = {
    availabilityCounts: importAvailabilityCounts,
    duplicateSetNumberCount: duplicateSetNumbers.length,
    duplicateSetNumbers: duplicateSetNumbers.slice(0, 20),
    eligibleImportRowCount: rows.length,
    excludedByReason: importExcludedByReason,
    guard: {
      matchRate: 0,
      matchedCatalogSetCount: 0,
      missingDeeplinkCount:
        importExcludedByReason['invalid_or_missing_deeplink'] ?? 0,
      nonEurCurrencyCount: importExcludedByReason['non_eur_currency'] ?? 0,
      nonNlLocaleCount: countNonNlLocales(importLocaleCounts),
      parseFailureCount,
    },
    localeCounts: importLocaleCounts,
    sampleEligibleSetNumbers: rows
      .flatMap((row) => (row.legoSetNumber ? [row.legoSetNumber] : []))
      .slice(0, 20),
  };

  const importPayload: {
    merchant: AffiliateFeedMerchantConfig;
    options: AlternateAffiliateFeedImportOptions;
    rows: AlternateAffiliateFeedRow[];
  } = {
    merchant: {
      affiliateNetwork: 'Rakuten',
      name: config.merchantName,
      notes: RAKUTEN_LEGO_MERCHANT_NOTES,
      slug: config.merchantSlug,
      sourceType: 'affiliate',
    },
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      dryRun: true,
      persistDiscoveredSets: options?.persistDiscoveredSets ?? false,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    },
    rows,
  };
  const preflightImportResult =
    await importAffiliateFeedRowsForMerchantFn(importPayload);
  const matchRate = calculateRatio({
    denominator: phaseOneImportSummary.eligibleImportRowCount,
    numerator: preflightImportResult.matchedCatalogSetCount,
  });

  phaseOneImportSummary.guard = {
    ...phaseOneImportSummary.guard,
    matchRate,
    matchedCatalogSetCount: preflightImportResult.matchedCatalogSetCount,
  };
  assertRakutenLegoPhaseOneCronGuards({
    enforceMatchRate: !options?.collectUnmatchedDebug,
    fetchedProductCount,
    importResult: preflightImportResult,
    parseFailureCount,
    phaseOneImportSummary,
  });

  const importResult = options?.dryRun
    ? preflightImportResult
    : await importAffiliateFeedRowsForMerchantFn({
        ...importPayload,
        options: {
          ...importPayload.options,
          dryRun: false,
        },
      });
  const debugInfo =
    options?.debugSamples && options.debugSamples > 0
      ? {
          fetchedProductCount,
          legoCandidateCount,
          sampleCount: debugSamples.length,
          samples: debugSamples,
        }
      : undefined;

  return {
    ...importResult,
    debugInfo,
    fetchedProductCount,
    legoCandidateCount,
    merchantName: config.merchantName,
    merchantSlug: config.merchantSlug,
    normalizedRowCount: rows.length,
    parseFailureCount,
    preflightImportSummary: options?.dryRun
      ? undefined
      : {
          matchedCatalogSetCount: preflightImportResult.matchedCatalogSetCount,
          matchRate,
          skippedUnmatchedSetCount:
            preflightImportResult.skippedUnmatchedSetCount,
        },
    phaseOneImportSummary,
  };
}
