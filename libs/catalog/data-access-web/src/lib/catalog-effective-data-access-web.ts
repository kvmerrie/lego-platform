import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { catalogSetOverlays } from '@lego-platform/catalog/data-access';
import type {
  CatalogCanonicalSet,
  CatalogBrowseThemeGroup,
  CatalogCollectionLandingPageConfig,
  CatalogCollectionLandingPageSortKey,
  CatalogHomepageSetCard,
  CatalogProductFeature,
  CatalogSearchMatch,
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeDirectoryItem,
  CatalogThemeLandingPage,
  CatalogThemeSearchMatch,
  CatalogThemeSnapshot,
  CatalogThemeVisual,
} from '@lego-platform/catalog/util';
import {
  buildCatalogThemeSlug,
  CATALOG_BROWSE_PAGE_SIZE,
  catalogDiscoverDealCandidateIds,
  catalogDiscoverSetOrder,
  catalogHomepageDealCandidateIds,
  catalogHomepageFeaturedSetIds,
  getCanonicalCatalogSetId,
  getCatalogReleaseYear,
  getCatalogThemeDisplayName,
  isCatalogBrowsablePrimaryTheme,
  listCatalogSetCardSearchMatches,
  normalizeCatalogAsciiText,
  resolveCatalogReleaseDatePrecision,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
  sortCanonicalCatalogSets,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import {
  buildCatalogCurrentOfferSummariesApiPath,
  buildCatalogDiscoverySignalsApiPath,
  buildCatalogSetLiveOffersApiPath,
  cacheTags,
  classifyCommerceCommercialUnitType,
  canStrategicManualOfferBeatProductionFeed,
  commerceProductionFeedMerchantSlugs,
  compareCommerceCommercialUnitPreference,
  type CommerceCommercialUnitType,
  getBrowserSupabaseConfig,
  getCommerceCommercialUnitComparisonGroup,
  getCommerceMerchantReliabilityTier,
  isCommerceCommercialUnitComparableForDeals,
  isCommerceMerchantProductionFeed,
  getMissingBrowserSupabaseEnvKeys,
  getMissingServerSupabaseEnvKeys,
  getServerSupabaseConfig,
  getServerSupabaseUrlSource,
  getRuntimeBaseUrl,
  hasBrowserSupabaseConfig,
  hasServerSupabaseConfig,
  resolvePublicMerchantDisplayName,
} from '@lego-platform/shared/config';

const CATALOG_SETS_TABLE = 'catalog_sets';
const CATALOG_SET_MINIFIG_SUMMARIES_TABLE = 'catalog_set_minifig_summaries';
const CATALOG_SET_SOURCE_METADATA_TABLE = 'catalog_set_source_metadata';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const CATALOG_THEME_SUMMARIES_TABLE = 'catalog_theme_summaries';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE =
  'commerce_current_offer_snapshots';
const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
const PRICING_DAILY_SET_HISTORY_TABLE = 'pricing_daily_set_history';
const DUTCH_REGION_CODE = 'NL';
const EURO_CURRENCY_CODE = 'EUR';
const NEW_OFFER_CONDITION = 'new';
const CATALOG_DISCOVERY_HTTP_BATCH_SIZE = 50;
const CATALOG_DISCOVERY_PRICE_HISTORY_ROWS_PER_SET = 8;
const CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT = 300;
const CATALOG_CURRENT_OFFER_PAGE_SIZE = 1000;
const CATALOG_CURRENT_OFFER_IN_FILTER_PAGE_SIZE = 100;
const CATALOG_CURRENT_OFFER_HTTP_BATCH_SIZE = 50;
const CATALOG_CURRENT_OFFER_MERCHANDISING_CANDIDATE_LIMIT = 240;
const CATALOG_CURRENT_OFFER_MERCHANDISING_CANDIDATE_LOOKUP_MULTIPLIER = 8;
const CATALOG_CURRENT_OFFER_MERCHANDISING_CANDIDATE_LOOKUP_LIMIT = 2_000;
const CURRENT_OFFER_SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const LEGO_NL_DISPLAY_TITLE_SOURCE = 'rakuten-lego-eu' as const;
const LEGO_NL_DISPLAY_TITLE_LOCALE = 'nl-NL';
const LEGO_NL_DISPLAY_TITLE_MATCH_CONFIDENCE = 'exact_set_number';
const LEGO_NL_DISPLAY_TITLE_POLICY = 'metadata_only_pending_audit';

function chunkCatalogValues<T>(values: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}
const CATALOG_PUBLIC_DEFAULT_PAGE_SIZE = 96;
const CATALOG_PUBLIC_RAIL_CANDIDATE_LIMIT = 240;
const CATALOG_PUBLIC_SEARCH_CANDIDATE_LIMIT = 120;
const CATALOG_PUBLIC_SEARCH_MATCH_LIMIT = 500;
const CATALOG_PUBLIC_THEME_DIRECTORY_LIMIT = 100;
const CATALOG_THEME_REPRESENTATIVE_SET_LIMIT = 8;
const CATALOG_SIMILAR_SET_CANDIDATE_CACHE_TTL_MS = 5 * 60 * 1_000;
const CATALOG_SET_SELECT_COLUMNS =
  'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at';
const PRIMARY_CATALOG_MERCHANT_SLUGS = commerceProductionFeedMerchantSlugs;
const genericCatalogThemeMomentum =
  'Nieuw in Brickhunt. We bouwen hier nu de eerste prijsvergelijkingen op.';
const catalogSetOverlayByCanonicalId = new Map(
  catalogSetOverlays.map((catalogSetOverlay) => [
    catalogSetOverlay.canonicalId,
    catalogSetOverlay,
  ]),
);

function listCatalogOverlaySetIdsByStatus(
  statuses: NonNullable<
    CatalogCollectionLandingPageConfig['filters']['setStatuses']
  >,
): string[] {
  const statusSet = new Set(statuses);

  return catalogSetOverlays.flatMap((catalogSetOverlay) =>
    catalogSetOverlay.setStatus && statusSet.has(catalogSetOverlay.setStatus)
      ? [catalogSetOverlay.canonicalId]
      : [],
  );
}

type CatalogSupabaseClient = Pick<SupabaseClient, 'from'>;
type CatalogAbortableQuery<T> = T & {
  abortSignal?: (signal: AbortSignal) => T;
};
const catalogSimilarSetCandidatesByThemeSlug = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<CatalogHomepageSetCard[]>;
  }
>();

const CATALOG_THEME_PAGE_PERF_DEFAULT_SLOW_THRESHOLD_MS = 500;
const CATALOG_THEME_PAGE_PERF_DEFAULT_LOG_LIMIT = 12;
let catalogThemePagePerfLogCount = 0;

function isCatalogThemePagePerfDebugEnabled(): boolean {
  return process.env['DEBUG_THEME_PAGE_PERF'] === 'true';
}

function applyCatalogAbortSignal<T>(query: T, signal?: AbortSignal): T {
  if (!signal) {
    return query;
  }

  const abortableQuery = query as CatalogAbortableQuery<T>;

  return typeof abortableQuery.abortSignal === 'function'
    ? abortableQuery.abortSignal(signal)
    : query;
}

function throwIfCatalogReadAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Catalog read aborted.', 'AbortError');
  }
}

function isCatalogThemePagePerfVerboseEnabled(): boolean {
  return process.env['DEBUG_THEME_PAGE_PERF_VERBOSE'] === 'true';
}

function getCatalogThemePagePerfNumber({
  defaultValue,
  envName,
}: {
  defaultValue: number;
  envName: string;
}): number {
  const value = Number(process.env[envName]);

  return Number.isFinite(value) && value >= 0 ? value : defaultValue;
}

function shouldLogCatalogThemePagePerf({
  durationMs,
  status,
}: {
  durationMs: number;
  status: 'ok' | 'error';
}): boolean {
  if (!isCatalogThemePagePerfDebugEnabled()) {
    return false;
  }

  if (isCatalogThemePagePerfVerboseEnabled()) {
    return true;
  }

  if (status !== 'ok') {
    return true;
  }

  return (
    durationMs >=
    getCatalogThemePagePerfNumber({
      defaultValue: CATALOG_THEME_PAGE_PERF_DEFAULT_SLOW_THRESHOLD_MS,
      envName: 'DEBUG_THEME_PAGE_PERF_SLOW_MS',
    })
  );
}

async function measureCatalogThemePageQuery<T>({
  label,
  load,
  slug,
}: {
  label: string;
  load: () => Promise<T>;
  slug: string;
}): Promise<T> {
  if (!isCatalogThemePagePerfDebugEnabled()) {
    return load();
  }

  const startedAt = Date.now();

  try {
    const result = await load();
    const durationMs = Date.now() - startedAt;

    if (shouldLogCatalogThemePagePerf({ durationMs, status: 'ok' })) {
      const logLimit = getCatalogThemePagePerfNumber({
        defaultValue: CATALOG_THEME_PAGE_PERF_DEFAULT_LOG_LIMIT,
        envName: 'DEBUG_THEME_PAGE_PERF_LOG_LIMIT',
      });

      if (catalogThemePagePerfLogCount < logLimit) {
        catalogThemePagePerfLogCount += 1;
        console.info('[theme-page-perf]', {
          durationMs,
          label,
          slug,
          status: 'ok',
        });
      }
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (shouldLogCatalogThemePagePerf({ durationMs, status: 'error' })) {
      console.warn('[theme-page-perf]', {
        durationMs,
        label,
        slug,
        status: 'error',
      });
    }

    throw error;
  }
}

interface CatalogSetRow {
  created_at: string;
  image_url: string | null;
  name: string;
  piece_count: number;
  primary_theme_id: string | null;
  release_date: string | null;
  release_date_precision: string | null;
  release_year: number;
  set_id: string;
  slug: string;
  source: 'rebrickable';
  source_theme_id: string | null;
  source_set_number: string;
  status: 'active';
  updated_at: string;
}

interface CatalogSetSourceMetadataRow {
  catalog_set_id: string;
  metadata_json: unknown;
}

interface CatalogSetMinifigSummaryRow {
  minifig_count: number;
  set_id: string;
}

interface CatalogSourceThemeRow {
  id: string;
  parent_source_theme_id?: string | null;
  source_theme_name: string;
}

interface CatalogThemeRow {
  display_name: string;
  id: string;
  is_public?: boolean;
  public_accent_color?: string | null;
  public_description?: string | null;
  public_display_name?: string | null;
  public_hero_text_color?: string | null;
  public_homepage_order?: number | null;
  public_image_url?: string | null;
  public_logo_url?: string | null;
  public_order?: number | null;
  public_surface_color?: string | null;
  public_surface_text_color?: string | null;
  slug?: string;
  status?: string;
}

function isPublicCatalogThemeRow(
  catalogTheme: CatalogThemeRow | null | undefined,
): catalogTheme is CatalogThemeRow {
  return (
    catalogTheme != null &&
    catalogTheme.is_public === true &&
    catalogTheme.status === 'active' &&
    Boolean(catalogTheme.slug)
  );
}

function isGenericPublicCatalogThemeRow(
  catalogTheme: CatalogThemeRow,
): boolean {
  return new Set(['icons', 'other', 'theme:icons', 'theme:other']).has(
    catalogTheme.id,
  );
}

function resolvePublicCatalogThemeRowCandidate(
  candidatePrimaryThemeIds: readonly string[],
  primaryThemeById: ReadonlyMap<string, CatalogThemeRow>,
): CatalogThemeRow | undefined {
  const publicThemeCandidates = [
    ...new Map(
      candidatePrimaryThemeIds
        .map((themeId) => primaryThemeById.get(themeId))
        .filter(isPublicCatalogThemeRow)
        .map((catalogTheme) => [catalogTheme.id, catalogTheme] as const),
    ).values(),
  ];

  return (
    publicThemeCandidates.find(
      (catalogTheme) => !isGenericPublicCatalogThemeRow(catalogTheme),
    ) ?? publicThemeCandidates[0]
  );
}

interface CatalogThemeMappingRow {
  primary_theme_id: string;
  source_theme_id: string;
}

interface CatalogThemeSummaryRow {
  active_set_count: number;
  representative_image_url?: string | null;
  representative_set_id?: string | null;
  theme_id: string;
  updated_at?: string;
}

interface CatalogCommerceMerchantRow {
  id: string;
  is_active: boolean;
  name: string;
  slug: string;
}

interface CatalogCommerceOfferLatestRow {
  availability: string | null;
  currency_code: string | null;
  fetched_at?: string | null;
  fetch_status: string;
  observed_at: string | null;
  offer_seed_id: string;
  price_minor: number | null;
  updated_at: string;
}

interface CatalogCommerceOfferSeedRow {
  id: string;
  is_active: boolean;
  merchant_id: string;
  notes?: string | null;
  product_url: string;
  set_id: string;
  validation_status: string;
}

interface CatalogCommerceCurrentOfferSnapshotOfferRow {
  availability?: string | null;
  checkedAt?: string | null;
  commercialUnitType?: CommerceCommercialUnitType | null;
  condition?: string | null;
  currency?: string | null;
  market?: string | null;
  merchantName?: string | null;
  merchantSlug?: string | null;
  priceMinor?: number | null;
  setId?: string | null;
  url?: string | null;
}

interface CatalogCommerceCurrentOfferSnapshotRow {
  best_availability: string | null;
  best_checked_at: string | null;
  best_commercial_unit_type: CommerceCommercialUnitType | null;
  best_merchant_name: string | null;
  best_merchant_slug: string | null;
  best_price_minor: number | null;
  best_product_url: string | null;
  computed_at: string | null;
  condition: string | null;
  currency_code: string | null;
  offer_count: number | null;
  offers: unknown;
  region_code: string | null;
  set_id: string;
}

interface CatalogPriceHistoryRow {
  recorded_on: string;
  reference_price_minor: number | null;
  set_id: string;
}

export interface CatalogResolvedOffer {
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  checkedAt: string;
  condition: 'new';
  currency: 'EUR';
  commercialUnitType?: CommerceCommercialUnitType;
  market: 'NL';
  merchant: 'amazon' | 'bol' | 'lego' | 'other';
  merchantName: string;
  priceCents: number;
  setId: string;
  url: string;
}

export interface CatalogRuntimeOffer extends CatalogResolvedOffer {
  merchantSlug: string;
}

export interface CatalogCurrentOfferSummary {
  bestOffer?: CatalogResolvedOffer;
  offers: readonly CatalogResolvedOffer[];
  setId: string;
}

interface CatalogCurrentOfferSummaryRecord extends CatalogCurrentOfferSummary {
  bestOffer?: CatalogRuntimeOffer;
  offers: readonly CatalogRuntimeOffer[];
}

export interface CatalogPrimaryOfferAvailabilityState {
  latestPrimaryOfferCheckedAt?: string;
  primaryMerchantCount: number;
  primarySeedCount: number;
  validPrimaryOfferCount: number;
}

export interface CatalogApiReadCacheOptions {
  revalidateSeconds?: number;
  tags?: readonly string[];
}

export interface CatalogDiscoverySignal {
  bestPriceMinor: number;
  merchantCount: number;
  nextBestPriceMinor?: number;
  observedAt: string;
  priceSpreadMinor: number;
  recentReferencePriceChangeMinor?: number;
  recentReferencePriceChangedAt?: string;
  referenceDeltaMinor?: number;
}

export interface CatalogPartnerOfferRailDiagnostic {
  discountScore: number;
  excludedReason:
    | 'excluded_set'
    | 'included'
    | 'missing_best_offer'
    | 'missing_deeplink'
    | 'missing_price'
    | 'missing_summary'
    | 'out_of_stock';
  finalScore: number;
  hasDeeplink: boolean;
  hasPrice: boolean;
  inStock: boolean;
  priceSpread: number;
  setId: string;
}

export interface CatalogHomepageDealQualityDiagnostics {
  excluded_missing_reference_discount_count: number;
  excluded_unit_mismatch_count: number;
  excluded_untrusted_merchant_count: number;
  excluded_unknown_unit_count: number;
  excluded_unknown_verdict_count: number;
  soft_deal_accepted: number;
  soft_deal_candidates: number;
  strong_deal_accepted: number;
  strong_deal_candidates: number;
}

export interface CatalogCommerceRailRuntimeDiagnostics {
  activeMerchantCount: number;
  activeSeedCount: number;
  currentOfferRowCount: number;
  currentOfferRowsWithValidPriceCount: number;
  hasBrowserSupabaseConfig: boolean;
  hasServerSupabaseConfig: boolean;
  missingBrowserSupabaseEnvKeys: readonly string[];
  missingServerSupabaseEnvKeys: readonly string[];
  rowsAfterMerchantJoinCount: number;
  rowsAfterPriceDeeplinkInStockFiltersCount: number;
  rowsAfterSeedJoinCount: number;
  serverSupabaseUrlSource?: string;
  summaryCount: number;
}

let webCatalogSupabaseAdminClient: SupabaseClient | undefined;
let webCatalogSupabasePublicClient: SupabaseClient | undefined;

function createWebCatalogSupabaseAdminClient(): SupabaseClient {
  const serverSupabaseConfig = getServerSupabaseConfig();

  return createClient(
    serverSupabaseConfig.url,
    serverSupabaseConfig.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getWebCatalogSupabaseAdminClient(): SupabaseClient {
  webCatalogSupabaseAdminClient ??= createWebCatalogSupabaseAdminClient();

  return webCatalogSupabaseAdminClient;
}

function createWebCatalogSupabasePublicClient(): SupabaseClient {
  const browserSupabaseConfig = getBrowserSupabaseConfig();

  return createClient(
    browserSupabaseConfig.url,
    browserSupabaseConfig.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getWebCatalogSupabasePublicClient(): SupabaseClient {
  webCatalogSupabasePublicClient ??= createWebCatalogSupabasePublicClient();

  return webCatalogSupabasePublicClient;
}

function getWebCatalogSupabaseReadClient(): CatalogSupabaseClient | undefined {
  if (hasServerSupabaseConfig()) {
    return getWebCatalogSupabaseAdminClient();
  }

  if (hasBrowserSupabaseConfig()) {
    return getWebCatalogSupabasePublicClient();
  }

  return undefined;
}

function isCurrentOfferSummaryReadDebugEnabled(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env['DEBUG_CURRENT_OFFER_SUMMARY_READ'] === 'true'
  );
}

function logCurrentOfferSummaryReadDiagnostic(
  diagnostic: Readonly<Record<string, unknown>>,
): void {
  if (!isCurrentOfferSummaryReadDebugEnabled()) {
    return;
  }

  console.info('[catalog-current-offer-summaries]', diagnostic);
}

function isDiscoverySignalReadDebugEnabled(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env['DEBUG_DISCOVERY_SIGNAL_READ'] === 'true'
  );
}

function logDiscoverySignalReadDiagnostic(
  diagnostic: Readonly<Record<string, unknown>>,
): void {
  if (!isDiscoverySignalReadDebugEnabled()) {
    return;
  }

  console.info('[catalog-discovery-signals]', diagnostic);
}

function getCatalogApiBaseUrl(): string {
  return process.env['API_PROXY_TARGET'] ?? getRuntimeBaseUrl('api');
}

function getCatalogSetIdOfferLookupVariants(
  setIds: readonly string[],
): string[] {
  return [
    ...new Set(
      setIds.flatMap((setId) => {
        const canonicalSetId = getCanonicalCatalogSetId(setId);

        if (!canonicalSetId) {
          return [];
        }

        return /^\d{5,6}$/.test(canonicalSetId)
          ? [setId, canonicalSetId, `${canonicalSetId}-1`]
          : [setId, canonicalSetId];
      }),
    ),
  ].filter((setId) => setId.length > 0);
}

interface CatalogDiscoverySignalRecord extends CatalogDiscoverySignal {
  setId: string;
}

interface CatalogReferencePriceSnapshot {
  recordedOn: string;
  referencePriceMinor: number;
}

interface CatalogDiscoveryCurrentOffer {
  commercialUnitType?: CommerceCommercialUnitType;
  merchantSlug: string;
  observedAt: string;
  priceMinor: number;
  setId: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCatalogDiscoverySignalRecord(
  value: unknown,
): value is CatalogDiscoverySignalRecord {
  return (
    isObjectRecord(value) &&
    typeof value['setId'] === 'string' &&
    typeof value['bestPriceMinor'] === 'number' &&
    typeof value['merchantCount'] === 'number' &&
    typeof value['observedAt'] === 'string' &&
    typeof value['priceSpreadMinor'] === 'number' &&
    (typeof value['nextBestPriceMinor'] === 'undefined' ||
      typeof value['nextBestPriceMinor'] === 'number') &&
    (typeof value['recentReferencePriceChangeMinor'] === 'undefined' ||
      typeof value['recentReferencePriceChangeMinor'] === 'number') &&
    (typeof value['recentReferencePriceChangedAt'] === 'undefined' ||
      typeof value['recentReferencePriceChangedAt'] === 'string') &&
    (typeof value['referenceDeltaMinor'] === 'undefined' ||
      typeof value['referenceDeltaMinor'] === 'number')
  );
}

function isCatalogResolvedOfferRecord(
  value: unknown,
): value is CatalogResolvedOffer {
  return (
    isObjectRecord(value) &&
    (value['availability'] === 'in_stock' ||
      value['availability'] === 'out_of_stock' ||
      value['availability'] === 'unknown') &&
    typeof value['checkedAt'] === 'string' &&
    value['condition'] === 'new' &&
    value['currency'] === 'EUR' &&
    value['market'] === 'NL' &&
    (value['merchant'] === 'amazon' ||
      value['merchant'] === 'bol' ||
      value['merchant'] === 'lego' ||
      value['merchant'] === 'other') &&
    typeof value['merchantName'] === 'string' &&
    typeof value['priceCents'] === 'number' &&
    typeof value['setId'] === 'string' &&
    typeof value['url'] === 'string'
  );
}

function readCatalogOfferStringField(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readCatalogOfferNumberField(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function normalizeCatalogOfferAvailability(
  value: unknown,
  inStockValue: unknown,
): CatalogResolvedOffer['availability'] {
  if (inStockValue === true) {
    return 'in_stock';
  }

  if (inStockValue === false) {
    return 'out_of_stock';
  }

  if (value === 'in_stock' || value === 'out_of_stock' || value === 'unknown') {
    return value;
  }

  if (typeof value !== 'string') {
    return 'unknown';
  }

  const normalizedValue = value.trim().toLowerCase();

  if (
    normalizedValue === 'in stock' ||
    normalizedValue === 'instock' ||
    normalizedValue === 'op voorraad' ||
    normalizedValue === 'limited'
  ) {
    return 'in_stock';
  }

  if (
    normalizedValue === 'out of stock' ||
    normalizedValue === 'outofstock' ||
    normalizedValue === 'niet op voorraad' ||
    normalizedValue === 'preorder'
  ) {
    return 'out_of_stock';
  }

  return 'unknown';
}

function normalizeCatalogOfferMerchant(
  value: unknown,
  merchantSlug?: string,
): CatalogResolvedOffer['merchant'] {
  if (
    value === 'amazon' ||
    value === 'bol' ||
    value === 'lego' ||
    value === 'other'
  ) {
    return value;
  }

  if (merchantSlug) {
    return getCatalogOfferMerchantFromMerchantSlug(merchantSlug);
  }

  return 'other';
}

function normalizeCatalogResolvedOfferRecord(
  value: unknown,
  fallbackSetId?: string,
): CatalogRuntimeOffer | undefined {
  if (isCatalogResolvedOfferRecord(value)) {
    const merchantSlug =
      'merchantSlug' in value && typeof value.merchantSlug === 'string'
        ? value.merchantSlug
        : getOfferLookupKey({
            merchantName: value.merchantName,
          });

    return {
      ...value,
      merchant: normalizeCatalogOfferMerchant(value.merchant, merchantSlug),
      merchantName: resolvePublicMerchantDisplayName({
        merchantName: value.merchantName,
        merchantSlug,
      }),
      merchantSlug,
      setId: getCanonicalCatalogSetId(value.setId),
    };
  }

  if (!isObjectRecord(value)) {
    return undefined;
  }

  const rawSetId =
    readCatalogOfferStringField(value, ['setId', 'setNumber', 'set_id']) ??
    fallbackSetId;
  const setId = rawSetId ? getCanonicalCatalogSetId(rawSetId) : undefined;
  const priceCents = readCatalogOfferNumberField(value, [
    'priceCents',
    'priceMinor',
    'price_minor',
    'currentPriceMinor',
    'current_price_minor',
  ]);
  const url = readCatalogOfferStringField(value, [
    'url',
    'productUrl',
    'product_url',
    'affiliateDeeplink',
    'affiliate_deeplink',
    'deeplink',
  ]);
  const currency =
    readCatalogOfferStringField(value, ['currency', 'currencyCode']) ?? 'EUR';
  const market = readCatalogOfferStringField(value, ['market']) ?? 'NL';
  const merchantName =
    readCatalogOfferStringField(value, ['merchantName', 'merchant_name']) ??
    'Partner';
  const merchantSlug = readCatalogOfferStringField(value, [
    'merchantSlug',
    'merchant_slug',
  ]);
  const checkedAt = readCatalogOfferStringField(value, [
    'checkedAt',
    'observedAt',
    'observed_at',
    'fetchedAt',
    'fetched_at',
    'updatedAt',
    'updated_at',
  ]);

  if (
    !setId ||
    !url ||
    !checkedAt ||
    typeof priceCents !== 'number' ||
    priceCents <= 0 ||
    currency !== 'EUR' ||
    market !== 'NL'
  ) {
    return undefined;
  }

  return {
    availability: normalizeCatalogOfferAvailability(
      value['availability'],
      value['inStock'],
    ),
    checkedAt,
    condition: 'new',
    currency: 'EUR',
    market: 'NL',
    merchant: normalizeCatalogOfferMerchant(value['merchant'], merchantSlug),
    merchantName: resolvePublicMerchantDisplayName({
      merchantName,
      merchantSlug,
    }),
    merchantSlug:
      merchantSlug ??
      getOfferLookupKey({
        merchantName,
      }),
    priceCents,
    setId,
    url,
  };
}

function normalizeCatalogCurrentOfferSummaryRecord(
  value: unknown,
  fallbackSetId?: string,
): CatalogCurrentOfferSummaryRecord | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const setId = getCanonicalCatalogSetId(
    readCatalogOfferStringField(value, ['setId', 'setNumber', 'set_id']) ??
      fallbackSetId ??
      '',
  );

  if (!setId) {
    return undefined;
  }

  const rawOffers = Array.isArray(value['offers']) ? value['offers'] : [];
  const offers = sortResolvedCatalogOffers(
    rawOffers.flatMap((rawOffer) => {
      const normalizedOffer = normalizeCatalogResolvedOfferRecord(
        rawOffer,
        setId,
      );

      return normalizedOffer ? [normalizedOffer] : [];
    }),
  ) as CatalogRuntimeOffer[];
  const normalizedBestOffer =
    normalizeCatalogResolvedOfferRecord(
      value['bestOffer'] ?? value['best_offer'] ?? value['currentOffer'],
      setId,
    ) ?? undefined;
  const resolvedOffers = offers.length
    ? offers
    : normalizedBestOffer
      ? [normalizedBestOffer]
      : [];
  const bestOffer = selectBestResolvedCatalogOffer(resolvedOffers);

  return {
    ...(bestOffer ? { bestOffer } : {}),
    offers: resolvedOffers,
    setId,
  };
}

function getCurrentOfferSnapshotInvalidReason(
  row: CatalogCommerceCurrentOfferSnapshotRow,
  now = new Date(),
): string | undefined {
  if (
    row.region_code !== DUTCH_REGION_CODE ||
    row.currency_code !== EURO_CURRENCY_CODE ||
    row.condition !== NEW_OFFER_CONDITION
  ) {
    return 'invalid_scope';
  }

  if (!row.computed_at) {
    return 'missing_computed_at';
  }

  const computedAt = new Date(row.computed_at);

  if (
    Number.isNaN(computedAt.getTime()) ||
    now.getTime() - computedAt.getTime() > CURRENT_OFFER_SNAPSHOT_MAX_AGE_MS
  ) {
    return 'stale_snapshot';
  }

  if (!Number.isInteger(row.best_price_minor)) {
    return 'missing_best_offer';
  }

  if (!Array.isArray(row.offers)) {
    return 'invalid_offers_json';
  }

  return undefined;
}

function toCatalogCurrentOfferSummaryFromSnapshotRow(
  row: CatalogCommerceCurrentOfferSnapshotRow,
): CatalogCurrentOfferSummaryRecord | undefined {
  const setId = getCanonicalCatalogSetId(row.set_id);

  if (!setId || !Array.isArray(row.offers)) {
    return undefined;
  }

  return normalizeCatalogCurrentOfferSummaryRecord(
    {
      bestOffer: {
        availability: row.best_availability,
        checkedAt: row.best_checked_at,
        commercialUnitType: row.best_commercial_unit_type,
        condition: NEW_OFFER_CONDITION,
        currency: EURO_CURRENCY_CODE,
        market: DUTCH_REGION_CODE,
        merchantName: row.best_merchant_name,
        merchantSlug: row.best_merchant_slug,
        priceMinor: row.best_price_minor,
        setId,
        url: row.best_product_url,
      },
      offers: row.offers.map((offer) =>
        typeof offer === 'object' && offer !== null
          ? {
              ...(offer as CatalogCommerceCurrentOfferSnapshotOfferRow),
              setId:
                (offer as CatalogCommerceCurrentOfferSnapshotOfferRow).setId ??
                setId,
            }
          : offer,
      ),
      setId,
    },
    setId,
  );
}

async function listCatalogCurrentOfferSnapshotSummariesBySetIds({
  setIds,
  signal,
  supabaseClient,
}: {
  setIds: readonly string[];
  signal?: AbortSignal;
  supabaseClient: CatalogSupabaseClient;
}): Promise<{
  fallbackSetIds: string[];
  snapshotMissingBestOfferCount: number;
  snapshotStaleCount: number;
  summaryBySetId: Map<string, CatalogCurrentOfferSummaryRecord>;
}> {
  const summaryBySetId = new Map<string, CatalogCurrentOfferSummaryRecord>();
  const fallbackSetIds = new Set(setIds);
  let snapshotMissingBestOfferCount = 0;
  let snapshotStaleCount = 0;

  for (const setIdChunk of chunkCatalogValues(
    setIds,
    CATALOG_CURRENT_OFFER_IN_FILTER_PAGE_SIZE,
  )) {
    throwIfCatalogReadAborted(signal);

    const { data, error } = await applyCatalogAbortSignal(
      supabaseClient
        .from(COMMERCE_CURRENT_OFFER_SNAPSHOTS_TABLE)
        .select(
          'set_id, region_code, currency_code, condition, best_availability, best_checked_at, best_commercial_unit_type, best_merchant_name, best_merchant_slug, best_price_minor, best_product_url, offer_count, offers, computed_at',
        )
        .in('set_id', setIdChunk),
      signal,
    );

    if (error) {
      return {
        fallbackSetIds: [...fallbackSetIds],
        snapshotMissingBestOfferCount,
        snapshotStaleCount,
        summaryBySetId,
      };
    }

    for (const row of (data as
      | CatalogCommerceCurrentOfferSnapshotRow[]
      | null) ?? []) {
      const setId = getCanonicalCatalogSetId(row.set_id);

      if (!setId) {
        continue;
      }

      const invalidReason = getCurrentOfferSnapshotInvalidReason(row);

      if (invalidReason) {
        if (invalidReason === 'stale_snapshot') {
          snapshotStaleCount += 1;
        }

        if (invalidReason === 'missing_best_offer') {
          snapshotMissingBestOfferCount += 1;
        }

        continue;
      }

      const summary = toCatalogCurrentOfferSummaryFromSnapshotRow(row);

      if (!summary) {
        continue;
      }

      fallbackSetIds.delete(setId);
      summaryBySetId.set(setId, summary);
    }
  }

  return {
    fallbackSetIds: [...fallbackSetIds],
    snapshotMissingBestOfferCount,
    snapshotStaleCount,
    summaryBySetId,
  };
}

function toCanonicalCatalogSetFromRow({
  row,
  themeIdentity,
}: {
  row: CatalogSetRow;
  themeIdentity?: ReturnType<typeof resolveCatalogThemeIdentity>;
}): CatalogCanonicalSet {
  const resolvedThemeIdentity =
    themeIdentity ??
    resolveCatalogThemeIdentityFromPersistence({
      primaryThemeName: undefined,
      sourceThemeName: undefined,
    });

  return {
    createdAt: row.created_at,
    imageUrl: row.image_url ?? undefined,
    name: row.name,
    pieceCount: row.piece_count,
    primaryTheme: resolvedThemeIdentity.primaryTheme,
    ...(resolvedThemeIdentity.publicTheme
      ? {
          publicTheme: resolvedThemeIdentity.publicTheme,
        }
      : {}),
    ...(row.release_date
      ? {
          releaseDate: row.release_date,
        }
      : {}),
    releaseDatePrecision: resolveCatalogReleaseDatePrecision({
      releaseDate: row.release_date ?? undefined,
      releaseDatePrecision:
        row.release_date_precision === 'day' ||
        row.release_date_precision === 'month' ||
        row.release_date_precision === 'year' ||
        row.release_date_precision === 'unknown'
          ? row.release_date_precision
          : undefined,
      releaseYear: row.release_year,
    }),
    releaseYear: row.release_year,
    secondaryLabels: resolvedThemeIdentity.secondaryThemes,
    setId: row.set_id,
    slug: row.slug,
    source: row.source,
    sourceSetNumber: row.source_set_number,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function readLegoNlDisplayTitle(metadataJson: unknown): string | undefined {
  if (
    !metadataJson ||
    typeof metadataJson !== 'object' ||
    Array.isArray(metadataJson)
  ) {
    return undefined;
  }

  const title = (metadataJson as { title?: unknown }).title;

  return typeof title === 'string' && title.trim().length > 0
    ? title.trim()
    : undefined;
}

function decodeCatalogMetadataHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replace(/&#(\d+);/g, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 10)),
    );
}

function sanitizeLegoNlProductDescription(value: string): string | undefined {
  const safeDescription = value
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*\/?\s*([a-z0-9]+)(?:\s[^>]*)?\s*\/?\s*>/gi, (tag) => {
      const tagMatch = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      const tagName = tagMatch?.[2]?.toLowerCase();
      const isClosingTag = Boolean(tagMatch?.[1]);

      if (!tagName) {
        return ' ';
      }

      if (tagName === 'br') {
        return '<br>';
      }

      const normalizedTagName =
        tagName === 'b' ? 'strong' : tagName === 'i' ? 'em' : tagName;
      const allowedTags = new Set(['em', 'li', 'ol', 'p', 'strong', 'ul']);

      if (!allowedTags.has(normalizedTagName)) {
        return ' ';
      }

      return isClosingTag
        ? `</${normalizedTagName}>`
        : `<${normalizedTagName}>`;
    });
  const sanitizedDescription = decodeCatalogMetadataHtmlEntities(
    safeDescription,
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  return sanitizedDescription.length > 0 ? sanitizedDescription : undefined;
}

function readLegoNlProductDescription(
  metadataJson: unknown,
): string | undefined {
  if (
    !metadataJson ||
    typeof metadataJson !== 'object' ||
    Array.isArray(metadataJson)
  ) {
    return undefined;
  }

  const description = (metadataJson as { description?: unknown }).description;

  return typeof description === 'string'
    ? sanitizeLegoNlProductDescription(description)
    : undefined;
}

function normalizeCatalogMetadataSearchText(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCatalogMetadataSearchToken(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getLegoNlDisplayTitleSearchScore({
  query,
  title,
}: {
  query: string;
  title: string;
}): number | undefined {
  const normalizedQueryText = normalizeCatalogMetadataSearchText(query);
  const normalizedQueryToken = normalizeCatalogMetadataSearchToken(query);
  const normalizedTitle = normalizeCatalogMetadataSearchText(title);
  const compactTitle = normalizeCatalogMetadataSearchToken(title);

  if (
    !normalizedQueryText ||
    !normalizedQueryToken ||
    !normalizedTitle ||
    !compactTitle
  ) {
    return undefined;
  }

  if (
    normalizedTitle === normalizedQueryText ||
    compactTitle === normalizedQueryToken
  ) {
    return 1;
  }

  if (
    normalizedTitle.startsWith(normalizedQueryText) ||
    compactTitle.startsWith(normalizedQueryToken)
  ) {
    return 1.5;
  }

  if (
    normalizedTitle
      .split(' ')
      .some((normalizedTitleWord) =>
        normalizedTitleWord.startsWith(normalizedQueryText),
      )
  ) {
    return 2.5;
  }

  if (
    normalizedTitle.includes(normalizedQueryText) ||
    compactTitle.includes(normalizedQueryToken)
  ) {
    return 3.5;
  }

  return undefined;
}

async function listLegoNlDisplayTitleSearchMatches({
  query,
  supabaseClient,
}: {
  query: string;
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, { score: number; title: string }>> {
  const titleMatchesBySetId = new Map<
    string,
    { score: number; title: string }
  >();

  const { data, error } = await supabaseClient
    .from(CATALOG_SET_SOURCE_METADATA_TABLE)
    .select('catalog_set_id, metadata_json')
    .eq('source', LEGO_NL_DISPLAY_TITLE_SOURCE)
    .eq('locale', LEGO_NL_DISPLAY_TITLE_LOCALE)
    .eq('match_confidence', LEGO_NL_DISPLAY_TITLE_MATCH_CONFIDENCE)
    .eq('policy', LEGO_NL_DISPLAY_TITLE_POLICY);

  if (error) {
    throw new Error('Unable to search LEGO NL display title metadata.');
  }

  for (const row of (data as CatalogSetSourceMetadataRow[] | null) ?? []) {
    const title = readLegoNlDisplayTitle(row.metadata_json);
    const score = title
      ? getLegoNlDisplayTitleSearchScore({
          query,
          title,
        })
      : undefined;

    if (title && typeof score === 'number') {
      titleMatchesBySetId.set(row.catalog_set_id, {
        score,
        title,
      });
    }
  }

  return titleMatchesBySetId;
}

function sanitizeLegoNlProductFeatureText(value: string): string | undefined {
  const sanitizedValue = decodeCatalogMetadataHtmlEntities(value)
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitizedValue.length > 0 ? sanitizedValue : undefined;
}

function readLegoNlProductFeatures(
  metadataJson: unknown,
): CatalogProductFeature[] | undefined {
  if (
    !metadataJson ||
    typeof metadataJson !== 'object' ||
    Array.isArray(metadataJson)
  ) {
    return undefined;
  }

  const features = (metadataJson as { features?: unknown }).features;

  if (!Array.isArray(features)) {
    return undefined;
  }

  const safeFeatures = features
    .map((feature): CatalogProductFeature | undefined => {
      if (!feature || typeof feature !== 'object' || Array.isArray(feature)) {
        return undefined;
      }

      const rawFeature = feature as { body?: unknown; title?: unknown };
      const body =
        typeof rawFeature.body === 'string'
          ? sanitizeLegoNlProductFeatureText(rawFeature.body)
          : undefined;
      const title =
        typeof rawFeature.title === 'string'
          ? sanitizeLegoNlProductFeatureText(rawFeature.title)
          : undefined;

      return body ? { ...(title ? { title } : {}), body } : undefined;
    })
    .filter((feature): feature is CatalogProductFeature => feature != null);

  return safeFeatures.length >= 2 ? safeFeatures : undefined;
}

async function getLegoNlProductDescriptionBySetId({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient: CatalogSupabaseClient;
}): Promise<
  | {
      description?: string;
      features?: CatalogProductFeature[];
    }
  | undefined
> {
  const { data, error } = await supabaseClient
    .from(CATALOG_SET_SOURCE_METADATA_TABLE)
    .select('metadata_json')
    .eq('catalog_set_id', setId)
    .eq('source', LEGO_NL_DISPLAY_TITLE_SOURCE)
    .eq('locale', LEGO_NL_DISPLAY_TITLE_LOCALE)
    .eq('match_confidence', LEGO_NL_DISPLAY_TITLE_MATCH_CONFIDENCE)
    .eq('policy', LEGO_NL_DISPLAY_TITLE_POLICY)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load LEGO NL product description metadata.');
  }

  const metadataJson = (
    data as Pick<CatalogSetSourceMetadataRow, 'metadata_json'> | null
  )?.metadata_json;
  const description = readLegoNlProductDescription(metadataJson);
  const features = readLegoNlProductFeatures(metadataJson);

  return description || features ? { description, features } : undefined;
}

async function listLegoNlDisplayTitleBySetId({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, string>> {
  const displayTitleBySetId = new Map<string, string>();

  if (!setIds.length) {
    return displayTitleBySetId;
  }

  for (const setIdChunk of chunkCatalogValues(setIds, 100)) {
    const { data, error } = await supabaseClient
      .from(CATALOG_SET_SOURCE_METADATA_TABLE)
      .select('catalog_set_id, metadata_json')
      .eq('source', LEGO_NL_DISPLAY_TITLE_SOURCE)
      .eq('locale', LEGO_NL_DISPLAY_TITLE_LOCALE)
      .eq('match_confidence', LEGO_NL_DISPLAY_TITLE_MATCH_CONFIDENCE)
      .eq('policy', LEGO_NL_DISPLAY_TITLE_POLICY)
      .in('catalog_set_id', setIdChunk);

    if (error) {
      throw new Error('Unable to load LEGO NL display title metadata.');
    }

    for (const row of (data as CatalogSetSourceMetadataRow[] | null) ?? []) {
      const displayTitle = readLegoNlDisplayTitle(row.metadata_json);

      if (displayTitle) {
        displayTitleBySetId.set(row.catalog_set_id, displayTitle);
      }
    }
  }

  return displayTitleBySetId;
}

let hasLoggedLegoNlDisplayTitleAudit = false;

function logLegoNlDisplayTitleAuditOnce({
  appliedCount,
  fallbackCount,
  missingMetadataCount,
}: {
  appliedCount: number;
  fallbackCount: number;
  missingMetadataCount: number;
}) {
  if (hasLoggedLegoNlDisplayTitleAudit) {
    return;
  }

  hasLoggedLegoNlDisplayTitleAudit = true;
  console.info('[catalog-lego-nl-display-titles]', {
    appliedCount,
    fallbackCount,
    missingMetadataCount,
  });
}

function applyLegoNlDisplayTitles({
  canonicalCatalogSets,
  displayTitleBySetId,
}: {
  canonicalCatalogSets: readonly CatalogCanonicalSet[];
  displayTitleBySetId: ReadonlyMap<string, string>;
}): CatalogCanonicalSet[] {
  let appliedCount = 0;
  let fallbackCount = 0;
  let missingMetadataCount = 0;

  const enrichedCatalogSets = canonicalCatalogSets.map(
    (canonicalCatalogSet) => {
      const displayTitle = displayTitleBySetId.get(canonicalCatalogSet.setId);

      if (!displayTitle) {
        fallbackCount += 1;

        if (!displayTitleBySetId.has(canonicalCatalogSet.setId)) {
          missingMetadataCount += 1;
        }

        return {
          ...canonicalCatalogSet,
          displayTitle: canonicalCatalogSet.name,
          displayTitleSource: 'catalog' as const,
        };
      }

      appliedCount += 1;

      return {
        ...canonicalCatalogSet,
        catalogName: canonicalCatalogSet.name,
        displayTitle,
        displayTitleSource: LEGO_NL_DISPLAY_TITLE_SOURCE,
        name: displayTitle,
      };
    },
  );

  logLegoNlDisplayTitleAuditOnce({
    appliedCount,
    fallbackCount,
    missingMetadataCount,
  });

  return enrichedCatalogSets;
}

async function enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
  canonicalCatalogSets,
  supabaseClient,
}: {
  canonicalCatalogSets: readonly CatalogCanonicalSet[];
  supabaseClient: CatalogSupabaseClient;
}): Promise<CatalogCanonicalSet[]> {
  if (!canonicalCatalogSets.length) {
    return [];
  }

  try {
    const displayTitleBySetId = await listLegoNlDisplayTitleBySetId({
      setIds: canonicalCatalogSets.map(
        (canonicalCatalogSet) => canonicalCatalogSet.setId,
      ),
      supabaseClient,
    });

    return applyLegoNlDisplayTitles({
      canonicalCatalogSets,
      displayTitleBySetId,
    });
  } catch {
    console.warn('[catalog-lego-nl-display-titles]', {
      message: 'Falling back to catalog titles after metadata lookup failed.',
      setCount: canonicalCatalogSets.length,
    });

    return [...canonicalCatalogSets];
  }
}

function toCatalogSummaryFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetSummary {
  const displayTheme =
    getCatalogThemeDisplayName(canonicalCatalogSet.primaryTheme, {
      name: canonicalCatalogSet.catalogName ?? canonicalCatalogSet.name,
      secondaryLabels: canonicalCatalogSet.secondaryLabels,
      setId: canonicalCatalogSet.setId,
      slug: canonicalCatalogSet.slug,
      sourceSetNumber: canonicalCatalogSet.sourceSetNumber,
      theme: canonicalCatalogSet.primaryTheme,
    }) ?? canonicalCatalogSet.primaryTheme;

  return {
    ...(canonicalCatalogSet.catalogName
      ? {
          catalogName: canonicalCatalogSet.catalogName,
        }
      : {}),
    createdAt: canonicalCatalogSet.createdAt,
    displayTitle: canonicalCatalogSet.displayTitle ?? canonicalCatalogSet.name,
    ...(canonicalCatalogSet.displayTitleSource
      ? {
          displayTitleSource: canonicalCatalogSet.displayTitleSource,
        }
      : {}),
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: displayTheme,
    ...(canonicalCatalogSet.publicTheme
      ? {
          publicTheme: canonicalCatalogSet.publicTheme,
        }
      : {}),
    ...(canonicalCatalogSet.secondaryLabels.length
      ? {
          secondaryLabels: canonicalCatalogSet.secondaryLabels,
        }
      : {}),
    ...(canonicalCatalogSet.releaseDate
      ? {
          releaseDate: canonicalCatalogSet.releaseDate,
        }
      : {}),
    releaseDatePrecision: canonicalCatalogSet.releaseDatePrecision,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
  };
}

function toCatalogSetDetailFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetDetail {
  const catalogSetOverlay = catalogSetOverlayByCanonicalId.get(
    canonicalCatalogSet.setId,
  );
  const displayTheme =
    canonicalCatalogSet.publicTheme?.name ??
    getCatalogThemeDisplayName(canonicalCatalogSet.primaryTheme, {
      name: canonicalCatalogSet.catalogName ?? canonicalCatalogSet.name,
      secondaryLabels: canonicalCatalogSet.secondaryLabels,
      setId: canonicalCatalogSet.setId,
      slug: canonicalCatalogSet.slug,
      sourceSetNumber: canonicalCatalogSet.sourceSetNumber,
      theme: canonicalCatalogSet.primaryTheme,
    }) ??
    canonicalCatalogSet.primaryTheme;
  const subtheme =
    catalogSetOverlay?.subtheme ?? canonicalCatalogSet.secondaryLabels[0];

  return {
    ...(canonicalCatalogSet.catalogName
      ? {
          catalogName: canonicalCatalogSet.catalogName,
        }
      : {}),
    createdAt: canonicalCatalogSet.createdAt,
    displayTitle: canonicalCatalogSet.displayTitle ?? canonicalCatalogSet.name,
    ...(canonicalCatalogSet.displayTitleSource
      ? {
          displayTitleSource: canonicalCatalogSet.displayTitleSource,
        }
      : {}),
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: displayTheme,
    ...(canonicalCatalogSet.publicTheme
      ? {
          publicTheme: canonicalCatalogSet.publicTheme,
        }
      : {}),
    ...(canonicalCatalogSet.releaseDate
      ? {
          releaseDate: canonicalCatalogSet.releaseDate,
        }
      : {}),
    releaseDatePrecision: canonicalCatalogSet.releaseDatePrecision,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
    ...(canonicalCatalogSet.legoProductDescription
      ? {
          legoProductDescription: canonicalCatalogSet.legoProductDescription,
        }
      : {}),
    ...(canonicalCatalogSet.legoProductFeatures?.length
      ? {
          legoProductFeatures: canonicalCatalogSet.legoProductFeatures,
        }
      : {}),
    ...(typeof canonicalCatalogSet.minifigureCount === 'number'
      ? {
          minifigureCount: canonicalCatalogSet.minifigureCount,
        }
      : catalogSetOverlay?.minifigureCount
        ? {
            minifigureCount: catalogSetOverlay.minifigureCount,
          }
        : {}),
    ...(catalogSetOverlay?.recommendedAge
      ? {
          recommendedAge: catalogSetOverlay.recommendedAge,
        }
      : {}),
    ...(catalogSetOverlay?.setStatus
      ? {
          setStatus: catalogSetOverlay.setStatus,
        }
      : {}),
    ...(catalogSetOverlay?.minifigureHighlights?.length
      ? {
          minifigureHighlights: catalogSetOverlay.minifigureHighlights,
        }
      : {}),
    ...(subtheme
      ? {
          subtheme,
        }
      : {}),
    ...(canonicalCatalogSet.imageUrl
      ? {
          images: [
            {
              order: 0,
              type: 'hero',
              url: canonicalCatalogSet.imageUrl,
            },
          ],
          primaryImage: canonicalCatalogSet.imageUrl,
        }
      : {}),
  };
}

async function getCatalogSetMinifigCountBySetId({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient: CatalogSupabaseClient;
}): Promise<number | undefined> {
  const { data, error } = await supabaseClient
    .from(CATALOG_SET_MINIFIG_SUMMARIES_TABLE)
    .select('set_id, minifig_count')
    .eq('set_id', setId)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load catalog set minifig summary.');
  }

  const summary = data as CatalogSetMinifigSummaryRow | null;

  if (!summary || typeof summary.minifig_count !== 'number') {
    return undefined;
  }

  return summary.minifig_count;
}

async function listCatalogThemeIdentityBySetId({
  catalogRows,
  supabaseClient,
}: {
  catalogRows: readonly CatalogSetRow[];
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, ReturnType<typeof resolveCatalogThemeIdentity>>> {
  const sourceThemeIds = [
    ...new Set(
      catalogRows
        .map((catalogRow) => catalogRow.source_theme_id)
        .filter((sourceThemeId): sourceThemeId is string =>
          Boolean(sourceThemeId),
        ),
    ),
  ];
  const primaryThemeIds = [
    ...new Set(
      catalogRows
        .map((catalogRow) => catalogRow.primary_theme_id)
        .filter((primaryThemeId): primaryThemeId is string =>
          Boolean(primaryThemeId),
        ),
    ),
  ];

  if (!sourceThemeIds.length && !primaryThemeIds.length) {
    return new Map();
  }

  try {
    const sourceThemeResponse = sourceThemeIds.length
      ? await supabaseClient
          .from(CATALOG_SOURCE_THEMES_TABLE)
          .select('id, source_theme_name, parent_source_theme_id')
          .in('id', sourceThemeIds)
      : { data: [], error: null };

    if (sourceThemeResponse.error) {
      return new Map();
    }

    const directSourceThemes =
      (sourceThemeResponse.data as CatalogSourceThemeRow[]) ?? [];
    const parentSourceThemeIds = [
      ...new Set(
        directSourceThemes
          .map((sourceTheme) => sourceTheme.parent_source_theme_id)
          .filter(
            (sourceThemeId): sourceThemeId is string =>
              typeof sourceThemeId === 'string' &&
              !sourceThemeIds.includes(sourceThemeId),
          ),
      ),
    ];
    const parentSourceThemeResponse = parentSourceThemeIds.length
      ? await supabaseClient
          .from(CATALOG_SOURCE_THEMES_TABLE)
          .select('id, source_theme_name, parent_source_theme_id')
          .in('id', parentSourceThemeIds)
      : { data: [], error: null };

    if (parentSourceThemeResponse.error) {
      return new Map();
    }

    const sourceThemes = [
      ...directSourceThemes,
      ...((parentSourceThemeResponse.data as CatalogSourceThemeRow[]) ?? []),
    ];
    const relatedSourceThemeIds = [
      ...new Set([
        ...sourceThemeIds,
        ...sourceThemes
          .map((sourceTheme) => sourceTheme.parent_source_theme_id)
          .filter((sourceThemeId): sourceThemeId is string =>
            Boolean(sourceThemeId),
          ),
      ]),
    ];
    const themeMappingResponse = relatedSourceThemeIds.length
      ? await supabaseClient
          .from(CATALOG_THEME_MAPPINGS_TABLE)
          .select('source_theme_id, primary_theme_id')
          .in('source_theme_id', relatedSourceThemeIds)
      : { data: [], error: null };

    if (themeMappingResponse.error) {
      return new Map();
    }

    const themeMappings =
      (themeMappingResponse.data as CatalogThemeMappingRow[]) ?? [];
    const primaryThemeIdsToLoad = [
      ...new Set([
        ...primaryThemeIds,
        ...themeMappings.map((themeMapping) => themeMapping.primary_theme_id),
      ]),
    ];
    const primaryThemeResponse = primaryThemeIdsToLoad.length
      ? await supabaseClient
          .from(CATALOG_THEMES_TABLE)
          .select(
            'id, slug, display_name, public_display_name, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_logo_url, status, is_public',
          )
          .in('id', primaryThemeIdsToLoad)
      : { data: [], error: null };

    if (primaryThemeResponse.error) {
      return new Map();
    }

    const sourceThemeById = new Map(
      sourceThemes.map((sourceTheme) => [sourceTheme.id, sourceTheme]),
    );
    const primaryThemeById = new Map(
      ((primaryThemeResponse.data as CatalogThemeRow[]) ?? []).map(
        (catalogTheme) => [catalogTheme.id, catalogTheme],
      ),
    );
    const primaryThemeIdBySourceThemeId = new Map(
      themeMappings.map((themeMapping) => [
        themeMapping.source_theme_id,
        themeMapping.primary_theme_id,
      ]),
    );

    return new Map(
      catalogRows.map((catalogRow) => {
        const sourceThemeName = catalogRow.source_theme_id
          ? sourceThemeById.get(catalogRow.source_theme_id)?.source_theme_name
          : undefined;
        const parentSourceThemeId = catalogRow.source_theme_id
          ? sourceThemeById.get(catalogRow.source_theme_id)
              ?.parent_source_theme_id
          : undefined;
        const mappedParentPrimaryThemeId = parentSourceThemeId
          ? primaryThemeIdBySourceThemeId.get(parentSourceThemeId)
          : undefined;
        const mappedPrimaryThemeId = catalogRow.source_theme_id
          ? primaryThemeIdBySourceThemeId.get(catalogRow.source_theme_id)
          : undefined;
        const candidatePrimaryThemeIds = [
          catalogRow.primary_theme_id,
          mappedPrimaryThemeId,
          mappedParentPrimaryThemeId,
        ].filter((themeId): themeId is string => Boolean(themeId));
        const publicPrimaryTheme = resolvePublicCatalogThemeRowCandidate(
          candidatePrimaryThemeIds,
          primaryThemeById,
        );
        const primaryThemeId =
          publicPrimaryTheme?.id ??
          catalogRow.primary_theme_id ??
          mappedPrimaryThemeId;
        const primaryThemeName = publicPrimaryTheme
          ? (normalizeCatalogThemePublicText(
              publicPrimaryTheme.public_display_name,
            ) ?? publicPrimaryTheme.display_name)
          : primaryThemeId
            ? (normalizeCatalogThemePublicText(
                primaryThemeById.get(primaryThemeId)?.public_display_name,
              ) ?? primaryThemeById.get(primaryThemeId)?.display_name)
            : undefined;

        const resolvedThemeIdentity =
          resolveCatalogThemeIdentityFromPersistence({
            primaryThemeName,
            sourceThemeName,
          });
        const publicThemeName = publicPrimaryTheme
          ? (normalizeCatalogThemePublicText(
              publicPrimaryTheme.public_display_name,
            ) ?? publicPrimaryTheme.display_name)
          : undefined;
        const publicThemeLogoUrl = normalizeCatalogThemePublicLogoUrl(
          publicPrimaryTheme?.public_logo_url,
        );
        const publicAccentColor = normalizeCatalogThemePublicAccentColor(
          publicPrimaryTheme?.public_accent_color,
        );
        const publicSurfaceColor = normalizeCatalogThemePublicAccentColor(
          publicPrimaryTheme?.public_surface_color,
        );
        const publicSurfaceTextColor = normalizeCatalogThemePublicTextColor(
          publicPrimaryTheme?.public_surface_text_color,
        );
        const publicHeroTextColor = normalizeCatalogThemePublicTextColor(
          publicPrimaryTheme?.public_hero_text_color,
        );

        return [
          catalogRow.set_id,
          {
            ...(publicPrimaryTheme?.slug && publicThemeName
              ? {
                  primaryTheme: publicThemeName,
                  publicTheme: {
                    ...(publicAccentColor
                      ? {
                          accentColor: publicAccentColor,
                        }
                      : {}),
                    ...(publicHeroTextColor
                      ? {
                          heroTextColor: publicHeroTextColor,
                        }
                      : {}),
                    ...(publicThemeLogoUrl
                      ? {
                          logoUrl: publicThemeLogoUrl,
                        }
                      : {}),
                    name: publicThemeName,
                    slug: publicPrimaryTheme.slug,
                    ...(publicSurfaceColor
                      ? {
                          surfaceColor: publicSurfaceColor,
                        }
                      : {}),
                    ...(publicSurfaceTextColor
                      ? {
                          surfaceTextColor: publicSurfaceTextColor,
                        }
                      : {}),
                  },
                  secondaryThemes: [
                    ...new Set([
                      ...(sourceThemeName && sourceThemeName !== publicThemeName
                        ? [sourceThemeName]
                        : []),
                      ...resolvedThemeIdentity.secondaryThemes,
                    ]),
                  ],
                }
              : resolvedThemeIdentity),
          },
        ] as const;
      }),
    );
  } catch {
    return new Map();
  }
}

function getCatalogOfferMerchantFromMerchantSlug(
  merchantSlug: string,
): CatalogResolvedOffer['merchant'] {
  if (merchantSlug === 'bol') {
    return 'bol';
  }

  if (merchantSlug.startsWith('amazon')) {
    return 'amazon';
  }

  if (merchantSlug === 'lego' || merchantSlug === 'rakuten-lego-eu') {
    return 'lego';
  }

  return 'other';
}

function normalizeRuntimeOfferAvailability(
  availability?: string | null,
): CatalogResolvedOffer['availability'] {
  if (availability === 'in_stock' || availability === 'limited') {
    return 'in_stock';
  }

  if (availability === 'out_of_stock' || availability === 'preorder') {
    return 'out_of_stock';
  }

  return 'unknown';
}

function isEligibleCatalogDiscoveryOfferAvailability(
  availability: string | null,
): boolean {
  return availability === 'in_stock' || availability === 'limited';
}

function selectComparableCatalogDiscoveryOffers(
  currentOffers: readonly CatalogDiscoveryCurrentOffer[],
): CatalogDiscoveryCurrentOffer[] {
  if (currentOffers.length <= 1) {
    return [...currentOffers];
  }

  const priorities = {
    set_package: 0,
    single_item: 1,
    accessory: 2,
    magazine_bonus: 3,
  } as const;
  const preferredGroup = currentOffers
    .map((currentOffer) =>
      getCommerceCommercialUnitComparisonGroup(currentOffer.commercialUnitType),
    )
    .filter((group): group is keyof typeof priorities => group in priorities)
    .sort((left, right) => priorities[left] - priorities[right])[0];

  if (!preferredGroup) {
    return [];
  }

  return currentOffers.filter(
    (currentOffer) =>
      getCommerceCommercialUnitComparisonGroup(
        currentOffer.commercialUnitType,
      ) === preferredGroup,
  );
}

function getOfferLookupKey({
  merchantName,
  merchantSlug,
}: {
  merchantName: string;
  merchantSlug?: string;
}): string {
  const baseValue = merchantSlug || merchantName;

  return normalizeCatalogAsciiText(baseValue)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getCatalogOfferAvailabilityRank(
  availability: CatalogResolvedOffer['availability'],
): number {
  if (availability === 'in_stock') {
    return 0;
  }

  if (availability === 'unknown') {
    return 1;
  }

  return 2;
}

function getCatalogOfferMerchantReliabilityKey(
  catalogOffer: CatalogResolvedOffer,
): string {
  return 'merchantSlug' in catalogOffer &&
    typeof catalogOffer.merchantSlug === 'string'
    ? catalogOffer.merchantSlug
    : catalogOffer.merchantName;
}

function getCatalogOfferMerchantSlug(
  catalogOffer: CatalogResolvedOffer,
): string | undefined {
  return 'merchantSlug' in catalogOffer &&
    typeof catalogOffer.merchantSlug === 'string'
    ? catalogOffer.merchantSlug
    : undefined;
}

function getCatalogOfferPublicMerchantKey(
  catalogOffer: CatalogResolvedOffer,
): string {
  return normalizeCatalogAsciiText(
    resolvePublicMerchantDisplayName({
      merchantName: catalogOffer.merchantName,
      merchantSlug: getCatalogOfferMerchantSlug(catalogOffer),
    }),
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function compareCatalogOfferCheckedAtDescending(
  left: CatalogResolvedOffer,
  right: CatalogResolvedOffer,
): number {
  return right.checkedAt.localeCompare(left.checkedAt);
}

function compareCatalogPublicMerchantDuplicatePreference(
  left: CatalogResolvedOffer,
  right: CatalogResolvedOffer,
): number {
  const leftMerchantSlug = getCatalogOfferMerchantSlug(left);
  const rightMerchantSlug = getCatalogOfferMerchantSlug(right);
  const leftIsRakutenLego = leftMerchantSlug === 'rakuten-lego-eu';
  const rightIsRakutenLego = rightMerchantSlug === 'rakuten-lego-eu';

  if (leftIsRakutenLego !== rightIsRakutenLego) {
    return leftIsRakutenLego ? -1 : 1;
  }

  return (
    compareCatalogOfferCheckedAtDescending(left, right) ||
    left.priceCents - right.priceCents ||
    getCatalogOfferAvailabilityRank(left.availability) -
      getCatalogOfferAvailabilityRank(right.availability)
  );
}

function dedupeCatalogOffersByPublicMerchant<
  Offer extends CatalogResolvedOffer,
>(catalogOffers: readonly Offer[]): Offer[] {
  const selectedOfferByPublicMerchantKey = new Map<string, Offer>();

  for (const catalogOffer of catalogOffers) {
    const publicMerchantKey = getCatalogOfferPublicMerchantKey(catalogOffer);
    const selectedOffer =
      selectedOfferByPublicMerchantKey.get(publicMerchantKey);

    if (
      !selectedOffer ||
      compareCatalogPublicMerchantDuplicatePreference(
        catalogOffer,
        selectedOffer,
      ) < 0
    ) {
      selectedOfferByPublicMerchantKey.set(publicMerchantKey, catalogOffer);
    }
  }

  return [...selectedOfferByPublicMerchantKey.values()];
}

function withCatalogOfferPublicMerchantDisplayName<
  Offer extends CatalogResolvedOffer,
>(catalogOffer: Offer): Offer {
  const merchantName = resolvePublicMerchantDisplayName({
    merchantName: catalogOffer.merchantName,
    merchantSlug: getCatalogOfferMerchantSlug(catalogOffer),
  });

  return merchantName === catalogOffer.merchantName
    ? catalogOffer
    : {
        ...catalogOffer,
        merchantName,
      };
}

function compareCatalogOfferReliability<Offer extends CatalogResolvedOffer>(
  left: Offer,
  right: Offer,
): number {
  const leftTier = getCommerceMerchantReliabilityTier(
    getCatalogOfferMerchantReliabilityKey(left),
  );
  const rightTier = getCommerceMerchantReliabilityTier(
    getCatalogOfferMerchantReliabilityKey(right),
  );

  if (leftTier === rightTier) {
    return 0;
  }

  const leftIsProductionFeed = leftTier === 'production_feed';
  const productionFeedOffer = leftIsProductionFeed ? left : right;
  const strategicManualOffer = leftIsProductionFeed ? right : left;

  if (
    canStrategicManualOfferBeatProductionFeed({
      productionFeedPriceMinor: productionFeedOffer.priceCents,
      strategicManualPriceMinor: strategicManualOffer.priceCents,
    })
  ) {
    return 0;
  }

  return leftIsProductionFeed ? -1 : 1;
}

function sortResolvedCatalogOffers<Offer extends CatalogResolvedOffer>(
  catalogOffers: readonly Offer[],
): Offer[] {
  return [...catalogOffers].sort(
    (left, right) =>
      getCatalogOfferAvailabilityRank(left.availability) -
        getCatalogOfferAvailabilityRank(right.availability) ||
      compareCommerceCommercialUnitPreference(
        left.commercialUnitType,
        right.commercialUnitType,
      ) ||
      compareCatalogOfferReliability(left, right) ||
      left.priceCents - right.priceCents ||
      left.merchantName.localeCompare(right.merchantName),
  );
}

function selectBestResolvedCatalogOffer<Offer extends CatalogResolvedOffer>(
  catalogOffers: readonly Offer[],
): Offer | undefined {
  return sortResolvedCatalogOffers(catalogOffers).find(
    (catalogOffer) =>
      catalogOffer.availability === 'in_stock' &&
      catalogOffer.priceCents > 0 &&
      catalogOffer.url.length > 0 &&
      isResolvedEuroCatalogOffer(catalogOffer),
  );
}

function isResolvedEuroCatalogOffer(
  catalogOffer: CatalogResolvedOffer,
): boolean {
  return catalogOffer.currency === 'EUR' && catalogOffer.market === 'NL';
}

function toCatalogRuntimeOffer({
  latestOffer,
  merchant,
  offerSeed,
}: {
  latestOffer: CatalogCommerceOfferLatestRow;
  merchant: CatalogCommerceMerchantRow;
  offerSeed: CatalogCommerceOfferSeedRow;
}): CatalogRuntimeOffer | undefined {
  if (
    !offerSeed.is_active ||
    offerSeed.validation_status !== 'valid' ||
    !merchant.is_active ||
    latestOffer.fetch_status !== 'success' ||
    typeof latestOffer.price_minor !== 'number' ||
    latestOffer.price_minor <= 0 ||
    latestOffer.currency_code !== 'EUR'
  ) {
    return undefined;
  }

  const checkedAt =
    latestOffer.observed_at ??
    latestOffer.fetched_at ??
    latestOffer.updated_at ??
    undefined;

  if (!checkedAt) {
    return undefined;
  }

  const commercialUnitType = classifyCommerceCommercialUnitType({
    notes: offerSeed.notes,
    productUrl: offerSeed.product_url,
    setId: offerSeed.set_id,
  });

  return {
    availability: normalizeRuntimeOfferAvailability(latestOffer.availability),
    checkedAt,
    condition: 'new',
    currency: 'EUR',
    commercialUnitType,
    market: 'NL',
    merchant: getCatalogOfferMerchantFromMerchantSlug(merchant.slug),
    merchantName: resolvePublicMerchantDisplayName({
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
    }),
    merchantSlug: merchant.slug,
    priceCents: latestOffer.price_minor,
    setId: getCanonicalCatalogSetId(offerSeed.set_id),
    url: offerSeed.product_url,
  };
}

function getLatestCheckedAtForPrimaryOffers(
  latestOffers: readonly CatalogCommerceOfferLatestRow[],
): string | undefined {
  return latestOffers
    .map(
      (latestOffer) =>
        latestOffer.fetched_at ??
        latestOffer.observed_at ??
        latestOffer.updated_at,
    )
    .filter((checkedAt): checkedAt is string => Boolean(checkedAt))
    .sort((left, right) => right.localeCompare(left))[0];
}

export function resolveCatalogSetDetailOffers({
  generatedOffers,
  liveOffers,
}: {
  generatedOffers: readonly CatalogResolvedOffer[];
  liveOffers: readonly CatalogRuntimeOffer[];
}): CatalogResolvedOffer[] {
  if (!liveOffers.length) {
    return sortResolvedCatalogOffers(
      dedupeCatalogOffersByPublicMerchant(
        generatedOffers.map(withCatalogOfferPublicMerchantDisplayName),
      ),
    );
  }

  const generatedOfferByMerchantKey = new Map(
    generatedOffers.map((catalogOffer) => [
      getOfferLookupKey({
        merchantName: catalogOffer.merchantName,
      }),
      catalogOffer,
    ]),
  );

  const resolvedOffers = liveOffers.map((liveOffer) => {
    const matchingGeneratedOffer = generatedOfferByMerchantKey.get(
      getOfferLookupKey({
        merchantName: liveOffer.merchantName,
        merchantSlug: liveOffer.merchantSlug,
      }),
    );

    if (!matchingGeneratedOffer) {
      return withCatalogOfferPublicMerchantDisplayName(liveOffer);
    }

    return {
      ...liveOffer,
      condition: matchingGeneratedOffer.condition,
      market: matchingGeneratedOffer.market,
      merchant: matchingGeneratedOffer.merchant,
      merchantName: resolvePublicMerchantDisplayName({
        merchantName: matchingGeneratedOffer.merchantName,
        merchantSlug: liveOffer.merchantSlug,
      }),
      url: matchingGeneratedOffer.url,
    } satisfies CatalogResolvedOffer;
  });

  return sortResolvedCatalogOffers(
    dedupeCatalogOffersByPublicMerchant(resolvedOffers),
  );
}

export function resolveCatalogCurrentOffers({
  generatedOffers,
  liveOffers,
}: {
  generatedOffers: readonly CatalogResolvedOffer[];
  liveOffers: readonly CatalogRuntimeOffer[];
}): CatalogResolvedOffer[] {
  if (!liveOffers.length) {
    return [];
  }

  return resolveCatalogSetDetailOffers({
    generatedOffers,
    liveOffers,
  }).filter(isResolvedEuroCatalogOffer);
}

export function summarizeCatalogCurrentOffers({
  generatedOffers,
  liveOffers,
  setId,
}: {
  generatedOffers: readonly CatalogResolvedOffer[];
  liveOffers: readonly CatalogRuntimeOffer[];
  setId: string;
}): CatalogCurrentOfferSummary {
  const offers = resolveCatalogCurrentOffers({
    generatedOffers,
    liveOffers,
  });

  return {
    bestOffer: selectBestResolvedCatalogOffer(offers),
    offers,
    setId,
  };
}

function toCatalogCurrentOfferSummaryMap(
  liveOffersBySetId: ReadonlyMap<string, readonly CatalogRuntimeOffer[]>,
): Map<string, CatalogCurrentOfferSummary> {
  return new Map(
    [...liveOffersBySetId.entries()].flatMap(([setId, offers]) => {
      if (!offers.length) {
        return [];
      }

      return [
        [
          setId,
          summarizeCatalogCurrentOffers({
            generatedOffers: [],
            liveOffers: offers,
            setId,
          }),
        ] as const,
      ];
    }),
  );
}

export async function listCanonicalCatalogSets({
  supabaseClient,
}: {
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogCanonicalSet[]> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  try {
    const { data, error } = await activeSupabaseClient
      .from(CATALOG_SETS_TABLE)
      .select(
        'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at',
      )
      .eq('status', 'active')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new Error('Unable to load canonical catalog sets.');
    }

    const catalogRows = (data as CatalogSetRow[] | null) ?? [];
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      catalogRows,
      supabaseClient: activeSupabaseClient,
    });

    const canonicalCatalogSets = sortCanonicalCatalogSets(
      catalogRows.map((row) =>
        toCanonicalCatalogSetFromRow({
          row,
          themeIdentity: themeIdentityBySetId.get(row.set_id),
        }),
      ),
    );

    return enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
      canonicalCatalogSets,
      supabaseClient: activeSupabaseClient,
    });
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export function resetWebCatalogSupabaseClientsForTests() {
  webCatalogSupabaseAdminClient = undefined;
  webCatalogSupabasePublicClient = undefined;
  hasLoggedLegoNlDisplayTitleAudit = false;
}

async function getCanonicalCatalogSetByColumn({
  column,
  value,
  supabaseClient,
}: {
  column: 'set_id' | 'slug';
  value: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCanonicalSet | undefined> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return undefined;
  }

  try {
    const { data, error } = await activeSupabaseClient
      .from(CATALOG_SETS_TABLE)
      .select(
        'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at',
      )
      .eq(column, value)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new Error('Unable to load canonical catalog set.');
    }

    if (!data) {
      return undefined;
    }

    const row = data as CatalogSetRow;
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      catalogRows: [row],
      supabaseClient: activeSupabaseClient,
    });

    const canonicalCatalogSet = toCanonicalCatalogSetFromRow({
      row,
      themeIdentity: themeIdentityBySetId.get(row.set_id),
    });

    return (
      await enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
        canonicalCatalogSets: [canonicalCatalogSet],
        supabaseClient: activeSupabaseClient,
      })
    )[0];
  } catch (error) {
    if (!supabaseClient) {
      return undefined;
    }

    throw error;
  }
}

export async function getCanonicalCatalogSetById({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCanonicalSet | undefined> {
  return getCanonicalCatalogSetByColumn({
    column: 'set_id',
    supabaseClient,
    value: getCanonicalCatalogSetId(setId),
  });
}

export async function getCanonicalCatalogSetBySlug({
  slug,
  supabaseClient,
}: {
  slug: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCanonicalSet | undefined> {
  return getCanonicalCatalogSetByColumn({
    column: 'slug',
    supabaseClient,
    value: slug,
  });
}

export async function listCatalogSetSummaries({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogSetSummary[]> {
  return sortCatalogSetSummaries(
    (await listCanonicalCatalogSetsFn()).map((canonicalCatalogSet) =>
      toCatalogSummaryFromCanonicalSet(canonicalCatalogSet),
    ),
  );
}

function toCatalogSetCardFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogHomepageSetCard {
  const catalogSetDetail =
    toCatalogSetDetailFromCanonicalSet(canonicalCatalogSet);

  return {
    ...(catalogSetDetail.catalogName
      ? {
          catalogName: catalogSetDetail.catalogName,
        }
      : {}),
    createdAt: catalogSetDetail.createdAt,
    displayTitle: catalogSetDetail.displayTitle ?? catalogSetDetail.name,
    ...(catalogSetDetail.displayTitleSource
      ? {
          displayTitleSource: catalogSetDetail.displayTitleSource,
        }
      : {}),
    id: catalogSetDetail.id,
    slug: catalogSetDetail.slug,
    name: catalogSetDetail.name,
    theme: catalogSetDetail.theme,
    ...(catalogSetDetail.publicTheme
      ? {
          publicTheme: catalogSetDetail.publicTheme,
        }
      : {}),
    ...(canonicalCatalogSet.secondaryLabels.length
      ? {
          secondaryLabels: canonicalCatalogSet.secondaryLabels,
        }
      : {}),
    ...(catalogSetDetail.releaseDate
      ? {
          releaseDate: catalogSetDetail.releaseDate,
        }
      : {}),
    releaseDatePrecision: catalogSetDetail.releaseDatePrecision,
    releaseYear: catalogSetDetail.releaseYear,
    pieces: catalogSetDetail.pieces,
    imageUrl: catalogSetDetail.imageUrl,
    images: catalogSetDetail.images,
    primaryImage: catalogSetDetail.primaryImage,
    ...(catalogSetDetail.recommendedAge
      ? {
          recommendedAge: catalogSetDetail.recommendedAge,
        }
      : {}),
    ...(catalogSetDetail.setStatus
      ? {
          setStatus: catalogSetDetail.setStatus,
        }
      : {}),
  };
}

function normalizeCatalogReadLimit(limit?: number, fallback = 24): number {
  return Math.max(1, Math.min(500, Math.floor(limit ?? fallback)));
}

function normalizeCatalogReadOffset(offset?: number): number {
  return Math.max(0, Math.floor(offset ?? 0));
}

function escapeCatalogSupabaseSearchPattern(query: string): string {
  return query.trim().replace(/[%_]/gu, '\\$&');
}

async function listCatalogSetCardsFromSupabase({
  limit = CATALOG_PUBLIC_DEFAULT_PAGE_SIZE,
  offset = 0,
  orderBy = 'created_at',
  ascending = false,
  signal,
  supabaseClient,
}: {
  ascending?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'name' | 'release_year' | 'updated_at';
  signal?: AbortSignal;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogHomepageSetCard[]> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  const safeLimit = normalizeCatalogReadLimit(
    limit,
    CATALOG_PUBLIC_DEFAULT_PAGE_SIZE,
  );
  const safeOffset = normalizeCatalogReadOffset(offset);

  try {
    throwIfCatalogReadAborted(signal);

    const { data, error } = await applyCatalogAbortSignal(
      activeSupabaseClient
        .from(CATALOG_SETS_TABLE)
        .select(CATALOG_SET_SELECT_COLUMNS)
        .eq('status', 'active')
        .order(orderBy, { ascending })
        .range(safeOffset, safeOffset + safeLimit - 1),
      signal,
    );

    if (error) {
      throw new Error('Unable to load catalog set cards.');
    }

    throwIfCatalogReadAborted(signal);

    const catalogRows = (data as CatalogSetRow[] | null) ?? [];
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      catalogRows,
      supabaseClient: activeSupabaseClient,
    });

    const canonicalCatalogSets = catalogRows.map((row) =>
      toCanonicalCatalogSetFromRow({
        row,
        themeIdentity: themeIdentityBySetId.get(row.set_id),
      }),
    );
    const enrichedCatalogSets =
      await enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
        canonicalCatalogSets,
        supabaseClient: activeSupabaseClient,
      });

    return enrichedCatalogSets.map(toCatalogSetCardFromCanonicalSet);
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

async function listAllCatalogSetCards({
  allowFullCatalogRead = false,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  limit = CATALOG_PUBLIC_RAIL_CANDIDATE_LIMIT,
  offset = 0,
  signal,
  supabaseClient,
}: {
  allowFullCatalogRead?: boolean;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogHomepageSetCard[]> {
  if (
    listCanonicalCatalogSetsFn === listCanonicalCatalogSets &&
    !allowFullCatalogRead
  ) {
    return listCatalogSetCardsFromSupabase({
      limit,
      offset,
      signal,
      supabaseClient,
    });
  }

  throwIfCatalogReadAborted(signal);

  return (await listCanonicalCatalogSetsFn()).map(
    toCatalogSetCardFromCanonicalSet,
  );
}

async function listCatalogSimilarSetCandidateCardsFromSupabase({
  currentSetCard,
  signal,
  supabaseClient,
}: {
  currentSetCard: Pick<CatalogHomepageSetCard, 'theme'>;
  signal?: AbortSignal;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogHomepageSetCard[]> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  const themeSlug = buildCatalogThemeSlug(currentSetCard.theme);

  if (!supabaseClient) {
    const cachedCandidates =
      catalogSimilarSetCandidatesByThemeSlug.get(themeSlug);

    if (cachedCandidates && cachedCandidates.expiresAt > Date.now()) {
      throwIfCatalogReadAborted(signal);

      const candidates = await cachedCandidates.promise;

      throwIfCatalogReadAborted(signal);

      return candidates;
    }

    if (cachedCandidates) {
      catalogSimilarSetCandidatesByThemeSlug.delete(themeSlug);
    }

    const candidatesPromise = listCatalogSimilarSetCandidateCardsFromSupabase({
      currentSetCard,
      supabaseClient: activeSupabaseClient,
    }).catch((error) => {
      catalogSimilarSetCandidatesByThemeSlug.delete(themeSlug);
      throw error;
    });

    catalogSimilarSetCandidatesByThemeSlug.set(themeSlug, {
      expiresAt: Date.now() + CATALOG_SIMILAR_SET_CANDIDATE_CACHE_TTL_MS,
      promise: candidatesPromise,
    });

    throwIfCatalogReadAborted(signal);

    const candidates = await candidatesPromise;

    throwIfCatalogReadAborted(signal);

    return candidates;
  }

  try {
    throwIfCatalogReadAborted(signal);

    const { data: themeData, error: themeError } =
      await applyCatalogAbortSignal(
        activeSupabaseClient
          .from(CATALOG_THEMES_TABLE)
          .select(
            'id, slug, display_name, public_display_name, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_logo_url, status, is_public',
          )
          .eq('slug', themeSlug)
          .eq('status', 'active')
          .eq('is_public', true)
          .limit(1),
        signal,
      );

    if (themeError) {
      throw new Error('Unable to load similar set theme.');
    }

    throwIfCatalogReadAborted(signal);

    const [themeRow] = (themeData as CatalogThemeRow[] | null) ?? [];

    if (!themeRow?.id) {
      return [];
    }

    const { data: setData, error: setError } = await applyCatalogAbortSignal(
      activeSupabaseClient
        .from(CATALOG_SETS_TABLE)
        .select(CATALOG_SET_SELECT_COLUMNS)
        .eq('status', 'active')
        .eq('primary_theme_id', themeRow.id)
        .order('release_year', { ascending: false })
        .order('name', { ascending: true })
        .order('set_id', { ascending: true })
        .range(0, 499),
      signal,
    );

    if (setError) {
      throw new Error('Unable to load similar set candidates.');
    }

    throwIfCatalogReadAborted(signal);

    const catalogRows = (setData as CatalogSetRow[] | null) ?? [];
    const publicThemeName =
      normalizeCatalogThemePublicText(themeRow.public_display_name) ??
      themeRow.display_name;
    const publicThemeLogoUrl = normalizeCatalogThemePublicLogoUrl(
      themeRow.public_logo_url,
    );
    const publicAccentColor = normalizeCatalogThemePublicAccentColor(
      themeRow.public_accent_color,
    );
    const publicSurfaceColor = normalizeCatalogThemePublicAccentColor(
      themeRow.public_surface_color,
    );
    const publicSurfaceTextColor = normalizeCatalogThemePublicTextColor(
      themeRow.public_surface_text_color,
    );
    const publicHeroTextColor = normalizeCatalogThemePublicTextColor(
      themeRow.public_hero_text_color,
    );
    const themeIdentity = resolveCatalogThemeIdentityFromPersistence({
      primaryThemeName: publicThemeName,
      sourceThemeName: undefined,
    });
    const publicTheme = publicThemeName
      ? {
          ...(publicAccentColor
            ? {
                accentColor: publicAccentColor,
              }
            : {}),
          ...(publicHeroTextColor
            ? {
                heroTextColor: publicHeroTextColor,
              }
            : {}),
          ...(publicThemeLogoUrl
            ? {
                logoUrl: publicThemeLogoUrl,
              }
            : {}),
          name: publicThemeName,
          slug: themeRow.slug ?? themeSlug,
          ...(publicSurfaceColor
            ? {
                surfaceColor: publicSurfaceColor,
              }
            : {}),
          ...(publicSurfaceTextColor
            ? {
                surfaceTextColor: publicSurfaceTextColor,
              }
            : {}),
        }
      : undefined;

    const canonicalCatalogSets = catalogRows.map((row) =>
      toCanonicalCatalogSetFromRow({
        row,
        themeIdentity: {
          ...themeIdentity,
          ...(publicThemeName
            ? {
                primaryTheme: publicThemeName,
              }
            : {}),
          ...(publicTheme
            ? {
                publicTheme,
              }
            : {}),
        },
      }),
    );
    const enrichedCatalogSets =
      await enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
        canonicalCatalogSets,
        supabaseClient: activeSupabaseClient,
      });

    return enrichedCatalogSets.map(toCatalogSetCardFromCanonicalSet);
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function listCatalogSetCards({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  limit = CATALOG_PUBLIC_DEFAULT_PAGE_SIZE,
  offset = 0,
  supabaseClient,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  limit?: number;
  offset?: number;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return listAllCatalogSetCards({
    listCanonicalCatalogSetsFn,
    limit,
    offset,
    supabaseClient,
  });
}

export interface CatalogCollectionLandingPageResult {
  bestPriceMinorBySetId: ReadonlyMap<string, number>;
  setCards: readonly CatalogHomepageSetCard[];
  totalSetCount: number;
}

const catalogAdultCollectorThemeSlugs = new Set([
  'architecture',
  'art',
  'botanicals',
  'icons',
  'ideas',
  'lord-of-the-rings',
  'technic',
]);

const catalogAdultCollectorDisplayThemeSlugs = new Set([
  'disney',
  'harry-potter',
  'marvel',
  'star-wars',
]);

const catalogAdultCollectorExcludedHighPieceThemeSlugs = new Set([
  'animal-crossing',
  'city',
  'disney',
  'dreamzzz',
  'duplo',
  'friends',
  'gabby-s-poppenhuis',
  'minecraft',
  'sonic-the-hedgehog',
  'super-mario',
]);

const CATALOG_COLLECTION_ADULT_CORE_THEME_MIN_PIECES = 600;
const CATALOG_COLLECTION_ADULT_DISPLAY_THEME_MIN_PIECES = 1_600;
const CATALOG_COLLECTION_ADULT_HIGH_PIECE_MIN_PIECES = 2_500;
const CATALOG_COLLECTION_CANDIDATE_LIMIT = 1_000;
const CATALOG_COLLECTION_CANDIDATE_PAGE_SIZE = 500;
const CATALOG_COLLECTION_LIVE_OFFER_FALLBACK_SET_LIMIT = 50;
const CATALOG_COLLECTION_RECENT_RELEASE_LOOKBACK_DAYS = 210;
const CATALOG_COLLECTION_RECENT_RELEASE_LOOKAHEAD_DAYS = 120;

function getCatalogCollectionThemeSlug(
  setCard: Pick<CatalogHomepageSetCard, 'publicTheme' | 'theme'>,
): string {
  return setCard.publicTheme?.slug ?? buildCatalogThemeSlug(setCard.theme);
}

function getCatalogCollectionReleaseTimestamp(
  setCard: Pick<
    CatalogHomepageSetCard,
    'releaseDate' | 'releaseDatePrecision' | 'releaseYear'
  >,
): number | undefined {
  const releaseDatePrecision = resolveCatalogReleaseDatePrecision({
    releaseDate: setCard.releaseDate,
    releaseDatePrecision: setCard.releaseDatePrecision,
    releaseYear: setCard.releaseYear,
  });

  if (releaseDatePrecision !== 'day' && releaseDatePrecision !== 'month') {
    return undefined;
  }

  const timestamp = setCard.releaseDate
    ? Date.parse(`${setCard.releaseDate}T00:00:00Z`)
    : Number.NaN;

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function matchesCatalogCollectionRecentRelease({
  now,
  setCard,
}: {
  now: Date;
  setCard: CatalogHomepageSetCard;
}): boolean {
  const releaseTimestamp = getCatalogCollectionReleaseTimestamp(setCard);

  const lowerBound =
    now.getTime() -
    CATALOG_COLLECTION_RECENT_RELEASE_LOOKBACK_DAYS * 86_400_000;
  const upperBound =
    now.getTime() +
    CATALOG_COLLECTION_RECENT_RELEASE_LOOKAHEAD_DAYS * 86_400_000;

  if (releaseTimestamp !== undefined) {
    return releaseTimestamp >= lowerBound && releaseTimestamp <= upperBound;
  }

  const releaseDatePrecision = resolveCatalogReleaseDatePrecision({
    releaseDate: setCard.releaseDate,
    releaseDatePrecision: setCard.releaseDatePrecision,
    releaseYear: setCard.releaseYear,
  });
  const currentYear = now.getUTCFullYear();

  return (
    releaseDatePrecision === 'year' &&
    setCard.releaseYear >= currentYear &&
    setCard.releaseYear <= currentYear + 1
  );
}

function matchesCatalogCollectionAdultCollector(
  setCard: CatalogHomepageSetCard,
): boolean {
  // Rebrickable does not give us a stable "Adults Welcome" browse flag in the
  // public catalog model. Keep this as an explicit, conservative score: real
  // 18+ overlays win first, then display-oriented themes and large builds.
  if ((setCard.recommendedAge ?? 0) >= 18) {
    return true;
  }

  const themeSlug = getCatalogCollectionThemeSlug(setCard);

  if (catalogAdultCollectorThemeSlugs.has(themeSlug)) {
    return setCard.pieces >= CATALOG_COLLECTION_ADULT_CORE_THEME_MIN_PIECES;
  }

  if (catalogAdultCollectorDisplayThemeSlugs.has(themeSlug)) {
    return setCard.pieces >= CATALOG_COLLECTION_ADULT_DISPLAY_THEME_MIN_PIECES;
  }

  return (
    setCard.pieces >= CATALOG_COLLECTION_ADULT_HIGH_PIECE_MIN_PIECES &&
    !catalogAdultCollectorExcludedHighPieceThemeSlugs.has(themeSlug)
  );
}

function matchesCatalogCollectionLandingPageConfig({
  bestPriceMinorBySetId,
  config,
  now,
  setCard,
}: {
  bestPriceMinorBySetId: ReadonlyMap<string, number>;
  config: CatalogCollectionLandingPageConfig;
  now: Date;
  setCard: CatalogHomepageSetCard;
}): boolean {
  const { filters } = config;

  if (
    typeof filters.maxBestPriceMinor === 'number' &&
    (bestPriceMinorBySetId.get(setCard.id) ?? Number.POSITIVE_INFINITY) >
      filters.maxBestPriceMinor
  ) {
    return false;
  }

  if (
    filters.themeSlugs?.length &&
    !filters.themeSlugs.includes(getCatalogCollectionThemeSlug(setCard))
  ) {
    return false;
  }

  if (
    filters.adultCollector &&
    !matchesCatalogCollectionAdultCollector(setCard)
  ) {
    return false;
  }

  if (
    filters.recentRelease &&
    !matchesCatalogCollectionRecentRelease({ now, setCard })
  ) {
    return false;
  }

  if (
    filters.setStatuses?.length &&
    (!setCard.setStatus || !filters.setStatuses.includes(setCard.setStatus))
  ) {
    return false;
  }

  return true;
}

function compareCatalogCollectionLandingPageSetCards({
  bestPriceMinorBySetId,
  sortKey,
}: {
  bestPriceMinorBySetId: ReadonlyMap<string, number>;
  sortKey: CatalogCollectionLandingPageSortKey;
}): (left: CatalogHomepageSetCard, right: CatalogHomepageSetCard) => number {
  return (left, right) => {
    if (sortKey === 'price-asc') {
      return (
        (bestPriceMinorBySetId.get(left.id) ?? Number.POSITIVE_INFINITY) -
          (bestPriceMinorBySetId.get(right.id) ?? Number.POSITIVE_INFINITY) ||
        right.releaseYear - left.releaseYear ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    if (sortKey === 'newest') {
      return (
        (getCatalogCollectionReleaseTimestamp(right) ??
          Date.UTC(right.releaseYear, 0, 1)) -
          (getCatalogCollectionReleaseTimestamp(left) ??
            Date.UTC(left.releaseYear, 0, 1)) ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    if (sortKey === 'pieces-desc') {
      return (
        right.pieces - left.pieces ||
        right.releaseYear - left.releaseYear ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      );
    }

    return (
      (right.recommendedAge ?? 0) - (left.recommendedAge ?? 0) ||
      right.pieces - left.pieces ||
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    );
  };
}

function toCatalogCollectionBestPriceMinorBySetId(
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>,
): Map<string, number> {
  return new Map(
    [...currentOfferSummaryBySetId.entries()].flatMap(([setId, summary]) => {
      const bestPriceMinor = summary.bestOffer?.priceCents;

      return typeof bestPriceMinor === 'number' && bestPriceMinor > 0
        ? [[setId, bestPriceMinor] as const]
        : [];
    }),
  );
}

async function listCatalogCollectionCandidateSetCards({
  listCanonicalCatalogSetsFn,
  supabaseClient,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogHomepageSetCard[]> {
  const pages: CatalogHomepageSetCard[][] = [];

  for (
    let offset = 0;
    offset < CATALOG_COLLECTION_CANDIDATE_LIMIT;
    offset += CATALOG_COLLECTION_CANDIDATE_PAGE_SIZE
  ) {
    const pageSetCards = await listCatalogSetCards({
      limit: CATALOG_COLLECTION_CANDIDATE_PAGE_SIZE,
      listCanonicalCatalogSetsFn,
      offset,
      supabaseClient,
    });

    pages.push(pageSetCards);

    if (pageSetCards.length < CATALOG_COLLECTION_CANDIDATE_PAGE_SIZE) {
      break;
    }
  }

  const seenSetIds = new Set<string>();

  return pages.flat().filter((setCard) => {
    if (seenSetIds.has(setCard.id)) {
      return false;
    }

    seenSetIds.add(setCard.id);

    return true;
  });
}

export async function getCatalogCollectionLandingPage({
  cacheOptions,
  config,
  limit = CATALOG_BROWSE_PAGE_SIZE,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  now = new Date(),
  offset = 0,
  sortKey,
  supabaseClient,
}: {
  cacheOptions?: CatalogApiReadCacheOptions;
  config: CatalogCollectionLandingPageConfig;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  offset?: number;
  sortKey: CatalogCollectionLandingPageSortKey;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCollectionLandingPageResult> {
  const safeLimit = normalizeCatalogReadLimit(limit, CATALOG_BROWSE_PAGE_SIZE);
  const safeOffset = normalizeCatalogReadOffset(offset);
  const scopedSetCards = config.filters.maxBestPriceMinor
    ? await listCatalogSetCardsByIds({
        canonicalIds: await listCatalogCurrentOfferCandidateSetIds({
          cacheOptions: cacheOptions
            ? {
                revalidateSeconds: cacheOptions.revalidateSeconds,
                tags: cacheOptions.tags ?? [],
              }
            : undefined,
          limit: CATALOG_COLLECTION_CANDIDATE_LIMIT,
          supabaseClient,
        }),
        listCanonicalCatalogSetsFn,
        supabaseClient,
      })
    : await listCatalogCollectionCandidateSetCards({
        listCanonicalCatalogSetsFn,
        supabaseClient,
      });
  const statusOverlaySetCards = config.filters.setStatuses?.length
    ? await listCatalogSetCardsByIds({
        canonicalIds: listCatalogOverlaySetIdsByStatus(
          config.filters.setStatuses,
        ).filter(
          (canonicalId) =>
            !scopedSetCards.some((setCard) => setCard.id === canonicalId),
        ),
        listCanonicalCatalogSetsFn,
        supabaseClient,
      })
    : [];
  const candidateSetCards = [...scopedSetCards, ...statusOverlaySetCards];
  const currentOfferSummaryBySetId = config.filters.maxBestPriceMinor
    ? await listCatalogCurrentOfferSummariesBySetIds({
        cacheOptions,
        liveFallbackSetIdLimit:
          CATALOG_COLLECTION_LIVE_OFFER_FALLBACK_SET_LIMIT,
        setIds: candidateSetCards.map((setCard) => setCard.id),
        supabaseClient,
      })
    : new Map<string, CatalogCurrentOfferSummary>();
  const bestPriceMinorBySetId = toCatalogCollectionBestPriceMinorBySetId(
    currentOfferSummaryBySetId,
  );
  const matchingSetCards = candidateSetCards
    .filter((setCard) =>
      matchesCatalogCollectionLandingPageConfig({
        bestPriceMinorBySetId,
        config,
        now,
        setCard,
      }),
    )
    .sort(
      compareCatalogCollectionLandingPageSetCards({
        bestPriceMinorBySetId,
        sortKey,
      }),
    );

  return {
    bestPriceMinorBySetId,
    setCards: matchingSetCards.slice(safeOffset, safeOffset + safeLimit),
    totalSetCount: matchingSetCards.length,
  };
}

function selectCatalogSetCardsByIds({
  canonicalIds,
  setCards,
}: {
  canonicalIds: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const setCardById = new Map(
    setCards.map((catalogSetCard) => [catalogSetCard.id, catalogSetCard]),
  );

  return canonicalIds.flatMap((canonicalId) => {
    const catalogSetCard = setCardById.get(canonicalId);

    return catalogSetCard ? [catalogSetCard] : [];
  });
}

function getCatalogDiscoverySignalAgeDays(observedAt: string): number {
  const observedTimestamp = Date.parse(observedAt);

  if (!Number.isFinite(observedTimestamp)) {
    return 30;
  }

  const elapsedMilliseconds = Math.max(0, Date.now() - observedTimestamp);

  return elapsedMilliseconds / (1000 * 60 * 60 * 24);
}

function getCatalogDiscoveryFreshnessScore(observedAt: string): number {
  return Math.max(0, 21 - getCatalogDiscoverySignalAgeDays(observedAt)) * 2.5;
}

function getCatalogComparisonDiscoveryScore(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): number {
  const coverageScore = Math.min(catalogDiscoverySignal.merchantCount, 6) * 18;
  const spreadScore = Math.min(
    catalogDiscoverySignal.priceSpreadMinor / 150,
    60,
  );
  const freshnessScore = getCatalogDiscoveryFreshnessScore(
    catalogDiscoverySignal.observedAt,
  );
  const bestOfferClarityScore =
    typeof catalogDiscoverySignal.referenceDeltaMinor === 'number' &&
    catalogDiscoverySignal.referenceDeltaMinor < 0
      ? Math.min(Math.abs(catalogDiscoverySignal.referenceDeltaMinor) / 250, 20)
      : 0;

  return coverageScore + spreadScore + freshnessScore + bestOfferClarityScore;
}

function getCatalogBestDealDiscoveryScore(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): number {
  const referenceDiscountScore =
    typeof catalogDiscoverySignal.referenceDeltaMinor === 'number' &&
    catalogDiscoverySignal.referenceDeltaMinor < 0
      ? Math.min(Math.abs(catalogDiscoverySignal.referenceDeltaMinor) / 125, 90)
      : 0;
  const spreadScore = Math.min(
    catalogDiscoverySignal.priceSpreadMinor / 180,
    45,
  );
  const recentDropScore =
    typeof catalogDiscoverySignal.recentReferencePriceChangeMinor ===
      'number' &&
    catalogDiscoverySignal.recentReferencePriceChangeMinor < 0 &&
    getCatalogSignalAgeHours(
      catalogDiscoverySignal.recentReferencePriceChangedAt,
    ) <= 48
      ? Math.min(
          Math.abs(catalogDiscoverySignal.recentReferencePriceChangeMinor) /
            120,
          55,
        )
      : 0;
  const coverageScore = Math.min(catalogDiscoverySignal.merchantCount, 6) * 10;
  const freshnessScore =
    getCatalogDiscoveryFreshnessScore(catalogDiscoverySignal.observedAt) * 0.7;

  return (
    referenceDiscountScore +
    recentDropScore +
    spreadScore +
    coverageScore +
    freshnessScore
  );
}

function getCatalogFollowDiscoveryThemeScore(theme: string): number {
  const themeSlug = buildCatalogThemeSlug(theme);

  if (
    [
      'star-wars',
      'architecture',
      'icons',
      'lord-of-the-rings',
      'harry-potter',
    ].includes(themeSlug)
  ) {
    return 48;
  }

  if (themeSlug === 'technic') {
    return 34;
  }

  if (themeSlug === 'ideas') {
    return 32;
  }

  if (themeSlug === 'botanicals') {
    return 30;
  }

  if (themeSlug === 'art') {
    return 24;
  }

  if (
    ['speed-champions', 'marvel', 'dc', 'disney', 'jurassic-world'].includes(
      themeSlug,
    )
  ) {
    return 18;
  }

  return 0;
}

function getCatalogFollowDiscoveryNameScore(name: string): number {
  const normalizedName = normalizeCatalogAsciiText(name);
  let score = 0;

  if (
    /\b(ucs|ultimate collector|rivendell|barad dur|millennium falcon|at-at|death star|hogwarts|enterprise|starry night|van gogh|t rex|jaws|orient express|lion knights castle|blacktron)\b/u.test(
      normalizedName,
    )
  ) {
    score += 48;
  }

  if (
    /\b(shuttle|starfighter|ship|falcon|x-wing|tie fighter|vehicle|car|f1|formula|helmet|tower|castle|skyline|building|landmark|botanical|bouquet|orchid|bamboo|lighthouse|display|diorama|modular)\b/u.test(
      normalizedName,
    )
  ) {
    score += 28;
  }

  return score;
}

function getCatalogFollowDiscoveryQualityPenalty({
  name,
  pieces,
  theme,
}: Pick<CatalogHomepageSetCard, 'name' | 'pieces' | 'theme'>): number {
  const normalizedName = normalizeCatalogAsciiText(name);
  const themeSlug = buildCatalogThemeSlug(theme);

  if (
    /\b(polybag|keychain|key chain|magnet|book|magazine|activity book|sticker|storage|lunch box|plush|costume|watch|clock|calendar|game|videogame|video game|software)\b/u.test(
      normalizedName,
    )
  ) {
    return 95;
  }

  if (pieces < 80) {
    return 75;
  }

  if (
    pieces < 250 &&
    ![
      'star-wars',
      'architecture',
      'icons',
      'lord-of-the-rings',
      'harry-potter',
      'botanicals',
      'ideas',
      'technic',
    ].includes(themeSlug) &&
    !/\b(helmet|shuttle|starfighter|ship|skyline|display|bouquet|orchid|vehicle|car)\b/u.test(
      normalizedName,
    )
  ) {
    return 45;
  }

  if (pieces < 140) {
    return 35;
  }

  return 0;
}

function getCatalogFollowDiscoveryReleaseScore({
  releaseDate,
  releaseYear,
}: Pick<CatalogHomepageSetCard, 'releaseDate' | 'releaseYear'>): number {
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  if (releaseDate) {
    const releaseTimestamp = Date.parse(`${releaseDate}T00:00:00Z`);

    if (Number.isFinite(releaseTimestamp)) {
      const daysUntilRelease = Math.floor(
        (releaseTimestamp - now.getTime()) / 86_400_000,
      );

      if (daysUntilRelease >= 0 && daysUntilRelease <= 365) {
        return 62;
      }

      if (daysUntilRelease < 0 && daysUntilRelease >= -180) {
        return 42;
      }
    }
  }

  if (releaseYear > currentYear) {
    return 52;
  }

  if (releaseYear === currentYear) {
    return 36;
  }

  if (releaseYear === currentYear - 1) {
    return 18;
  }

  return 0;
}

function getCatalogFollowDiscoveryPieceScore({
  pieces,
  theme,
}: Pick<CatalogHomepageSetCard, 'pieces' | 'theme'>): number {
  const themeSlug = buildCatalogThemeSlug(theme);

  if (pieces >= 5000) {
    return 58;
  }

  if (pieces >= 3000) {
    return 48;
  }

  if (pieces >= 2000) {
    return 38;
  }

  if (pieces >= 1200) {
    return 30;
  }

  if (pieces >= 650) {
    return themeSlug === 'technic' ? 32 : 18;
  }

  if (pieces >= 250) {
    return 6;
  }

  if (pieces >= 120) {
    return -35;
  }

  return -90;
}

function getCatalogFollowDiscoveryScore({
  catalogDiscoverySignal,
  rotationSeed,
  setCard,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  rotationSeed?: number;
  setCard: CatalogHomepageSetCard;
}): number {
  const signalScore = catalogDiscoverySignal
    ? Math.min(catalogDiscoverySignal.merchantCount, 6) * 10 +
      Math.min(catalogDiscoverySignal.bestPriceMinor / 2500, 32) +
      Math.min(catalogDiscoverySignal.priceSpreadMinor / 400, 24) +
      getCatalogDiscoveryFreshnessScore(catalogDiscoverySignal.observedAt) * 0.5
    : 0;
  const visualScore = setCard.imageUrl || setCard.primaryImage ? 22 : 0;
  const rotationScore =
    getCatalogRailRotationScore({
      rotationSeed,
      setId: setCard.id,
    }) / 9973;

  return (
    getCatalogFollowDiscoveryThemeScore(setCard.theme) +
    getCatalogFollowDiscoveryNameScore(setCard.name) +
    getCatalogFollowDiscoveryReleaseScore(setCard) +
    getCatalogFollowDiscoveryPieceScore(setCard) +
    signalScore +
    visualScore +
    rotationScore * 18 -
    getCatalogFollowDiscoveryQualityPenalty(setCard)
  );
}

function getCatalogFollowDiscoverySizeBucket(pieces: number): string {
  if (pieces >= 3000) {
    return 'large-display';
  }

  if (pieces >= 1200) {
    return 'display';
  }

  if (pieces >= 500) {
    return 'mid-size';
  }

  return 'small';
}

function getCatalogFollowDiscoveryTimingBucket({
  releaseDate,
  releaseYear,
}: Pick<CatalogHomepageSetCard, 'releaseDate' | 'releaseYear'>): string {
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  if (releaseDate) {
    const releaseTimestamp = Date.parse(`${releaseDate}T00:00:00Z`);

    if (Number.isFinite(releaseTimestamp)) {
      const daysUntilRelease = Math.floor(
        (releaseTimestamp - now.getTime()) / 86_400_000,
      );

      if (daysUntilRelease >= 0) {
        return 'upcoming';
      }

      if (daysUntilRelease >= -120) {
        return 'recent';
      }
    }
  }

  if (releaseYear > currentYear) {
    return 'upcoming';
  }

  if (releaseYear >= currentYear - 1) {
    return 'recent';
  }

  return 'evergreen';
}

function getCatalogFollowDiscoveryTypeBucket(name: string): string {
  const normalizedName = normalizeCatalogAsciiText(name);

  if (/\b(helmet|helm)\b/u.test(normalizedName)) {
    return 'helmet';
  }

  if (
    /\b(shuttle|starfighter|ship|falcon|vehicle|car|auto)\b/u.test(
      normalizedName,
    )
  ) {
    return 'vehicle';
  }

  if (
    /\b(skyline|building|tower|castle|architecture)\b/u.test(normalizedName)
  ) {
    return 'architecture';
  }

  if (/\b(botanical|bouquet|flower|plant|bamboo)\b/u.test(normalizedName)) {
    return 'botanical';
  }

  if (/\b(figure|minifigure|character)\b/u.test(normalizedName)) {
    return 'figure';
  }

  return 'display';
}

function getCatalogFollowDiscoveryExposurePenalty({
  rotationSeed,
  setId,
}: {
  rotationSeed?: number;
  setId: string;
}): number {
  const seed = getCatalogRailRotationSeed(rotationSeed);
  const currentBucket = Math.abs(seed) % 4;
  const setBucket =
    getCatalogRailRotationScore({
      rotationSeed: 0,
      setId,
    }) % 4;

  return setBucket === currentBucket
    ? 0
    : Math.abs(setBucket - currentBucket) * 12;
}

function getCatalogSimilarSetPriceProximityScore({
  candidateBestPriceMinor,
  referenceBestPriceMinor,
}: {
  candidateBestPriceMinor?: number;
  referenceBestPriceMinor?: number;
}): number {
  if (
    typeof candidateBestPriceMinor !== 'number' ||
    typeof referenceBestPriceMinor !== 'number' ||
    candidateBestPriceMinor <= 0 ||
    referenceBestPriceMinor <= 0
  ) {
    return 0;
  }

  const relativeGap =
    Math.abs(candidateBestPriceMinor - referenceBestPriceMinor) /
    Math.max(candidateBestPriceMinor, referenceBestPriceMinor);

  return Math.max(0, 54 - relativeGap * 108);
}

function getCatalogSimilarSetPieceProximityScore({
  candidatePieces,
  currentPieces,
}: {
  candidatePieces: number;
  currentPieces: number;
}): number {
  if (candidatePieces <= 0 || currentPieces <= 0) {
    return 0;
  }

  const pieceGapRatio =
    Math.abs(candidatePieces - currentPieces) /
    Math.max(candidatePieces, currentPieces);

  return Math.max(0, 42 - pieceGapRatio * 84);
}

function getCatalogSimilarSetReleaseYearScore({
  candidateReleaseYear,
  currentReleaseYear,
}: {
  candidateReleaseYear: number;
  currentReleaseYear: number;
}): number {
  const releaseYearGap = Math.abs(candidateReleaseYear - currentReleaseYear);

  return Math.max(0, 12 - releaseYearGap * 3);
}

function getCatalogSimilarSetComparisonReadinessScore(
  catalogDiscoverySignal?: CatalogDiscoverySignal,
): number {
  if (!catalogDiscoverySignal) {
    return 0;
  }

  const coverageScore = Math.min(catalogDiscoverySignal.merchantCount, 6) * 4;
  const spreadScore = Math.min(
    catalogDiscoverySignal.priceSpreadMinor / 500,
    12,
  );
  const freshnessScore =
    getCatalogDiscoveryFreshnessScore(catalogDiscoverySignal.observedAt) * 0.3;

  return coverageScore + spreadScore + freshnessScore;
}

function getCatalogRecentPriceChangeScore(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): number {
  if (
    catalogDiscoverySignal.merchantCount < 2 ||
    typeof catalogDiscoverySignal.recentReferencePriceChangeMinor !==
      'number' ||
    catalogDiscoverySignal.recentReferencePriceChangeMinor >= 0 ||
    typeof catalogDiscoverySignal.recentReferencePriceChangedAt !== 'string' ||
    getCatalogSignalAgeHours(
      catalogDiscoverySignal.recentReferencePriceChangedAt,
    ) > 48
  ) {
    return 0;
  }

  const changeMagnitudeScore = Math.min(
    Math.abs(catalogDiscoverySignal.recentReferencePriceChangeMinor) / 150,
    70,
  );
  const recencyScore =
    getCatalogDiscoveryFreshnessScore(
      catalogDiscoverySignal.recentReferencePriceChangedAt,
    ) * 1.3;
  const coverageScore = Math.min(catalogDiscoverySignal.merchantCount, 6) * 6;
  const spreadScore = Math.min(
    catalogDiscoverySignal.priceSpreadMinor / 600,
    16,
  );

  return changeMagnitudeScore + recencyScore + coverageScore + spreadScore;
}

function getCatalogSignalAgeHours(timestamp?: string): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedTimestamp = Date.parse(timestamp);

  if (!Number.isFinite(parsedTimestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Date.now() - parsedTimestamp) / (1000 * 60 * 60);
}

function getCatalogNowInterestingScore(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): number {
  const recentChangeAgeHours = getCatalogSignalAgeHours(
    catalogDiscoverySignal.recentReferencePriceChangedAt,
  );
  const recentChangeRecencyScore =
    recentChangeAgeHours <= 48
      ? Math.max(0, 48 - recentChangeAgeHours) * 1.4
      : 0;
  const recentChangeMagnitudeScore =
    typeof catalogDiscoverySignal.recentReferencePriceChangeMinor === 'number'
      ? Math.min(
          Math.abs(catalogDiscoverySignal.recentReferencePriceChangeMinor) /
            125,
          46,
        )
      : 0;
  const spreadScore = Math.min(
    catalogDiscoverySignal.priceSpreadMinor / 175,
    34,
  );
  const coverageScore = Math.min(catalogDiscoverySignal.merchantCount, 6) * 8;
  const freshnessScore =
    getCatalogDiscoveryFreshnessScore(catalogDiscoverySignal.observedAt) * 0.8;

  return (
    recentChangeRecencyScore +
    recentChangeMagnitudeScore +
    spreadScore +
    coverageScore +
    freshnessScore
  );
}

function isCatalogInterestingNowCandidate(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): boolean {
  const hasRecentPriceDrop =
    typeof catalogDiscoverySignal.recentReferencePriceChangeMinor ===
      'number' &&
    catalogDiscoverySignal.recentReferencePriceChangeMinor < 0 &&
    getCatalogSignalAgeHours(
      catalogDiscoverySignal.recentReferencePriceChangedAt,
    ) <= 48;
  const isBelowReference =
    typeof catalogDiscoverySignal.referenceDeltaMinor === 'number' &&
    catalogDiscoverySignal.referenceDeltaMinor < 0;

  return hasRecentPriceDrop || isBelowReference;
}

function isCatalogBestDealCandidate(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): boolean {
  return hasReliableCatalogReferenceDiscount(catalogDiscoverySignal);
}

const HOMEPAGE_PRIMARY_DEAL_MIN_MERCHANT_COUNT = 2;
const HOMEPAGE_PRIMARY_DEAL_MIN_REFERENCE_DISCOUNT_MINOR = 1000;
const HOMEPAGE_PRIMARY_DEAL_MIN_REFERENCE_DISCOUNT_RATIO = 0.03;
const HOMEPAGE_PRIMARY_DEAL_SUSPICIOUS_SPREAD_RATIO = 4;
const HOMEPAGE_PRIMARY_DEAL_SUSPICIOUS_SPREAD_MINOR = 2500;

function hasReliableCatalogReferenceDiscount(
  catalogDiscoverySignal?: CatalogDiscoverySignal,
): boolean {
  if (
    !catalogDiscoverySignal ||
    typeof catalogDiscoverySignal.referenceDeltaMinor !== 'number' ||
    catalogDiscoverySignal.referenceDeltaMinor >= 0 ||
    catalogDiscoverySignal.bestPriceMinor <= 0
  ) {
    return false;
  }

  const referencePriceMinor =
    catalogDiscoverySignal.bestPriceMinor -
    catalogDiscoverySignal.referenceDeltaMinor;
  const discountMinor = Math.abs(catalogDiscoverySignal.referenceDeltaMinor);

  return (
    referencePriceMinor > 0 &&
    discountMinor >= HOMEPAGE_PRIMARY_DEAL_MIN_REFERENCE_DISCOUNT_MINOR &&
    discountMinor / referencePriceMinor >=
      HOMEPAGE_PRIMARY_DEAL_MIN_REFERENCE_DISCOUNT_RATIO
  );
}

function hasSuspiciousCatalogDealSpread(
  catalogDiscoverySignal?: CatalogDiscoverySignal,
): boolean {
  if (
    !catalogDiscoverySignal ||
    typeof catalogDiscoverySignal.nextBestPriceMinor !== 'number' ||
    catalogDiscoverySignal.bestPriceMinor <= 0
  ) {
    return false;
  }

  return (
    catalogDiscoverySignal.priceSpreadMinor >=
      HOMEPAGE_PRIMARY_DEAL_SUSPICIOUS_SPREAD_MINOR &&
    catalogDiscoverySignal.nextBestPriceMinor /
      catalogDiscoverySignal.bestPriceMinor >=
      HOMEPAGE_PRIMARY_DEAL_SUSPICIOUS_SPREAD_RATIO
  );
}

function hasCatalogComparableUnitMismatch(
  currentOfferSummary?: CatalogCurrentOfferSummary,
): boolean {
  const comparisonGroups = new Set(
    [currentOfferSummary?.bestOffer, ...(currentOfferSummary?.offers ?? [])]
      .map((catalogOffer) =>
        getCommerceCommercialUnitComparisonGroup(
          catalogOffer?.commercialUnitType,
        ),
      )
      .filter((comparisonGroup) => comparisonGroup !== 'unknown'),
  );

  return comparisonGroups.size > 1;
}

function canCatalogOfferDrivePrimaryDealClaims(
  catalogOffer?: CatalogResolvedOffer,
): boolean {
  return (
    Boolean(catalogOffer?.url) &&
    (catalogOffer?.priceCents ?? 0) > 0 &&
    catalogOffer?.availability === 'in_stock' &&
    isCommerceCommercialUnitComparableForDeals(
      catalogOffer.commercialUnitType,
    ) &&
    isCommerceMerchantProductionFeed(
      getCatalogOfferMerchantReliabilityKey(catalogOffer),
    )
  );
}

function isCatalogPrimaryDealCandidate({
  catalogDiscoverySignal,
  currentOfferSummary,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentOfferSummary?: CatalogCurrentOfferSummary;
}): boolean {
  return (
    (catalogDiscoverySignal?.merchantCount ?? 0) >=
      HOMEPAGE_PRIMARY_DEAL_MIN_MERCHANT_COUNT &&
    getCatalogOfferMerchantCount(currentOfferSummary) >=
      HOMEPAGE_PRIMARY_DEAL_MIN_MERCHANT_COUNT &&
    canCatalogOfferDrivePrimaryDealClaims(currentOfferSummary?.bestOffer) &&
    hasReliableCatalogReferenceDiscount(catalogDiscoverySignal) &&
    !hasSuspiciousCatalogDealSpread(catalogDiscoverySignal) &&
    !hasCatalogComparableUnitMismatch(currentOfferSummary)
  );
}

const HOMEPAGE_SOFT_DEAL_MIN_REFERENCE_DISCOUNT_MINOR = 500;
const HOMEPAGE_SOFT_DEAL_MIN_REFERENCE_DISCOUNT_RATIO = 0.015;
const HOMEPAGE_SOFT_DEAL_MIN_RECENT_DROP_MINOR = 250;

function hasSoftCatalogReferenceSignal(
  catalogDiscoverySignal?: CatalogDiscoverySignal,
): boolean {
  if (!catalogDiscoverySignal || catalogDiscoverySignal.bestPriceMinor <= 0) {
    return false;
  }

  if (
    typeof catalogDiscoverySignal.recentReferencePriceChangeMinor ===
      'number' &&
    catalogDiscoverySignal.recentReferencePriceChangeMinor <=
      -HOMEPAGE_SOFT_DEAL_MIN_RECENT_DROP_MINOR &&
    getCatalogSignalAgeHours(
      catalogDiscoverySignal.recentReferencePriceChangedAt,
    ) <= 72
  ) {
    return true;
  }

  if (
    typeof catalogDiscoverySignal.referenceDeltaMinor !== 'number' ||
    catalogDiscoverySignal.referenceDeltaMinor >= 0
  ) {
    return false;
  }

  const referencePriceMinor =
    catalogDiscoverySignal.bestPriceMinor -
    catalogDiscoverySignal.referenceDeltaMinor;
  const discountMinor = Math.abs(catalogDiscoverySignal.referenceDeltaMinor);

  return (
    referencePriceMinor > 0 &&
    discountMinor >= HOMEPAGE_SOFT_DEAL_MIN_REFERENCE_DISCOUNT_MINOR &&
    discountMinor / referencePriceMinor >=
      HOMEPAGE_SOFT_DEAL_MIN_REFERENCE_DISCOUNT_RATIO
  );
}

function canCatalogSetDriveSoftPriceOpportunity({
  catalogDiscoverySignal,
  currentOfferSummary,
  setCard,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentOfferSummary?: CatalogCurrentOfferSummary;
  setCard: Pick<CatalogHomepageSetCard, 'name' | 'pieces' | 'theme'>;
}): boolean {
  return (
    canCatalogOfferDrivePrimaryDealClaims(currentOfferSummary?.bestOffer) &&
    hasSoftCatalogReferenceSignal(catalogDiscoverySignal) &&
    !hasSuspiciousCatalogDealSpread(catalogDiscoverySignal) &&
    !hasCatalogComparableUnitMismatch(currentOfferSummary) &&
    getCatalogFollowDiscoveryQualityPenalty(setCard) < 75
  );
}

function getCatalogRailRotationSeed(rotationSeed?: number): number {
  if (typeof rotationSeed === 'number' && Number.isFinite(rotationSeed)) {
    return Math.trunc(rotationSeed);
  }

  return Math.floor(Date.now() / (1000 * 60 * 15));
}

function getCatalogRailRotationScore({
  rotationSeed,
  setId,
}: {
  rotationSeed?: number;
  setId: string;
}): number {
  const seed = getCatalogRailRotationSeed(rotationSeed);
  let hash = seed;

  for (const character of setId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9973;
  }

  return hash;
}

function sortCatalogRailCandidatesWithRotation<
  Candidate extends {
    catalogDiscoverySignal: CatalogDiscoverySignal;
    score: number;
    setCard: Pick<
      CatalogHomepageSetCard,
      'id' | 'name' | 'pieces' | 'releaseYear'
    >;
  },
>({
  candidates,
  rotationSeed,
}: {
  candidates: readonly Candidate[];
  rotationSeed?: number;
}): Candidate[] {
  return [...candidates].sort(
    (left, right) =>
      right.score - left.score ||
      right.catalogDiscoverySignal.merchantCount -
        left.catalogDiscoverySignal.merchantCount ||
      right.catalogDiscoverySignal.priceSpreadMinor -
        left.catalogDiscoverySignal.priceSpreadMinor ||
      getCatalogRailRotationScore({
        rotationSeed,
        setId: right.setCard.id,
      }) -
        getCatalogRailRotationScore({
          rotationSeed,
          setId: left.setCard.id,
        }) ||
      right.setCard.releaseYear - left.setCard.releaseYear ||
      right.setCard.pieces - left.setCard.pieces ||
      left.setCard.name.localeCompare(right.setCard.name) ||
      left.setCard.id.localeCompare(right.setCard.id),
  );
}

function hasCatalogCurrentPartnerOffer(
  currentOfferSummary?: CatalogCurrentOfferSummary,
): boolean {
  const bestOffer = currentOfferSummary?.bestOffer;

  return Boolean(
    bestOffer?.url &&
      bestOffer.priceCents > 0 &&
      (!bestOffer.availability || bestOffer.availability !== 'out_of_stock'),
  );
}

function getCatalogOfferMerchantCount(
  currentOfferSummary?: CatalogCurrentOfferSummary,
): number {
  return Math.max(
    currentOfferSummary?.offers.length ?? 0,
    currentOfferSummary?.bestOffer ? 1 : 0,
  );
}

function getCatalogCurrentOfferPriceSpreadMinor(
  currentOfferSummary?: CatalogCurrentOfferSummary,
): number {
  const prices = (currentOfferSummary?.offers ?? [])
    .map((catalogOffer) => catalogOffer.priceCents)
    .filter((priceCents) => priceCents > 0);

  if (prices.length < 2) {
    return 0;
  }

  return Math.max(...prices) - Math.min(...prices);
}

function getCatalogPartnerOfferScore({
  catalogDiscoverySignal,
  currentOfferSummary,
  rotationSeed,
  setCard,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentOfferSummary?: CatalogCurrentOfferSummary;
  rotationSeed?: number;
  setCard: CatalogHomepageSetCard;
}): number {
  const bestOffer = currentOfferSummary?.bestOffer;
  const merchantCount = Math.max(
    getCatalogOfferMerchantCount(currentOfferSummary),
    catalogDiscoverySignal?.merchantCount ?? 0,
  );
  const priceSpreadMinor = Math.max(
    catalogDiscoverySignal?.priceSpreadMinor ?? 0,
    getCatalogCurrentOfferPriceSpreadMinor(currentOfferSummary),
  );
  const baseBuyableScore = bestOffer?.url && bestOffer.priceCents > 0 ? 90 : 0;
  const inStockScore = bestOffer?.availability === 'in_stock' ? 80 : 30;
  const coverageScore = Math.min(merchantCount, 6) * 16;
  const multipleShopScore = merchantCount >= 2 ? 28 : 0;
  const discountScore =
    typeof catalogDiscoverySignal?.referenceDeltaMinor === 'number' &&
    catalogDiscoverySignal.referenceDeltaMinor < 0
      ? Math.min(Math.abs(catalogDiscoverySignal.referenceDeltaMinor) / 150, 70)
      : 0;
  const recentDropScore =
    typeof catalogDiscoverySignal?.recentReferencePriceChangeMinor ===
      'number' && catalogDiscoverySignal.recentReferencePriceChangeMinor < 0
      ? Math.min(
          Math.abs(catalogDiscoverySignal.recentReferencePriceChangeMinor) /
            120,
          40,
        )
      : 0;
  const spreadScore = Math.min(priceSpreadMinor / 350, 34);
  const releaseScore = Math.max(0, setCard.releaseYear - 2020) * 3;

  return (
    baseBuyableScore +
    inStockScore +
    coverageScore +
    multipleShopScore +
    discountScore +
    recentDropScore +
    spreadScore +
    releaseScore +
    getCatalogRailRotationScore({
      rotationSeed,
      setId: setCard.id,
    }) /
      9973
  );
}

function getCatalogPartnerOfferDiscountScore(
  catalogDiscoverySignal?: CatalogDiscoverySignal,
): number {
  return typeof catalogDiscoverySignal?.referenceDeltaMinor === 'number' &&
    catalogDiscoverySignal.referenceDeltaMinor < 0
    ? Math.min(Math.abs(catalogDiscoverySignal.referenceDeltaMinor) / 150, 70)
    : 0;
}

export function getCatalogPartnerOfferRailDiagnostics({
  catalogDiscoverySignalBySetId,
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  limit = 10,
  rotationSeed,
  setCards,
}: {
  catalogDiscoverySignalBySetId: ReadonlyMap<string, CatalogDiscoverySignal>;
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  excludedSetIds?: readonly string[];
  limit?: number;
  rotationSeed?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogPartnerOfferRailDiagnostic[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return setCards.slice(0, limit).map((setCard) => {
    const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
    const bestOffer = currentOfferSummary?.bestOffer;
    const catalogDiscoverySignal = catalogDiscoverySignalBySetId.get(
      setCard.id,
    );
    const hasPrice =
      typeof bestOffer?.priceCents === 'number' && bestOffer.priceCents > 0;
    const hasDeeplink =
      typeof bestOffer?.url === 'string' && bestOffer.url.length > 0;
    const inStock = bestOffer?.availability === 'in_stock';
    const priceSpread = Math.max(
      catalogDiscoverySignal?.priceSpreadMinor ?? 0,
      getCatalogCurrentOfferPriceSpreadMinor(currentOfferSummary),
    );
    const discountScore = getCatalogPartnerOfferDiscountScore(
      catalogDiscoverySignal,
    );
    const finalScore =
      currentOfferSummary && bestOffer
        ? getCatalogPartnerOfferScore({
            catalogDiscoverySignal,
            currentOfferSummary,
            rotationSeed,
            setCard,
          })
        : 0;
    const excludedReason = (() => {
      if (excludedSetIdSet.has(setCard.id)) {
        return 'excluded_set' as const;
      }

      if (!currentOfferSummary) {
        return 'missing_summary' as const;
      }

      if (!bestOffer) {
        return 'missing_best_offer' as const;
      }

      if (!hasPrice) {
        return 'missing_price' as const;
      }

      if (!hasDeeplink) {
        return 'missing_deeplink' as const;
      }

      if (bestOffer.availability === 'out_of_stock') {
        return 'out_of_stock' as const;
      }

      return 'included' as const;
    })();

    return {
      discountScore,
      excludedReason,
      finalScore,
      hasDeeplink,
      hasPrice,
      inStock,
      priceSpread,
      setId: setCard.id,
    };
  });
}

export function rankCatalogPartnerOfferSetCards({
  catalogDiscoverySignalBySetId,
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  limit = 6,
  requirePrimaryDealQuality = false,
  rotationSeed,
  setCards,
}: {
  catalogDiscoverySignalBySetId: ReadonlyMap<string, CatalogDiscoverySignal>;
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  excludedSetIds?: readonly string[];
  limit?: number;
  requirePrimaryDealQuality?: boolean;
  rotationSeed?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return [...setCards]
    .filter((setCard) => {
      const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
      const catalogDiscoverySignal = catalogDiscoverySignalBySetId.get(
        setCard.id,
      );

      return (
        !excludedSetIdSet.has(setCard.id) &&
        hasCatalogCurrentPartnerOffer(currentOfferSummary) &&
        (!requirePrimaryDealQuality ||
          isCatalogPrimaryDealCandidate({
            catalogDiscoverySignal,
            currentOfferSummary,
          }))
      );
    })
    .sort(
      (left, right) =>
        getCatalogPartnerOfferScore({
          catalogDiscoverySignal: catalogDiscoverySignalBySetId.get(right.id),
          currentOfferSummary: currentOfferSummaryBySetId.get(right.id),
          rotationSeed,
          setCard: right,
        }) -
          getCatalogPartnerOfferScore({
            catalogDiscoverySignal: catalogDiscoverySignalBySetId.get(left.id),
            currentOfferSummary: currentOfferSummaryBySetId.get(left.id),
            rotationSeed,
            setCard: left,
          }) ||
        right.releaseYear - left.releaseYear ||
        right.pieces - left.pieces ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}

export function selectCatalogFirstCommerceRailSetCards({
  limit,
  scoredCommerceCandidateSetCards,
  strictDealSetCards,
}: {
  limit: number;
  scoredCommerceCandidateSetCards: readonly CatalogHomepageSetCard[];
  strictDealSetCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const seenSetIds = new Set<string>();
  const selectedSetCards: CatalogHomepageSetCard[] = [];

  for (const setCard of [
    ...strictDealSetCards,
    ...scoredCommerceCandidateSetCards,
  ]) {
    if (selectedSetCards.length >= limit || seenSetIds.has(setCard.id)) {
      continue;
    }

    seenSetIds.add(setCard.id);
    selectedSetCards.push(setCard);
  }

  return selectedSetCards;
}

export function getCatalogHomepageDealQualityDiagnostics({
  catalogDiscoverySignalBySetId,
  currentOfferSummaryBySetId,
  selectedSetCards,
  softSetCards = [],
  strongSetCards,
  setCards,
}: {
  catalogDiscoverySignalBySetId: ReadonlyMap<string, CatalogDiscoverySignal>;
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  selectedSetCards: readonly Pick<CatalogHomepageSetCard, 'id'>[];
  softSetCards?: readonly Pick<CatalogHomepageSetCard, 'id'>[];
  strongSetCards?: readonly Pick<CatalogHomepageSetCard, 'id'>[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageDealQualityDiagnostics {
  let excludedMissingReferenceDiscountCount = 0;
  let excludedUnitMismatchCount = 0;
  let excludedUntrustedMerchantCount = 0;
  let excludedUnknownUnitCount = 0;
  let excludedUnknownVerdictCount = 0;
  let softDealCandidates = 0;
  let strongDealCandidates = 0;

  for (const setCard of setCards) {
    const currentOfferSummary = currentOfferSummaryBySetId.get(setCard.id);
    const catalogDiscoverySignal = catalogDiscoverySignalBySetId.get(
      setCard.id,
    );

    if (!hasCatalogCurrentPartnerOffer(currentOfferSummary)) {
      continue;
    }

    if (!currentOfferSummary) {
      continue;
    }

    const { bestOffer } = currentOfferSummary;

    if (!bestOffer) {
      continue;
    }

    if (
      !isCommerceCommercialUnitComparableForDeals(bestOffer.commercialUnitType)
    ) {
      excludedUnknownUnitCount += 1;
    }

    if (hasCatalogComparableUnitMismatch(currentOfferSummary)) {
      excludedUnitMismatchCount += 1;
    }

    if (
      !isCommerceMerchantProductionFeed(
        getCatalogOfferMerchantReliabilityKey(bestOffer),
      )
    ) {
      excludedUntrustedMerchantCount += 1;
    }

    if (!hasReliableCatalogReferenceDiscount(catalogDiscoverySignal)) {
      excludedUnknownVerdictCount += 1;
      excludedMissingReferenceDiscountCount += 1;
    }

    if (
      isCatalogPrimaryDealCandidate({
        catalogDiscoverySignal,
        currentOfferSummary,
      })
    ) {
      strongDealCandidates += 1;
    }

    if (
      canCatalogSetDriveSoftPriceOpportunity({
        catalogDiscoverySignal,
        currentOfferSummary,
        setCard,
      })
    ) {
      softDealCandidates += 1;
    }
  }

  const resolvedStrongSetCards = strongSetCards ?? selectedSetCards;

  return {
    excluded_missing_reference_discount_count:
      excludedMissingReferenceDiscountCount,
    excluded_unit_mismatch_count: excludedUnitMismatchCount,
    excluded_untrusted_merchant_count: excludedUntrustedMerchantCount,
    excluded_unknown_unit_count: excludedUnknownUnitCount,
    excluded_unknown_verdict_count: excludedUnknownVerdictCount,
    soft_deal_accepted: softSetCards.length,
    soft_deal_candidates: softDealCandidates,
    strong_deal_accepted: resolvedStrongSetCards.length,
    strong_deal_candidates: strongDealCandidates,
  };
}

const DISCOVER_RECENT_RELEASE_LOOKBACK_DAYS = 90;
const DISCOVER_RECENT_RELEASE_LOOKAHEAD_DAYS = 30;

function getCatalogReleaseTimestamp({
  setCard,
}: {
  setCard: Pick<
    CatalogHomepageSetCard,
    'releaseDate' | 'releaseDatePrecision' | 'releaseYear'
  >;
}): number | undefined {
  const resolvedPrecision = resolveCatalogReleaseDatePrecision({
    releaseDate: setCard.releaseDate,
    releaseDatePrecision: setCard.releaseDatePrecision,
    releaseYear: setCard.releaseYear,
  });
  const parsedReleaseDate = setCard.releaseDate
    ? Date.parse(`${setCard.releaseDate}T00:00:00Z`)
    : Number.NaN;

  if (
    (resolvedPrecision === 'day' || resolvedPrecision === 'month') &&
    Number.isFinite(parsedReleaseDate)
  ) {
    return parsedReleaseDate;
  }

  return undefined;
}

function getCatalogBrickhuntFirstSeenScore(
  setCard: Pick<CatalogHomepageSetCard, 'createdAt' | 'releaseYear'>,
): number {
  const parsedCreatedAt = setCard.createdAt
    ? Date.parse(setCard.createdAt)
    : Number.NaN;

  if (Number.isFinite(parsedCreatedAt)) {
    return parsedCreatedAt;
  }

  return setCard.releaseYear * 1_000_000_000;
}

const catalogLowSignalRecentReleaseThemes = new Set(['Duplo']);

function isCatalogHighSignalRecentReleaseCandidate({
  catalogDiscoverySignal,
  setCard,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  setCard: CatalogHomepageSetCard;
}): boolean {
  if (catalogLowSignalRecentReleaseThemes.has(setCard.theme)) {
    return false;
  }

  if (
    typeof catalogDiscoverySignal?.bestPriceMinor === 'number' &&
    catalogDiscoverySignal.bestPriceMinor < 1000
  ) {
    return false;
  }

  return setCard.pieces >= 100;
}

function isCatalogStrictRecentReleaseCandidate({
  now = new Date(),
  setCard,
}: {
  now?: Date;
  setCard: Pick<
    CatalogHomepageSetCard,
    'releaseDate' | 'releaseDatePrecision' | 'releaseYear'
  >;
}): boolean {
  const releaseTimestamp = getCatalogReleaseTimestamp({ setCard });

  if (typeof releaseTimestamp !== 'number') {
    return false;
  }

  const lowerBound =
    now.getTime() - DISCOVER_RECENT_RELEASE_LOOKBACK_DAYS * 86_400_000;
  const upperBound =
    now.getTime() + DISCOVER_RECENT_RELEASE_LOOKAHEAD_DAYS * 86_400_000;

  return releaseTimestamp >= lowerBound && releaseTimestamp <= upperBound;
}

function isCatalogReleaseYearFallbackCandidate({
  currentYear,
  setCard,
}: {
  currentYear: number;
  setCard: Pick<
    CatalogHomepageSetCard,
    'releaseDate' | 'releaseDatePrecision' | 'releaseYear'
  >;
}): boolean {
  const resolvedPrecision = resolveCatalogReleaseDatePrecision({
    releaseDate: setCard.releaseDate,
    releaseDatePrecision: setCard.releaseDatePrecision,
    releaseYear: setCard.releaseYear,
  });

  return resolvedPrecision === 'year' && setCard.releaseYear === currentYear;
}

function isCatalogNewOnBrickhuntCandidate({
  catalogDiscoverySignal,
  currentYear = new Date().getUTCFullYear(),
  now = new Date(),
  setCard,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentYear?: number;
  now?: Date;
  setCard: CatalogHomepageSetCard;
}): boolean {
  if (
    !isCatalogHighSignalRecentReleaseCandidate({
      catalogDiscoverySignal,
      setCard,
    })
  ) {
    return false;
  }

  if (!setCard.createdAt) {
    return false;
  }

  const createdAt = Date.parse(setCard.createdAt);

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  const ageDays = Math.floor((now.getTime() - createdAt) / 86_400_000);

  if (ageDays > 120) {
    return false;
  }

  const resolvedReleaseYear =
    getCatalogReleaseYear({
      releaseDate: setCard.releaseDate,
      releaseYear: setCard.releaseYear,
    }) ?? 0;

  return resolvedReleaseYear >= currentYear - 3 || ageDays <= 45;
}

const catalogSimilarSetTitleAliases = [
  {
    pattern: /\blotr\b/g,
    replacement: 'the lord of the rings',
  },
  {
    pattern: /\bhp\b/g,
    replacement: 'harry potter',
  },
] as const;

const catalogSimilarSetKnownFamilyMarkers = [
  ['the lord of the rings', 'the lord of the rings'],
  ['harry potter', 'harry potter'],
  ['star wars', 'star wars'],
  ['mario kart', 'mario kart'],
  ['animal crossing', 'animal crossing'],
  ['jurassic world', 'jurassic world'],
  ['the botanical collection', 'the botanical collection'],
  ['botanical collection', 'the botanical collection'],
  ['modular buildings', 'modular buildings'],
] as const;

const catalogSimilarSetAffinityStopWords = new Set([
  'a',
  'an',
  'and',
  'at',
  'de',
  'den',
  'der',
  'dit',
  'een',
  'for',
  'het',
  'in',
  'met',
  'of',
  'op',
  'set',
  'the',
  'to',
  'van',
  'voor',
  'with',
]);

interface CatalogSimilarSetAffinityDescriptor {
  familyMarker?: string;
  tokens: readonly string[];
}

function normalizeCatalogSimilarSetTitle(value: string): string {
  let normalizedValue = normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ');

  for (const { pattern, replacement } of catalogSimilarSetTitleAliases) {
    normalizedValue = normalizedValue.replace(pattern, replacement);
  }

  return normalizedValue
    .replace(/[^a-z0-9:]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getCatalogSimilarSetFamilyMarker(
  normalizedTitle: string,
): string | undefined {
  const knownFamilyMarker = catalogSimilarSetKnownFamilyMarkers.find(
    ([marker]) => normalizedTitle.includes(marker),
  );

  if (knownFamilyMarker) {
    return knownFamilyMarker[1];
  }

  const [prefixSegment] = normalizedTitle.split(':');

  if (!prefixSegment) {
    return undefined;
  }

  const normalizedPrefixSegment = prefixSegment.trim();

  if (!normalizedPrefixSegment) {
    return undefined;
  }

  const informativeTokenCount = normalizedPrefixSegment
    .split(' ')
    .filter(
      (token) =>
        token.length >= 3 && !catalogSimilarSetAffinityStopWords.has(token),
    ).length;

  return informativeTokenCount >= 2 ? normalizedPrefixSegment : undefined;
}

function getCatalogSimilarSetAffinityDescriptor(
  setName: string,
): CatalogSimilarSetAffinityDescriptor {
  const normalizedTitle = normalizeCatalogSimilarSetTitle(setName);

  return {
    familyMarker: getCatalogSimilarSetFamilyMarker(normalizedTitle),
    tokens: [
      ...new Set(
        normalizedTitle
          .split(/[: ]/)
          .filter(
            (token) =>
              token.length >= 3 &&
              !catalogSimilarSetAffinityStopWords.has(token),
          ),
      ),
    ],
  };
}

function getCatalogSimilarSetAffinityScore({
  candidateName,
  currentSetAffinityDescriptor,
}: {
  candidateName: string;
  currentSetAffinityDescriptor: CatalogSimilarSetAffinityDescriptor;
}): number {
  const candidateSetAffinityDescriptor =
    getCatalogSimilarSetAffinityDescriptor(candidateName);

  if (
    currentSetAffinityDescriptor.familyMarker &&
    currentSetAffinityDescriptor.familyMarker ===
      candidateSetAffinityDescriptor.familyMarker
  ) {
    return 24;
  }

  const candidateTokenSet = new Set(candidateSetAffinityDescriptor.tokens);
  const sharedTokens = currentSetAffinityDescriptor.tokens.filter((token) =>
    candidateTokenSet.has(token),
  );

  if (sharedTokens.length >= 2) {
    return 16;
  }

  const [sharedToken] = sharedTokens;

  return sharedToken && sharedToken.length >= 7 ? 8 : 0;
}

function getCatalogSimilarSetSecondaryThemeScore({
  candidateSecondaryLabels,
  currentSecondaryLabels,
}: {
  candidateSecondaryLabels?: readonly string[];
  currentSecondaryLabels?: readonly string[];
}): number {
  if (!currentSecondaryLabels?.length || !candidateSecondaryLabels?.length) {
    return 0;
  }

  const normalizedCurrentSecondaryLabels = new Set(
    currentSecondaryLabels.map(normalizeCatalogSimilarSetTitle),
  );

  return candidateSecondaryLabels.some((candidateSecondaryLabel) =>
    normalizedCurrentSecondaryLabels.has(
      normalizeCatalogSimilarSetTitle(candidateSecondaryLabel),
    ),
  )
    ? 36
    : 0;
}

function sortCatalogDiscoverySetCards({
  getCatalogDiscoverySignalFn,
  rotationSeed,
  scoreCatalogDiscoverySignal,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  rotationSeed?: number;
  scoreCatalogDiscoverySignal: (
    catalogDiscoverySignal: CatalogDiscoverySignal,
  ) => number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return [...setCards]
    .flatMap((setCard) => {
      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setCard.id);

      if (!catalogDiscoverySignal) {
        return [];
      }

      return [
        {
          catalogDiscoverySignal,
          score: scoreCatalogDiscoverySignal(catalogDiscoverySignal),
          setCard,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.catalogDiscoverySignal.merchantCount -
          left.catalogDiscoverySignal.merchantCount ||
        right.catalogDiscoverySignal.priceSpreadMinor -
          left.catalogDiscoverySignal.priceSpreadMinor ||
        (typeof rotationSeed === 'number'
          ? getCatalogRailRotationScore({
              rotationSeed,
              setId: right.setCard.id,
            }) -
            getCatalogRailRotationScore({
              rotationSeed,
              setId: left.setCard.id,
            })
          : 0) ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogComparisonDiscoverySetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  setCards,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return sortCatalogDiscoverySetCards({
    getCatalogDiscoverySignalFn: (setId) => {
      if (excludedSetIdSet.has(setId)) {
        return undefined;
      }

      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setId);

      if (!catalogDiscoverySignal || catalogDiscoverySignal.merchantCount < 2) {
        return undefined;
      }

      return catalogDiscoverySignal;
    },
    scoreCatalogDiscoverySignal: getCatalogComparisonDiscoveryScore,
    setCards,
  }).slice(0, limit);
}

export function rankCatalogPremiumDiscoverySetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  rotationSeed,
  setCards,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  rotationSeed?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  const candidates = setCards
    .flatMap((setCard) => {
      if (excludedSetIdSet.has(setCard.id)) {
        return [];
      }

      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setCard.id);
      const score = getCatalogFollowDiscoveryScore({
        catalogDiscoverySignal,
        rotationSeed,
        setCard,
      });

      if (score < 42) {
        return [];
      }

      return [
        {
          catalogDiscoverySignal:
            catalogDiscoverySignal ??
            ({
              bestPriceMinor: 0,
              merchantCount: 0,
              observedAt: new Date().toISOString(),
              priceSpreadMinor: 0,
            } satisfies CatalogDiscoverySignal),
          score,
          setCard,
          sizeBucket: getCatalogFollowDiscoverySizeBucket(setCard.pieces),
          themeBucket: buildCatalogThemeSlug(setCard.theme),
          timingBucket: getCatalogFollowDiscoveryTimingBucket(setCard),
          typeBucket: getCatalogFollowDiscoveryTypeBucket(setCard.name),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.catalogDiscoverySignal.merchantCount -
          left.catalogDiscoverySignal.merchantCount ||
        getCatalogRailRotationScore({
          rotationSeed,
          setId: right.setCard.id,
        }) -
          getCatalogRailRotationScore({
            rotationSeed,
            setId: left.setCard.id,
          }) ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    );
  const selectedCandidates: typeof candidates = [];
  const selectedThemeCounts = new Map<string, number>();
  const selectedSizeCounts = new Map<string, number>();
  const selectedTimingCounts = new Map<string, number>();
  const selectedTypeCounts = new Map<string, number>();
  const candidatePool = [...candidates];

  while (selectedCandidates.length < limit && candidatePool.length) {
    let bestCandidateIndex = 0;
    let bestCandidateScore = Number.NEGATIVE_INFINITY;

    candidatePool.forEach((candidate, candidateIndex) => {
      const themeCount = selectedThemeCounts.get(candidate.themeBucket) ?? 0;
      const sizeCount = selectedSizeCounts.get(candidate.sizeBucket) ?? 0;
      const timingCount = selectedTimingCounts.get(candidate.timingBucket) ?? 0;
      const typeCount = selectedTypeCounts.get(candidate.typeBucket) ?? 0;
      const adjustedScore =
        candidate.score -
        getCatalogFollowDiscoveryExposurePenalty({
          rotationSeed,
          setId: candidate.setCard.id,
        }) -
        themeCount * 54 -
        Math.max(0, sizeCount - 1) * 18 -
        Math.max(0, timingCount - 2) * 12 -
        typeCount * 10;

      if (
        adjustedScore > bestCandidateScore ||
        (adjustedScore === bestCandidateScore &&
          candidate.setCard.name.localeCompare(
            candidatePool[bestCandidateIndex]?.setCard.name ?? '',
          ) < 0)
      ) {
        bestCandidateIndex = candidateIndex;
        bestCandidateScore = adjustedScore;
      }
    });

    const [selectedCandidate] = candidatePool.splice(bestCandidateIndex, 1);

    if (!selectedCandidate) {
      break;
    }

    selectedCandidates.push(selectedCandidate);
    selectedThemeCounts.set(
      selectedCandidate.themeBucket,
      (selectedThemeCounts.get(selectedCandidate.themeBucket) ?? 0) + 1,
    );
    selectedSizeCounts.set(
      selectedCandidate.sizeBucket,
      (selectedSizeCounts.get(selectedCandidate.sizeBucket) ?? 0) + 1,
    );
    selectedTimingCounts.set(
      selectedCandidate.timingBucket,
      (selectedTimingCounts.get(selectedCandidate.timingBucket) ?? 0) + 1,
    );
    selectedTypeCounts.set(
      selectedCandidate.typeBucket,
      (selectedTypeCounts.get(selectedCandidate.typeBucket) ?? 0) + 1,
    );
  }

  return selectedCandidates.map(
    (catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard,
  );
}

export function rankCatalogRecentPriceChangeSetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  rotationSeed,
  setCards,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  rotationSeed?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return sortCatalogRailCandidatesWithRotation({
    candidates: [...setCards].flatMap((setCard) => {
      if (excludedSetIdSet.has(setCard.id)) {
        return [];
      }

      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setCard.id);

      if (
        !catalogDiscoverySignal ||
        catalogDiscoverySignal.merchantCount < 2 ||
        typeof catalogDiscoverySignal.recentReferencePriceChangeMinor !==
          'number' ||
        catalogDiscoverySignal.recentReferencePriceChangeMinor >= 0 ||
        typeof catalogDiscoverySignal.recentReferencePriceChangedAt !==
          'string' ||
        getCatalogSignalAgeHours(
          catalogDiscoverySignal.recentReferencePriceChangedAt,
        ) > 48
      ) {
        return [];
      }

      return [
        {
          catalogDiscoverySignal,
          score: getCatalogRecentPriceChangeScore(catalogDiscoverySignal),
          setCard,
        },
      ];
    }),
    rotationSeed,
  })
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogBestDealSetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  rotationSeed,
  setCards,
}: {
  currentOfferSummaryBySetId?: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  rotationSeed?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return sortCatalogRailCandidatesWithRotation({
    candidates: [...setCards].flatMap((setCard) => {
      if (excludedSetIdSet.has(setCard.id)) {
        return [];
      }

      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setCard.id);
      const currentOfferSummary = currentOfferSummaryBySetId?.get(setCard.id);

      if (
        !catalogDiscoverySignal ||
        catalogDiscoverySignal.merchantCount <
          HOMEPAGE_PRIMARY_DEAL_MIN_MERCHANT_COUNT ||
        !isCatalogBestDealCandidate(catalogDiscoverySignal) ||
        (currentOfferSummaryBySetId &&
          !isCatalogPrimaryDealCandidate({
            catalogDiscoverySignal,
            currentOfferSummary,
          }))
      ) {
        return [];
      }

      return [
        {
          catalogDiscoverySignal,
          score: getCatalogBestDealDiscoveryScore(catalogDiscoverySignal),
          setCard,
        },
      ];
    }),
    rotationSeed,
  })
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogNowInterestingSetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  rotationSeed,
  setCards,
}: {
  currentOfferSummaryBySetId?: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  rotationSeed?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return sortCatalogRailCandidatesWithRotation({
    candidates: [...setCards].flatMap((setCard) => {
      if (excludedSetIdSet.has(setCard.id)) {
        return [];
      }

      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setCard.id);
      const currentOfferSummary = currentOfferSummaryBySetId?.get(setCard.id);

      if (
        !catalogDiscoverySignal ||
        !isCatalogInterestingNowCandidate(catalogDiscoverySignal) ||
        (currentOfferSummaryBySetId &&
          !canCatalogSetDriveSoftPriceOpportunity({
            catalogDiscoverySignal,
            currentOfferSummary,
            setCard,
          }))
      ) {
        return [];
      }

      return [
        {
          catalogDiscoverySignal,
          score: getCatalogNowInterestingScore(catalogDiscoverySignal),
          setCard,
        },
      ];
    }),
    rotationSeed,
  })
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogRecentlyReleasedSetCards({
  getCatalogDiscoverySignalFn,
  limit = 6,
  now = new Date(),
  setCards,
}: {
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  now?: Date;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return [...setCards]
    .flatMap((setCard) => {
      const catalogDiscoverySignal = getCatalogDiscoverySignalFn?.(setCard.id);

      if (
        !isCatalogHighSignalRecentReleaseCandidate({
          catalogDiscoverySignal,
          setCard,
        }) ||
        !isCatalogStrictRecentReleaseCandidate({
          now,
          setCard,
        })
      ) {
        return [];
      }

      return [
        {
          comparisonReadinessScore:
            getCatalogSimilarSetComparisonReadinessScore(
              catalogDiscoverySignal,
            ),
          merchantCount: catalogDiscoverySignal?.merchantCount ?? 0,
          releaseTimestamp:
            getCatalogReleaseTimestamp({
              setCard,
            }) ?? Number.NEGATIVE_INFINITY,
          setCard,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.releaseTimestamp - left.releaseTimestamp ||
        right.comparisonReadinessScore - left.comparisonReadinessScore ||
        right.merchantCount - left.merchantCount ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogNewInReleaseYearSetCards({
  currentYear = new Date().getUTCFullYear(),
  getCatalogDiscoverySignalFn,
  limit = 6,
  setCards,
}: {
  currentYear?: number;
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return [...setCards]
    .flatMap((setCard) => {
      const catalogDiscoverySignal = getCatalogDiscoverySignalFn?.(setCard.id);

      if (
        !isCatalogHighSignalRecentReleaseCandidate({
          catalogDiscoverySignal,
          setCard,
        }) ||
        !isCatalogReleaseYearFallbackCandidate({
          currentYear,
          setCard,
        })
      ) {
        return [];
      }

      return [
        {
          comparisonReadinessScore:
            getCatalogSimilarSetComparisonReadinessScore(
              catalogDiscoverySignal,
            ),
          merchantCount: catalogDiscoverySignal?.merchantCount ?? 0,
          setCard,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.comparisonReadinessScore - left.comparisonReadinessScore ||
        right.merchantCount - left.merchantCount ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogNewOnBrickhuntSetCards({
  currentYear = new Date().getUTCFullYear(),
  getCatalogDiscoverySignalFn,
  limit = 6,
  now = new Date(),
  setCards,
}: {
  currentYear?: number;
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  now?: Date;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return [...setCards]
    .flatMap((setCard) => {
      const catalogDiscoverySignal = getCatalogDiscoverySignalFn?.(setCard.id);

      if (
        !isCatalogNewOnBrickhuntCandidate({
          catalogDiscoverySignal,
          currentYear,
          now,
          setCard,
        })
      ) {
        return [];
      }

      return [
        {
          brickhuntFirstSeenScore: getCatalogBrickhuntFirstSeenScore(setCard),
          comparisonReadinessScore:
            getCatalogSimilarSetComparisonReadinessScore(
              catalogDiscoverySignal,
            ),
          merchantCount: catalogDiscoverySignal?.merchantCount ?? 0,
          setCard,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.brickhuntFirstSeenScore - left.brickhuntFirstSeenScore ||
        right.comparisonReadinessScore - left.comparisonReadinessScore ||
        right.merchantCount - left.merchantCount ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

function buildDiscoverThemePopularityByTheme(
  setCards: readonly CatalogHomepageSetCard[],
): Map<string, number> {
  const themeCounts = new Map<string, number>();

  for (const setCard of setCards) {
    if (!isCatalogBrowsablePrimaryTheme(setCard.theme)) {
      continue;
    }

    themeCounts.set(setCard.theme, (themeCounts.get(setCard.theme) ?? 0) + 1);
  }

  return themeCounts;
}

function getCatalogForYouInterestingScore({
  catalogDiscoverySignal,
  themePopularity,
}: {
  catalogDiscoverySignal: CatalogDiscoverySignal;
  themePopularity: number;
}): number {
  const dealScore = getCatalogComparisonDiscoveryScore(catalogDiscoverySignal);
  const priceChangeScore = getCatalogRecentPriceChangeScore(
    catalogDiscoverySignal,
  );
  const themePopularityScore = Math.min(themePopularity, 12) * 4;

  return dealScore * 0.55 + priceChangeScore * 0.45 + themePopularityScore;
}

export function rankCatalogForYouInterestingSetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  setCards,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);
  const themePopularityByTheme = buildDiscoverThemePopularityByTheme(setCards);

  return [...setCards]
    .flatMap((setCard) => {
      if (excludedSetIdSet.has(setCard.id)) {
        return [];
      }

      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setCard.id);

      if (!catalogDiscoverySignal || catalogDiscoverySignal.merchantCount < 2) {
        return [];
      }

      return [
        {
          score: getCatalogForYouInterestingScore({
            catalogDiscoverySignal,
            themePopularity: themePopularityByTheme.get(setCard.theme) ?? 0,
          }),
          setCard,
          themePopularity: themePopularityByTheme.get(setCard.theme) ?? 0,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.themePopularity - left.themePopularity ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export interface CatalogThemeOfWeekRail {
  setCards: readonly CatalogHomepageSetCard[];
  theme: string;
}

export function selectCatalogThemeOfWeekRail({
  getCatalogDiscoverySignalFn,
  maxSetCount = 6,
  minSetCount = 4,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  maxSetCount?: number;
  minSetCount?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogThemeOfWeekRail | undefined {
  const setCardsByTheme = new Map<string, CatalogHomepageSetCard[]>();

  for (const setCard of setCards) {
    if (!isCatalogBrowsablePrimaryTheme(setCard.theme)) {
      continue;
    }

    const themeSetCards = setCardsByTheme.get(setCard.theme) ?? [];
    themeSetCards.push(setCard);
    setCardsByTheme.set(setCard.theme, themeSetCards);
  }

  const rankedThemes = [...setCardsByTheme.entries()]
    .flatMap(([theme, themeSetCards]) => {
      const rankedSetCards = [...themeSetCards]
        .flatMap((setCard) => {
          const catalogDiscoverySignal = getCatalogDiscoverySignalFn(
            setCard.id,
          );
          const activityScore = catalogDiscoverySignal
            ? getCatalogNowInterestingScore(catalogDiscoverySignal)
            : 0;

          if (activityScore <= 0) {
            return [];
          }

          return [
            {
              activityScore,
              setCard,
            },
          ];
        })
        .sort(
          (left, right) =>
            right.activityScore - left.activityScore ||
            right.setCard.releaseYear - left.setCard.releaseYear ||
            right.setCard.pieces - left.setCard.pieces ||
            left.setCard.name.localeCompare(right.setCard.name),
        );
      const selectedSetCards = (
        rankedSetCards.length
          ? rankedSetCards.map((themeCandidate) => themeCandidate.setCard)
          : sortDiscoverThemeSetCards({
              setCards: themeSetCards,
            })
      ).slice(0, maxSetCount);

      if (selectedSetCards.length < minSetCount) {
        return [];
      }

      const topActivityScore = rankedSetCards
        .slice(0, 4)
        .reduce(
          (totalScore, themeCandidate) =>
            totalScore + themeCandidate.activityScore,
          0,
        );

      return [
        {
          score: topActivityScore,
          setCards: selectedSetCards,
          theme,
          totalSetCount: themeSetCards.length,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.totalSetCount - left.totalSetCount ||
        left.theme.localeCompare(right.theme),
    );

  const [themeOfWeek] = rankedThemes;

  if (themeOfWeek) {
    return {
      setCards: themeOfWeek.setCards,
      theme: themeOfWeek.theme,
    };
  }

  const [fallbackTheme] = [...setCardsByTheme.entries()]
    .filter(([, themeSetCards]) => themeSetCards.length >= minSetCount)
    .sort(
      (left, right) =>
        right[1].length - left[1].length || left[0].localeCompare(right[0]),
    );

  if (!fallbackTheme) {
    return undefined;
  }

  return {
    setCards: sortDiscoverThemeSetCards({
      setCards: fallbackTheme[1],
    }).slice(0, maxSetCount),
    theme: fallbackTheme[0],
  };
}

export function rankCatalogSimilarSetCards({
  currentSetCard,
  getCatalogDiscoverySignalFn,
  limit = 20,
  referenceBestPriceMinor,
  setCards,
}: {
  currentSetCard: Pick<
    CatalogHomepageSetCard,
    'id' | 'name' | 'pieces' | 'releaseYear' | 'secondaryLabels' | 'theme'
  >;
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  referenceBestPriceMinor?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const currentSetAffinityDescriptor = getCatalogSimilarSetAffinityDescriptor(
    currentSetCard.name,
  );
  const seenSetIds = new Set<string>([currentSetCard.id]);

  return [...setCards]
    .flatMap((setCard) => {
      if (
        seenSetIds.has(setCard.id) ||
        buildCatalogThemeSlug(setCard.theme) !==
          buildCatalogThemeSlug(currentSetCard.theme)
      ) {
        return [];
      }

      seenSetIds.add(setCard.id);

      const catalogDiscoverySignal = getCatalogDiscoverySignalFn?.(setCard.id);
      const priceProximityScore = getCatalogSimilarSetPriceProximityScore({
        candidateBestPriceMinor: catalogDiscoverySignal?.bestPriceMinor,
        referenceBestPriceMinor,
      });
      const pieceProximityScore = getCatalogSimilarSetPieceProximityScore({
        candidatePieces: setCard.pieces,
        currentPieces: currentSetCard.pieces,
      });
      const releaseYearScore = getCatalogSimilarSetReleaseYearScore({
        candidateReleaseYear: setCard.releaseYear,
        currentReleaseYear: currentSetCard.releaseYear,
      });
      const titleAffinityScore = getCatalogSimilarSetAffinityScore({
        candidateName: setCard.name,
        currentSetAffinityDescriptor,
      });
      const secondaryThemeScore = getCatalogSimilarSetSecondaryThemeScore({
        candidateSecondaryLabels: setCard.secondaryLabels,
        currentSecondaryLabels: currentSetCard.secondaryLabels,
      });
      const comparisonReadinessScore =
        getCatalogSimilarSetComparisonReadinessScore(catalogDiscoverySignal);
      const pieceGap = Math.abs(setCard.pieces - currentSetCard.pieces);
      const totalScore =
        priceProximityScore +
        pieceProximityScore +
        releaseYearScore +
        titleAffinityScore +
        secondaryThemeScore +
        comparisonReadinessScore;

      return [
        {
          comparisonReadinessScore,
          pieceGap,
          pieceProximityScore,
          priceProximityScore,
          releaseYearGap: Math.abs(
            setCard.releaseYear - currentSetCard.releaseYear,
          ),
          score: totalScore,
          secondaryThemeScore,
          setCard,
          titleAffinityScore,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.secondaryThemeScore - left.secondaryThemeScore ||
        right.priceProximityScore - left.priceProximityScore ||
        right.pieceProximityScore - left.pieceProximityScore ||
        right.titleAffinityScore - left.titleAffinityScore ||
        right.comparisonReadinessScore - left.comparisonReadinessScore ||
        left.pieceGap - right.pieceGap ||
        left.releaseYearGap - right.releaseYearGap ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .slice(0, limit)
    .map((catalogSimilarCandidate) => catalogSimilarCandidate.setCard);
}

function getExplicitBrowseRank(
  canonicalId: string,
  rankedIds: readonly string[],
): number {
  const rank = rankedIds.indexOf(canonicalId);

  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function getReviewedCoverageRank(
  canonicalId: string,
  reviewedSetIds?: readonly string[],
): number {
  if (!reviewedSetIds?.length) {
    return Number.MAX_SAFE_INTEGER;
  }

  return reviewedSetIds.includes(canonicalId) ? 0 : 1;
}

function getMinifigureHighlightRank(
  minifigureHighlights?: readonly string[],
): number {
  return minifigureHighlights?.length ? 0 : 1;
}

function sortDiscoverShowcaseSetCards({
  reviewedSetIds,
  setCards,
}: {
  reviewedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return [...setCards].sort(
    (left, right) =>
      getReviewedCoverageRank(left.id, reviewedSetIds) -
        getReviewedCoverageRank(right.id, reviewedSetIds) ||
      getMinifigureHighlightRank(left.minifigureHighlights) -
        getMinifigureHighlightRank(right.minifigureHighlights) ||
      getExplicitBrowseRank(left.id, catalogDiscoverSetOrder) -
        getExplicitBrowseRank(right.id, catalogDiscoverSetOrder) ||
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
}

function sortDiscoverThemeSetCards({
  reviewedSetIds,
  setCards,
}: {
  reviewedSetIds?: readonly string[];
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return sortDiscoverShowcaseSetCards({
    reviewedSetIds,
    setCards,
  });
}

function getCatalogThemeBrowseOrder(theme: string): number {
  void theme;
  return Number.MAX_SAFE_INTEGER;
}

function getCatalogThemeRepresentativeImageUrl({
  setCards,
  themeSnapshot,
}: {
  setCards: readonly CatalogHomepageSetCard[];
  themeSnapshot: CatalogThemeSnapshot;
}): string | undefined {
  const signatureSetCard = setCards.find(
    (catalogSetCard) => catalogSetCard.name === themeSnapshot.signatureSet,
  );

  if (signatureSetCard?.imageUrl) {
    return signatureSetCard.imageUrl;
  }

  return setCards.find((catalogSetCard) => catalogSetCard.imageUrl)?.imageUrl;
}

function createThemeSnapshot({
  setCards,
  theme,
}: {
  setCards: readonly CatalogHomepageSetCard[];
  theme: string;
}): CatalogThemeSnapshot {
  const displayThemeName = getCatalogThemeDisplayName(theme) ?? theme;
  const themeSlug = buildCatalogThemeSlug(displayThemeName);

  return {
    name: displayThemeName,
    slug: themeSlug,
    setCount: setCards.length,
    momentum: genericCatalogThemeMomentum,
    signatureSet: setCards[0]?.name ?? displayThemeName,
  };
}

function createPublicCatalogThemeSnapshot({
  setCards,
  setCount,
  slug,
  theme,
}: {
  setCards: readonly CatalogHomepageSetCard[];
  setCount: number;
  slug: string;
  theme: string;
}): CatalogThemeSnapshot {
  const displayThemeName = normalizeCatalogThemePublicText(theme) ?? theme;

  return {
    name: displayThemeName,
    momentum: genericCatalogThemeMomentum,
    setCount,
    signatureSet:
      setCards[0]?.name && setCards[0].name !== displayThemeName
        ? setCards[0].name
        : displayThemeName,
    slug,
  };
}

function dedupeCatalogThemeDirectoryItemsBySlug(
  directoryItems: readonly CatalogThemeDirectoryItem[],
): CatalogThemeDirectoryItem[] {
  const seenThemeSlugs = new Set<string>();
  const seenThemeNames = new Set<string>();

  return directoryItems.filter((directoryItem) => {
    const { slug } = directoryItem.themeSnapshot;
    const normalizedName = normalizeCatalogAsciiText(
      directoryItem.themeSnapshot.name,
    );

    if (seenThemeSlugs.has(slug) || seenThemeNames.has(normalizedName)) {
      return false;
    }

    seenThemeSlugs.add(slug);
    seenThemeNames.add(normalizedName);

    return true;
  });
}

function normalizeCatalogThemePublicText(
  value?: string | null,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeCatalogThemePublicImageUrl(
  value?: string | null,
): string | undefined {
  const normalizedValue = value?.trim();

  if (!normalizedValue || !/^https?:\/\/[^\s"'<>]+$/iu.test(normalizedValue)) {
    return undefined;
  }

  return normalizedValue;
}

function normalizeCatalogThemePublicLogoUrl(
  value?: string | null,
): string | undefined {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return undefined;
  }

  if (/^https?:\/\/[^\s"'<>]+$/iu.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^\/[a-z0-9/_+.-]+$/iu.test(normalizedValue)) {
    return normalizedValue;
  }

  return undefined;
}

function normalizeCatalogThemePublicAccentColor(
  value?: string | null,
): string | undefined {
  const normalizedValue = value?.trim();

  if (
    !normalizedValue ||
    !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(normalizedValue)
  ) {
    return undefined;
  }

  return normalizedValue;
}

function normalizeCatalogThemePublicTextColor(
  value?: string | null,
): string | undefined {
  return normalizeCatalogThemePublicAccentColor(value);
}

function createPublicCatalogThemeVisual({
  imageUrl,
  publicAccentColor,
  publicHeroTextColor,
  publicSurfaceColor,
  publicSurfaceTextColor,
}: {
  imageUrl?: string;
  publicAccentColor?: string;
  publicHeroTextColor?: string;
  publicSurfaceColor?: string;
  publicSurfaceTextColor?: string;
}): CatalogThemeVisual | undefined {
  const backgroundColor = publicSurfaceColor ?? publicAccentColor;
  const textColor = publicSurfaceTextColor ?? publicHeroTextColor;
  const visual = {
    ...(backgroundColor
      ? {
          backgroundColor,
        }
      : {}),
    ...(textColor
      ? {
          textColor,
        }
      : {}),
    ...(imageUrl
      ? {
          imageUrl,
        }
      : {}),
  };

  return Object.keys(visual).length > 0 ? visual : undefined;
}

async function listCatalogThemeSummariesByThemeId({
  supabaseClient,
  themeIds,
}: {
  supabaseClient: CatalogSupabaseClient;
  themeIds: readonly string[];
}): Promise<Map<string, CatalogThemeSummaryRow>> {
  const uniqueThemeIds = [...new Set(themeIds.filter(Boolean))];

  if (uniqueThemeIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseClient
    .from(CATALOG_THEME_SUMMARIES_TABLE)
    .select(
      'theme_id, active_set_count, representative_set_id, representative_image_url, updated_at',
    )
    .in('theme_id', uniqueThemeIds);

  if (error) {
    throw new Error('Unable to load catalog theme summaries.');
  }

  return new Map(
    ((data as CatalogThemeSummaryRow[] | null) ?? []).map((summaryRow) => [
      summaryRow.theme_id,
      summaryRow,
    ]),
  );
}

async function listCatalogBrowseThemeGroupsInternal({
  allowFullCatalogRead = false,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  supabaseClient,
}: {
  allowFullCatalogRead?: boolean;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogBrowseThemeGroup[]> {
  const setCards = await listAllCatalogSetCards({
    allowFullCatalogRead,
    listCanonicalCatalogSetsFn,
    supabaseClient,
  });
  const setCardsByTheme = new Map<string, CatalogHomepageSetCard[]>();

  for (const setCard of setCards) {
    const theme =
      getCatalogThemeDisplayName(setCard.theme, {
        name: setCard.name,
        secondaryLabels: setCard.secondaryLabels,
        setId: setCard.id,
        slug: setCard.slug,
        theme: setCard.theme,
      }) ?? setCard.theme;
    const existingSetCards = setCardsByTheme.get(theme) ?? [];
    existingSetCards.push(setCard);
    setCardsByTheme.set(theme, existingSetCards);
  }

  return [...setCardsByTheme.entries()]
    .filter(([theme]) => isCatalogBrowsablePrimaryTheme(theme))
    .map(([theme, themeSetCards]) => ({
      slug: buildCatalogThemeSlug(theme),
      theme,
      setCards: sortDiscoverShowcaseSetCards({
        setCards: themeSetCards,
      }),
      totalSetCount: themeSetCards.length,
    }))
    .sort(
      (left, right) =>
        getCatalogThemeBrowseOrder(left.theme) -
          getCatalogThemeBrowseOrder(right.theme) ||
        left.theme.localeCompare(right.theme),
    );
}

async function listCatalogThemeDirectoryItemsFromSupabase({
  limit = CATALOG_PUBLIC_THEME_DIRECTORY_LIMIT,
  offset = 0,
  sortMode = 'directory',
  supabaseClient,
}: {
  limit?: number;
  offset?: number;
  sortMode?: 'directory' | 'homepage';
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  const safeLimit = normalizeCatalogReadLimit(
    limit,
    CATALOG_PUBLIC_THEME_DIRECTORY_LIMIT,
  );
  const safeOffset = normalizeCatalogReadOffset(offset);

  try {
    let themeQuery = activeSupabaseClient
      .from(CATALOG_THEMES_TABLE)
      .select(
        'id, slug, display_name, public_display_name, public_description, public_image_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_logo_url, status, is_public, public_homepage_order, public_order',
      )
      .eq('status', 'active')
      .eq('is_public', true);

    if (sortMode === 'homepage') {
      themeQuery = themeQuery.order('public_homepage_order', {
        ascending: true,
        nullsFirst: false,
      });
    }

    const { data: themeData, error: themeError } = await themeQuery
      .order('public_order', { ascending: true, nullsFirst: false })
      .order('display_name', { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (themeError) {
      throw new Error('Unable to load catalog theme directory.');
    }

    const themeRows = (themeData as CatalogThemeRow[] | null) ?? [];
    const themeSummariesByThemeId = await listCatalogThemeSummariesByThemeId({
      supabaseClient: activeSupabaseClient,
      themeIds: themeRows.map((themeRow) => themeRow.id),
    });

    const directoryItems = await Promise.all(
      themeRows.map(
        async (themeRow): Promise<CatalogThemeDirectoryItem | undefined> => {
          const publicDisplayName =
            normalizeCatalogThemePublicText(themeRow.public_display_name) ??
            themeRow.display_name;
          const themeSummary = themeSummariesByThemeId.get(themeRow.id);
          let catalogRows: CatalogSetRow[] = [];
          let setCount = themeSummary?.active_set_count;

          if (!themeSummary) {
            const { count, data, error } = await activeSupabaseClient
              .from(CATALOG_SETS_TABLE)
              .select(CATALOG_SET_SELECT_COLUMNS, { count: 'exact' })
              .eq('status', 'active')
              .eq('primary_theme_id', themeRow.id)
              .order('release_year', { ascending: false })
              .order('name', { ascending: true })
              .order('set_id', { ascending: true })
              .limit(CATALOG_THEME_REPRESENTATIVE_SET_LIMIT);

            if (error) {
              throw new Error('Unable to load catalog theme directory.');
            }

            catalogRows = (data as CatalogSetRow[] | null) ?? [];
            setCount = count ?? catalogRows.length;
          }

          const canonicalCatalogSets = catalogRows.map((row) =>
            toCanonicalCatalogSetFromRow({
              row,
              themeIdentity: resolveCatalogThemeIdentityFromPersistence({
                primaryThemeName: publicDisplayName,
                sourceThemeName: undefined,
              }),
            }),
          );
          const enrichedCatalogSets =
            await enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
              canonicalCatalogSets,
              supabaseClient: activeSupabaseClient,
            });
          const setCards = enrichedCatalogSets.map(
            toCatalogSetCardFromCanonicalSet,
          );
          const publicDescription = normalizeCatalogThemePublicText(
            themeRow.public_description,
          );
          const themeSnapshot = {
            ...createPublicCatalogThemeSnapshot({
              setCards,
              setCount: setCount ?? catalogRows.length,
              slug: themeRow.slug ?? buildCatalogThemeSlug(publicDisplayName),
              theme: publicDisplayName,
            }),
            ...(publicDescription
              ? {
                  momentum: publicDescription,
                }
              : {}),
          };

          if (themeSnapshot.setCount === 0) {
            return undefined;
          }

          const publicImageUrl = normalizeCatalogThemePublicImageUrl(
            themeRow.public_image_url,
          );
          const publicAccentColor = normalizeCatalogThemePublicAccentColor(
            themeRow.public_accent_color,
          );
          const publicSurfaceColor = normalizeCatalogThemePublicAccentColor(
            themeRow.public_surface_color,
          );
          const publicSurfaceTextColor = normalizeCatalogThemePublicTextColor(
            themeRow.public_surface_text_color,
          );
          const publicHeroTextColor = normalizeCatalogThemePublicTextColor(
            themeRow.public_hero_text_color,
          );
          const imageUrl =
            publicImageUrl ??
            normalizeCatalogThemePublicImageUrl(
              themeSummary?.representative_image_url,
            ) ??
            getCatalogThemeRepresentativeImageUrl({
              setCards,
              themeSnapshot,
            });
          const visual = createPublicCatalogThemeVisual({
            imageUrl,
            publicAccentColor,
            publicHeroTextColor,
            publicSurfaceColor,
            publicSurfaceTextColor,
          });

          return {
            imageUrl,
            themeSnapshot,
            visual,
          } satisfies CatalogThemeDirectoryItem;
        },
      ),
    );

    return dedupeCatalogThemeDirectoryItemsBySlug(
      directoryItems
        .flatMap((directoryItem) => (directoryItem ? [directoryItem] : []))
        .sort((left, right) => {
          const leftThemeRow = themeRows.find(
            (themeRow) =>
              themeRow.slug === left.themeSnapshot.slug ||
              buildCatalogThemeSlug(
                normalizeCatalogThemePublicText(themeRow.public_display_name) ??
                  themeRow.display_name,
              ) === left.themeSnapshot.slug,
          );
          const rightThemeRow = themeRows.find(
            (themeRow) =>
              themeRow.slug === right.themeSnapshot.slug ||
              buildCatalogThemeSlug(
                normalizeCatalogThemePublicText(themeRow.public_display_name) ??
                  themeRow.display_name,
              ) === right.themeSnapshot.slug,
          );
          const leftHomepageOrder =
            typeof leftThemeRow?.public_homepage_order === 'number'
              ? leftThemeRow.public_homepage_order
              : Number.MAX_SAFE_INTEGER;
          const rightHomepageOrder =
            typeof rightThemeRow?.public_homepage_order === 'number'
              ? rightThemeRow.public_homepage_order
              : Number.MAX_SAFE_INTEGER;
          const leftPublicOrder =
            typeof leftThemeRow?.public_order === 'number'
              ? leftThemeRow.public_order
              : Number.MAX_SAFE_INTEGER;
          const rightPublicOrder =
            typeof rightThemeRow?.public_order === 'number'
              ? rightThemeRow.public_order
              : Number.MAX_SAFE_INTEGER;

          return (
            (sortMode === 'homepage'
              ? leftHomepageOrder - rightHomepageOrder
              : 0) ||
            leftPublicOrder - rightPublicOrder ||
            left.themeSnapshot.name.localeCompare(
              right.themeSnapshot.name,
              'nl',
            ) ||
            left.themeSnapshot.slug.localeCompare(right.themeSnapshot.slug)
          );
        }),
    );
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function listCatalogSetCardsByIds({
  canonicalIds = [],
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  supabaseClient,
}: {
  canonicalIds?: readonly string[];
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogHomepageSetCard[]> {
  if (listCanonicalCatalogSetsFn === listCanonicalCatalogSets) {
    const activeSupabaseClient =
      supabaseClient ?? getWebCatalogSupabaseReadClient();
    const uniqueCanonicalIds = [...new Set(canonicalIds)].filter(Boolean);

    if (!activeSupabaseClient || uniqueCanonicalIds.length === 0) {
      return [];
    }

    try {
      const { data, error } = await activeSupabaseClient
        .from(CATALOG_SETS_TABLE)
        .select(CATALOG_SET_SELECT_COLUMNS)
        .eq('status', 'active')
        .in('set_id', uniqueCanonicalIds)
        .limit(uniqueCanonicalIds.length);

      if (error) {
        throw new Error('Unable to load catalog set cards.');
      }

      const catalogRows = (data as CatalogSetRow[] | null) ?? [];
      const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
        catalogRows,
        supabaseClient: activeSupabaseClient,
      });
      const canonicalCatalogSets = catalogRows.map((row) =>
        toCanonicalCatalogSetFromRow({
          row,
          themeIdentity: themeIdentityBySetId.get(row.set_id),
        }),
      );
      const enrichedCatalogSets =
        await enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
          canonicalCatalogSets,
          supabaseClient: activeSupabaseClient,
        });
      const setCards = enrichedCatalogSets.map(
        toCatalogSetCardFromCanonicalSet,
      );

      return selectCatalogSetCardsByIds({
        canonicalIds,
        setCards,
      });
    } catch (error) {
      if (!supabaseClient) {
        return [];
      }

      throw error;
    }
  }

  return selectCatalogSetCardsByIds({
    canonicalIds,
    setCards: await listAllCatalogSetCards({
      listCanonicalCatalogSetsFn,
    }),
  });
}

async function listCatalogRuntimeOffersBySetIdsFromSupabase({
  setIds,
  signal,
  supabaseClient,
}: {
  setIds: readonly string[];
  signal?: AbortSignal;
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, CatalogRuntimeOffer[]>> {
  const uniqueSetIds = [
    ...new Set(
      setIds
        .map((setId) => getCanonicalCatalogSetId(setId))
        .filter((setId) => setId.length > 0),
    ),
  ];
  const liveOffersBySetId = new Map(
    uniqueSetIds.map((setId) => [setId, [] as CatalogRuntimeOffer[]]),
  );

  if (!uniqueSetIds.length) {
    return liveOffersBySetId;
  }

  const setIdLookupVariants = getCatalogSetIdOfferLookupVariants(setIds);

  const offerSeeds: CatalogCommerceOfferSeedRow[] = [];

  for (const setIdLookupVariantChunk of chunkCatalogValues(
    setIdLookupVariants,
    CATALOG_CURRENT_OFFER_IN_FILTER_PAGE_SIZE,
  )) {
    throwIfCatalogReadAborted(signal);

    const { data: seedData, error: seedError } = await applyCatalogAbortSignal(
      supabaseClient
        .from(COMMERCE_OFFER_SEEDS_TABLE)
        .select(
          'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
        )
        .in('set_id', setIdLookupVariantChunk)
        .eq('is_active', true)
        .eq('validation_status', 'valid'),
      signal,
    );

    if (seedError) {
      throw new Error('Unable to load live catalog offers.');
    }

    offerSeeds.push(
      ...((seedData as CatalogCommerceOfferSeedRow[] | null) ?? []),
    );
  }

  if (!offerSeeds.length) {
    return liveOffersBySetId;
  }

  const merchantIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
  ];
  const offerSeedIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.id)),
  ];
  throwIfCatalogReadAborted(signal);

  const { data: merchantData, error: merchantError } =
    await applyCatalogAbortSignal(
      supabaseClient
        .from(COMMERCE_MERCHANTS_TABLE)
        .select('id, slug, name, is_active')
        .in('id', merchantIds)
        .eq('is_active', true),
      signal,
    );
  const latestOfferRows: CatalogCommerceOfferLatestRow[] = [];

  for (const offerSeedIdChunk of chunkCatalogValues(
    offerSeedIds,
    CATALOG_CURRENT_OFFER_IN_FILTER_PAGE_SIZE,
  )) {
    throwIfCatalogReadAborted(signal);

    const { data: latestOfferData, error: latestOfferError } =
      await applyCatalogAbortSignal(
        supabaseClient
          .from(COMMERCE_OFFER_LATEST_TABLE)
          .select(
            'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, updated_at',
          )
          .in('offer_seed_id', offerSeedIdChunk)
          .order('updated_at', {
            ascending: false,
          }),
        signal,
      );

    if (latestOfferError) {
      throw new Error('Unable to load live catalog offers.');
    }

    latestOfferRows.push(
      ...((latestOfferData as CatalogCommerceOfferLatestRow[] | null) ?? []),
    );
  }

  if (merchantError) {
    throw new Error('Unable to load live catalog offers.');
  }

  throwIfCatalogReadAborted(signal);

  const merchantById = new Map(
    ((merchantData as CatalogCommerceMerchantRow[] | null) ?? []).map(
      (merchantRow) => [merchantRow.id, merchantRow],
    ),
  );
  const latestOfferBySeedId = new Map<string, CatalogCommerceOfferLatestRow>();

  for (const latestOfferRow of latestOfferRows) {
    if (!latestOfferBySeedId.has(latestOfferRow.offer_seed_id)) {
      latestOfferBySeedId.set(latestOfferRow.offer_seed_id, latestOfferRow);
    }
  }

  for (const offerSeed of offerSeeds) {
    const merchant = merchantById.get(offerSeed.merchant_id);
    const latestOffer = latestOfferBySeedId.get(offerSeed.id);

    if (!merchant || !latestOffer) {
      continue;
    }

    const catalogRuntimeOffer = toCatalogRuntimeOffer({
      latestOffer,
      merchant,
      offerSeed,
    });

    if (!catalogRuntimeOffer) {
      continue;
    }

    const existingOffers = liveOffersBySetId.get(
      getCanonicalCatalogSetId(offerSeed.set_id),
    );

    if (!existingOffers) {
      continue;
    }

    existingOffers.push(catalogRuntimeOffer);
  }

  return new Map(
    [...liveOffersBySetId.entries()].map(([setId, offers]) => [
      setId,
      sortResolvedCatalogOffers(offers) as CatalogRuntimeOffer[],
    ]),
  );
}

async function listCatalogRuntimeOffersByCurrentOffersFromSupabase({
  limit = CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT,
  supabaseClient,
}: {
  limit?: number;
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, CatalogRuntimeOffer[]>> {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT,
  );
  const { data: latestOfferData, error: latestOfferError } =
    await supabaseClient
      .from(COMMERCE_OFFER_LATEST_TABLE)
      .select(
        'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, updated_at',
      )
      .eq('fetch_status', 'success')
      .eq('currency_code', 'EUR')
      .order('updated_at', {
        ascending: false,
      })
      .limit(safeLimit);

  if (latestOfferError) {
    throw new Error('Unable to load live catalog offers.');
  }

  const latestOffers = (
    (latestOfferData as CatalogCommerceOfferLatestRow[] | null) ?? []
  ).filter(
    (latestOffer) =>
      typeof latestOffer.price_minor === 'number' &&
      latestOffer.price_minor > 0,
  );

  if (!latestOffers.length) {
    return new Map();
  }

  const latestOfferBySeedId = new Map<string, CatalogCommerceOfferLatestRow>();

  for (const latestOffer of latestOffers) {
    if (!latestOfferBySeedId.has(latestOffer.offer_seed_id)) {
      latestOfferBySeedId.set(latestOffer.offer_seed_id, latestOffer);
    }
  }

  const offerSeedIds = [...latestOfferBySeedId.keys()];
  const { data: seedData, error: seedError } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
    )
    .in('id', offerSeedIds)
    .eq('is_active', true)
    .eq('validation_status', 'valid');

  if (seedError) {
    throw new Error('Unable to load live catalog offers.');
  }

  const offerSeeds = (seedData as CatalogCommerceOfferSeedRow[] | null) ?? [];

  if (!offerSeeds.length) {
    return new Map();
  }

  const candidateSetIds = [
    ...new Set(
      offerSeeds
        .map((offerSeed) => getCanonicalCatalogSetId(offerSeed.set_id))
        .filter((setId) => setId.length > 0),
    ),
  ];

  if (!candidateSetIds.length) {
    return new Map();
  }

  return listCatalogRuntimeOffersBySetIdsFromSupabase({
    setIds: candidateSetIds,
    supabaseClient,
  });
}

async function listCatalogRuntimeOffersByAllCurrentOffersFromSupabase({
  supabaseClient,
}: {
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, CatalogRuntimeOffer[]>> {
  const latestOfferBySeedId = new Map<string, CatalogCommerceOfferLatestRow>();

  for (let offset = 0; ; offset += CATALOG_CURRENT_OFFER_PAGE_SIZE) {
    const { data: latestOfferData, error: latestOfferError } =
      await supabaseClient
        .from(COMMERCE_OFFER_LATEST_TABLE)
        .select(
          'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, updated_at',
        )
        .eq('fetch_status', 'success')
        .eq('currency_code', 'EUR')
        .order('updated_at', {
          ascending: false,
        })
        .range(offset, offset + CATALOG_CURRENT_OFFER_PAGE_SIZE - 1);

    if (latestOfferError) {
      throw new Error('Unable to load live catalog offers.');
    }

    const latestOffers =
      (latestOfferData as CatalogCommerceOfferLatestRow[] | null) ?? [];

    for (const latestOffer of latestOffers) {
      if (
        typeof latestOffer.price_minor === 'number' &&
        latestOffer.price_minor > 0 &&
        !latestOfferBySeedId.has(latestOffer.offer_seed_id)
      ) {
        latestOfferBySeedId.set(latestOffer.offer_seed_id, latestOffer);
      }
    }

    if (latestOffers.length < CATALOG_CURRENT_OFFER_PAGE_SIZE) {
      break;
    }
  }

  const offerSeedIds = [...latestOfferBySeedId.keys()];

  if (!offerSeedIds.length) {
    return new Map();
  }

  const offerSeeds: CatalogCommerceOfferSeedRow[] = [];

  for (const seedIdChunk of chunkCatalogValues(
    offerSeedIds,
    CATALOG_CURRENT_OFFER_IN_FILTER_PAGE_SIZE,
  )) {
    const { data: seedData, error: seedError } = await supabaseClient
      .from(COMMERCE_OFFER_SEEDS_TABLE)
      .select(
        'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
      )
      .in('id', seedIdChunk)
      .eq('is_active', true)
      .eq('validation_status', 'valid');

    if (seedError) {
      throw new Error('Unable to load live catalog offers.');
    }

    offerSeeds.push(
      ...((seedData as CatalogCommerceOfferSeedRow[] | null) ?? []),
    );
  }

  const merchantIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
  ];

  if (!offerSeeds.length || !merchantIds.length) {
    return new Map();
  }

  const { data: merchantData, error: merchantError } = await supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .select('id, slug, name, is_active')
    .in('id', merchantIds)
    .eq('is_active', true);

  if (merchantError) {
    throw new Error('Unable to load live catalog offers.');
  }

  const merchantById = new Map(
    ((merchantData as CatalogCommerceMerchantRow[] | null) ?? []).map(
      (merchantRow) => [merchantRow.id, merchantRow],
    ),
  );
  const liveOffersBySetId = new Map<string, CatalogRuntimeOffer[]>();

  for (const offerSeed of offerSeeds) {
    const latestOffer = latestOfferBySeedId.get(offerSeed.id);
    const merchant = merchantById.get(offerSeed.merchant_id);

    if (!latestOffer || !merchant) {
      continue;
    }

    const catalogRuntimeOffer = toCatalogRuntimeOffer({
      latestOffer,
      merchant,
      offerSeed,
    });

    if (!catalogRuntimeOffer) {
      continue;
    }

    const existingOffers =
      liveOffersBySetId.get(catalogRuntimeOffer.setId) ?? [];
    existingOffers.push(catalogRuntimeOffer);
    liveOffersBySetId.set(catalogRuntimeOffer.setId, existingOffers);
  }

  return new Map(
    [...liveOffersBySetId.entries()].map(([setId, offers]) => [
      setId,
      sortResolvedCatalogOffers(offers) as CatalogRuntimeOffer[],
    ]),
  );
}

export async function getCatalogCommerceRailRuntimeDiagnostics({
  environment = process.env,
  limit = CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT,
  supabaseClient,
}: {
  environment?: Record<string, string | undefined>;
  limit?: number;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogCommerceRailRuntimeDiagnostics> {
  const runtimeDiagnostics = {
    hasBrowserSupabaseConfig: hasBrowserSupabaseConfig(environment),
    hasServerSupabaseConfig: hasServerSupabaseConfig(environment),
    missingBrowserSupabaseEnvKeys:
      getMissingBrowserSupabaseEnvKeys(environment),
    missingServerSupabaseEnvKeys: getMissingServerSupabaseEnvKeys(environment),
    serverSupabaseUrlSource: getServerSupabaseUrlSource(environment),
  };
  const emptyDiagnostics = {
    ...runtimeDiagnostics,
    activeMerchantCount: 0,
    activeSeedCount: 0,
    currentOfferRowCount: 0,
    currentOfferRowsWithValidPriceCount: 0,
    rowsAfterMerchantJoinCount: 0,
    rowsAfterPriceDeeplinkInStockFiltersCount: 0,
    rowsAfterSeedJoinCount: 0,
    summaryCount: 0,
  };
  const activeSupabaseClient =
    supabaseClient ??
    (environment === process.env
      ? getWebCatalogSupabaseReadClient()
      : undefined);

  if (!activeSupabaseClient) {
    return emptyDiagnostics;
  }

  try {
    const safeLimit = Math.min(
      Math.max(Math.trunc(limit), 1),
      CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT,
    );
    const [
      { data: latestOfferData, error: latestOfferError },
      { data: activeMerchantData, error: activeMerchantError },
      { data: activeSeedData, error: activeSeedError },
    ] = await Promise.all([
      activeSupabaseClient
        .from(COMMERCE_OFFER_LATEST_TABLE)
        .select(
          'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, updated_at',
        )
        .eq('fetch_status', 'success')
        .eq('currency_code', 'EUR')
        .order('updated_at', {
          ascending: false,
        })
        .limit(safeLimit),
      activeSupabaseClient
        .from(COMMERCE_MERCHANTS_TABLE)
        .select('id, slug, name, is_active')
        .eq('is_active', true),
      activeSupabaseClient
        .from(COMMERCE_OFFER_SEEDS_TABLE)
        .select(
          'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
        )
        .eq('is_active', true)
        .eq('validation_status', 'valid'),
    ]);

    if (latestOfferError || activeMerchantError || activeSeedError) {
      return emptyDiagnostics;
    }

    const latestOffers =
      (latestOfferData as CatalogCommerceOfferLatestRow[] | null) ?? [];
    const latestOffersWithValidPrice = latestOffers.filter(
      (latestOffer) =>
        typeof latestOffer.price_minor === 'number' &&
        latestOffer.price_minor > 0,
    );
    const latestOfferBySeedId = new Map<
      string,
      CatalogCommerceOfferLatestRow
    >();

    for (const latestOffer of latestOffersWithValidPrice) {
      if (!latestOfferBySeedId.has(latestOffer.offer_seed_id)) {
        latestOfferBySeedId.set(latestOffer.offer_seed_id, latestOffer);
      }
    }

    const currentOfferSeedIds = [...latestOfferBySeedId.keys()];
    const currentOfferSeeds =
      currentOfferSeedIds.length > 0
        ? await activeSupabaseClient
            .from(COMMERCE_OFFER_SEEDS_TABLE)
            .select(
              'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
            )
            .in('id', currentOfferSeedIds)
            .eq('is_active', true)
            .eq('validation_status', 'valid')
        : { data: [], error: null };

    if (currentOfferSeeds.error) {
      return emptyDiagnostics;
    }

    const activeMerchants =
      (activeMerchantData as CatalogCommerceMerchantRow[] | null) ?? [];
    const activeSeeds =
      (activeSeedData as CatalogCommerceOfferSeedRow[] | null) ?? [];
    const offerSeeds =
      (currentOfferSeeds.data as CatalogCommerceOfferSeedRow[] | null) ?? [];
    const merchantById = new Map(
      activeMerchants.map((merchantRow) => [merchantRow.id, merchantRow]),
    );
    let rowsAfterMerchantJoinCount = 0;
    let rowsAfterPriceDeeplinkInStockFiltersCount = 0;
    const liveOffersBySetId = new Map<string, CatalogRuntimeOffer[]>();

    for (const offerSeed of offerSeeds) {
      const latestOffer = latestOfferBySeedId.get(offerSeed.id);
      const merchant = merchantById.get(offerSeed.merchant_id);

      if (!latestOffer || !merchant) {
        continue;
      }

      rowsAfterMerchantJoinCount += 1;

      const catalogRuntimeOffer = toCatalogRuntimeOffer({
        latestOffer,
        merchant,
        offerSeed,
      });

      if (!catalogRuntimeOffer) {
        continue;
      }

      if (
        catalogRuntimeOffer.priceCents > 0 &&
        catalogRuntimeOffer.url.length > 0 &&
        catalogRuntimeOffer.availability === 'in_stock'
      ) {
        rowsAfterPriceDeeplinkInStockFiltersCount += 1;
      }

      const existingOffers =
        liveOffersBySetId.get(catalogRuntimeOffer.setId) ?? [];
      existingOffers.push(catalogRuntimeOffer);
      liveOffersBySetId.set(catalogRuntimeOffer.setId, existingOffers);
    }

    return {
      ...runtimeDiagnostics,
      activeMerchantCount: activeMerchants.length,
      activeSeedCount: activeSeeds.length,
      currentOfferRowCount: latestOffers.length,
      currentOfferRowsWithValidPriceCount: latestOffersWithValidPrice.length,
      rowsAfterMerchantJoinCount,
      rowsAfterPriceDeeplinkInStockFiltersCount,
      rowsAfterSeedJoinCount: offerSeeds.length,
      summaryCount: liveOffersBySetId.size,
    };
  } catch {
    return emptyDiagnostics;
  }
}

export async function listCatalogSetLiveOffersBySetId({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  setId,
  supabaseClient,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogRuntimeOffer[]> {
  try {
    if (!supabaseClient) {
      const response = await (fetchImpl ?? fetch)(
        `${apiBaseUrl ?? getCatalogApiBaseUrl()}${buildCatalogSetLiveOffersApiPath(setId)}`,
        {
          headers: {
            accept: 'application/json',
          },
          ...(typeof cacheOptions?.revalidateSeconds === 'number'
            ? {
                next: {
                  revalidate: cacheOptions.revalidateSeconds,
                  tags: cacheOptions.tags ? [...cacheOptions.tags] : undefined,
                },
              }
            : {
                next: {
                  revalidate: 21_600,
                  tags: [cacheTags.prices(), cacheTags.set(setId)],
                },
              }),
        },
      );

      if (!response.ok) {
        throw new Error('Unable to load live catalog offers.');
      }

      const payload = await response.json();

      if (Array.isArray(payload)) {
        return payload as CatalogRuntimeOffer[];
      }

      return [];
    }

    if (!supabaseClient && !hasServerSupabaseConfig()) {
      return [];
    }

    const activeSupabaseClient =
      supabaseClient ?? getWebCatalogSupabaseAdminClient();
    const liveOffersBySetId =
      await listCatalogRuntimeOffersBySetIdsFromSupabase({
        setIds: [setId],
        supabaseClient: activeSupabaseClient,
      });

    return liveOffersBySetId.get(setId) ?? [];
  } catch (error) {
    if (!supabaseClient && hasServerSupabaseConfig()) {
      const liveOffersBySetId =
        await listCatalogRuntimeOffersBySetIdsFromSupabase({
          setIds: [setId],
          supabaseClient: getWebCatalogSupabaseAdminClient(),
        });

      return liveOffersBySetId.get(setId) ?? [];
    }

    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

async function listCatalogDiscoverySignalsViaApi({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  setIds,
  signal,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  setIds: readonly string[];
  signal?: AbortSignal;
}): Promise<Map<string, CatalogDiscoverySignal>> {
  const catalogDiscoverySignalBySetId = new Map<
    string,
    CatalogDiscoverySignal
  >();
  const startedAt = Date.now();

  for (const setIdChunk of chunkCatalogValues(
    setIds,
    CATALOG_DISCOVERY_HTTP_BATCH_SIZE,
  )) {
    throwIfCatalogReadAborted(signal);

    const response = await (fetchImpl ?? fetch)(
      `${apiBaseUrl ?? getCatalogApiBaseUrl()}${buildCatalogDiscoverySignalsApiPath(setIdChunk)}`,
      {
        headers: {
          accept: 'application/json',
        },
        signal,
        ...(typeof cacheOptions?.revalidateSeconds === 'number'
          ? {
              next: {
                revalidate: cacheOptions.revalidateSeconds,
                tags: cacheOptions.tags ? [...cacheOptions.tags] : undefined,
              },
            }
          : {
              next: {
                revalidate: 21_600,
                tags: [cacheTags.prices()],
              },
            }),
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load catalog discovery signals.');
    }

    throwIfCatalogReadAborted(signal);

    const payload = await response.json();

    if (!Array.isArray(payload)) {
      continue;
    }

    for (const catalogDiscoverySignalRecord of payload) {
      if (!isCatalogDiscoverySignalRecord(catalogDiscoverySignalRecord)) {
        continue;
      }

      const {
        setId,
        bestPriceMinor,
        merchantCount,
        nextBestPriceMinor,
        observedAt,
        priceSpreadMinor,
        recentReferencePriceChangeMinor,
        recentReferencePriceChangedAt,
        referenceDeltaMinor,
      } = catalogDiscoverySignalRecord;

      catalogDiscoverySignalBySetId.set(setId, {
        bestPriceMinor,
        merchantCount,
        nextBestPriceMinor,
        observedAt,
        priceSpreadMinor,
        recentReferencePriceChangeMinor,
        recentReferencePriceChangedAt,
        referenceDeltaMinor,
      });
    }
  }

  logDiscoverySignalReadDiagnostic({
    request_duration_ms: Date.now() - startedAt,
    set_id_count: setIds.length,
    signal_count: catalogDiscoverySignalBySetId.size,
    source: 'api',
  });

  return catalogDiscoverySignalBySetId;
}

async function listCatalogDiscoverySignalsFromSupabase({
  setIds,
  signal,
  supabaseClient,
}: {
  setIds: readonly string[];
  signal?: AbortSignal;
  supabaseClient: CatalogSupabaseClient;
}): Promise<Map<string, CatalogDiscoverySignal>> {
  const startedAt = Date.now();
  throwIfCatalogReadAborted(signal);

  let seedQuery = supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
    )
    .eq('is_active', true)
    .eq('validation_status', 'valid');

  if (setIds.length) {
    seedQuery = seedQuery.in('set_id', setIds);
  }

  const { data: seedData, error: seedError } = await seedQuery;

  if (seedError) {
    throw new Error('Unable to load catalog discovery signals.');
  }

  throwIfCatalogReadAborted(signal);

  const offerSeeds = (seedData as CatalogCommerceOfferSeedRow[] | null) ?? [];

  if (!offerSeeds.length) {
    return new Map();
  }

  const merchantIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
  ];
  const offerSeedIds = offerSeeds.map((offerSeed) => offerSeed.id);
  const [
    { data: merchantData, error: merchantError },
    { data: latestOfferData, error: latestOfferError },
  ] = await Promise.all([
    supabaseClient
      .from(COMMERCE_MERCHANTS_TABLE)
      .select('id, slug, name, is_active')
      .in('id', merchantIds)
      .eq('is_active', true),
    supabaseClient
      .from(COMMERCE_OFFER_LATEST_TABLE)
      .select(
        'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, updated_at',
      )
      .in('offer_seed_id', offerSeedIds)
      .order('updated_at', {
        ascending: false,
      }),
  ]);

  if (merchantError || latestOfferError) {
    throw new Error('Unable to load catalog discovery signals.');
  }

  throwIfCatalogReadAborted(signal);

  const merchantById = new Map(
    ((merchantData as CatalogCommerceMerchantRow[] | null) ?? []).map(
      (merchantRow) => [merchantRow.id, merchantRow],
    ),
  );
  const latestOfferBySeedId = new Map<string, CatalogCommerceOfferLatestRow>();

  for (const latestOfferRow of (latestOfferData as
    | CatalogCommerceOfferLatestRow[]
    | null) ?? []) {
    if (!latestOfferBySeedId.has(latestOfferRow.offer_seed_id)) {
      latestOfferBySeedId.set(latestOfferRow.offer_seed_id, latestOfferRow);
    }
  }

  const currentOfferBySetAndMerchantSlug = new Map<
    string,
    CatalogDiscoveryCurrentOffer
  >();

  for (const offerSeed of offerSeeds) {
    const merchant = merchantById.get(offerSeed.merchant_id);
    const latestOffer = latestOfferBySeedId.get(offerSeed.id);

    if (
      !merchant ||
      !latestOffer ||
      latestOffer.fetch_status !== 'success' ||
      latestOffer.currency_code !== EURO_CURRENCY_CODE ||
      !Number.isInteger(latestOffer.price_minor) ||
      (latestOffer.price_minor ?? 0) <= 0 ||
      !latestOffer.observed_at ||
      !isEligibleCatalogDiscoveryOfferAvailability(latestOffer.availability)
    ) {
      continue;
    }

    const observationKey = `${offerSeed.set_id}:${merchant.slug}`;
    const existingObservation =
      currentOfferBySetAndMerchantSlug.get(observationKey);

    if (
      !existingObservation ||
      latestOffer.observed_at > existingObservation.observedAt
    ) {
      currentOfferBySetAndMerchantSlug.set(observationKey, {
        commercialUnitType: classifyCommerceCommercialUnitType({
          notes: offerSeed.notes,
          productUrl: offerSeed.product_url,
          setId: offerSeed.set_id,
        }),
        merchantSlug: merchant.slug,
        observedAt: latestOffer.observed_at,
        priceMinor: latestOffer.price_minor ?? 0,
        setId: offerSeed.set_id,
      });
    }
  }

  const currentOfferGroupsBySetId = new Map<
    string,
    CatalogDiscoveryCurrentOffer[]
  >();

  for (const currentOffer of currentOfferBySetAndMerchantSlug.values()) {
    const currentOfferGroup =
      currentOfferGroupsBySetId.get(currentOffer.setId) ?? [];

    currentOfferGroup.push(currentOffer);
    currentOfferGroupsBySetId.set(currentOffer.setId, currentOfferGroup);
  }

  const discoverySignalSetIds = [...currentOfferGroupsBySetId.keys()];
  const referencePriceMinorBySetId = new Map<string, number>();
  const recentReferencePriceSnapshotsBySetId = new Map<
    string,
    CatalogReferencePriceSnapshot[]
  >();

  if (discoverySignalSetIds.length) {
    const { data: priceHistoryData, error: priceHistoryError } =
      await supabaseClient
        .from(PRICING_DAILY_SET_HISTORY_TABLE)
        .select('set_id, reference_price_minor, recorded_on')
        .in('set_id', discoverySignalSetIds)
        .eq('region_code', DUTCH_REGION_CODE)
        .eq('currency_code', EURO_CURRENCY_CODE)
        .eq('condition', NEW_OFFER_CONDITION)
        .order('recorded_on', {
          ascending: false,
        })
        .limit(
          discoverySignalSetIds.length *
            CATALOG_DISCOVERY_PRICE_HISTORY_ROWS_PER_SET,
        );

    if (priceHistoryError) {
      throw new Error('Unable to load catalog discovery signals.');
    }

    for (const priceHistoryRow of (priceHistoryData as
      | CatalogPriceHistoryRow[]
      | null) ?? []) {
      if (!Number.isInteger(priceHistoryRow.reference_price_minor)) {
        continue;
      }

      if (!referencePriceMinorBySetId.has(priceHistoryRow.set_id)) {
        referencePriceMinorBySetId.set(
          priceHistoryRow.set_id,
          priceHistoryRow.reference_price_minor ?? 0,
        );
      }

      const existingSnapshots =
        recentReferencePriceSnapshotsBySetId.get(priceHistoryRow.set_id) ?? [];

      if (existingSnapshots.length >= 2) {
        continue;
      }

      existingSnapshots.push({
        recordedOn: priceHistoryRow.recorded_on,
        referencePriceMinor: priceHistoryRow.reference_price_minor ?? 0,
      });
      recentReferencePriceSnapshotsBySetId.set(
        priceHistoryRow.set_id,
        existingSnapshots,
      );
    }
  }

  const catalogDiscoverySignalBySetId = new Map<
    string,
    CatalogDiscoverySignal
  >();

  for (const [setId, currentOffers] of currentOfferGroupsBySetId.entries()) {
    const comparableCurrentOffers =
      selectComparableCatalogDiscoveryOffers(currentOffers);
    const sortedPriceMinorValues = comparableCurrentOffers
      .map((currentOffer) => currentOffer.priceMinor)
      .sort((left, right) => left - right);
    const bestPriceMinor = sortedPriceMinorValues[0];

    if (typeof bestPriceMinor !== 'number') {
      continue;
    }

    const highestPriceMinor =
      sortedPriceMinorValues[sortedPriceMinorValues.length - 1] ??
      bestPriceMinor;
    const referencePriceMinor = referencePriceMinorBySetId.get(setId);
    const recentReferencePriceSnapshots =
      recentReferencePriceSnapshotsBySetId.get(setId) ?? [];
    const latestReferencePriceSnapshot = recentReferencePriceSnapshots[0];
    const previousReferencePriceSnapshot = recentReferencePriceSnapshots[1];
    const recentReferencePriceChangeMinor =
      latestReferencePriceSnapshot && previousReferencePriceSnapshot
        ? latestReferencePriceSnapshot.referencePriceMinor -
          previousReferencePriceSnapshot.referencePriceMinor
        : undefined;

    catalogDiscoverySignalBySetId.set(setId, {
      bestPriceMinor,
      merchantCount: comparableCurrentOffers.length,
      nextBestPriceMinor: sortedPriceMinorValues[1],
      observedAt: comparableCurrentOffers.reduce(
        (latestObservedAt, currentOffer) =>
          currentOffer.observedAt > latestObservedAt
            ? currentOffer.observedAt
            : latestObservedAt,
        comparableCurrentOffers[0]?.observedAt ?? '',
      ),
      priceSpreadMinor: Math.max(0, highestPriceMinor - bestPriceMinor),
      recentReferencePriceChangeMinor:
        recentReferencePriceChangeMinor && recentReferencePriceChangeMinor !== 0
          ? recentReferencePriceChangeMinor
          : undefined,
      recentReferencePriceChangedAt:
        recentReferencePriceChangeMinor && recentReferencePriceChangeMinor !== 0
          ? latestReferencePriceSnapshot?.recordedOn
          : undefined,
      referenceDeltaMinor:
        typeof referencePriceMinor === 'number'
          ? bestPriceMinor - referencePriceMinor
          : undefined,
    });
  }

  logDiscoverySignalReadDiagnostic({
    request_duration_ms: Date.now() - startedAt,
    set_id_count: setIds.length,
    signal_count: catalogDiscoverySignalBySetId.size,
    source: 'direct_supabase',
  });

  return catalogDiscoverySignalBySetId;
}

export async function listCatalogDiscoverySignalsBySetId({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  setIds,
  signal,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  setIds?: readonly string[];
  signal?: AbortSignal;
} = {}): Promise<Map<string, CatalogDiscoverySignal>> {
  const scopedSetIds = [
    ...new Set(
      (setIds ?? [])
        .map((setId) => getCanonicalCatalogSetId(setId))
        .filter((setId) => setId.length > 0),
    ),
  ];

  if (!scopedSetIds.length) {
    return new Map();
  }

  try {
    const activeSupabaseClient =
      fetchImpl || apiBaseUrl ? undefined : getWebCatalogSupabaseReadClient();

    if (!activeSupabaseClient) {
      return await listCatalogDiscoverySignalsViaApi({
        apiBaseUrl,
        cacheOptions,
        fetchImpl,
        setIds: scopedSetIds,
        signal,
      });
    }

    return await listCatalogDiscoverySignalsFromSupabase({
      setIds: scopedSetIds,
      signal,
      supabaseClient: activeSupabaseClient,
    });
  } catch {
    return new Map();
  }
}

export async function getCatalogPrimaryOfferAvailabilityStateBySetId({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogPrimaryOfferAvailabilityState> {
  const canonicalSetId = getCanonicalCatalogSetId(setId);

  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return {
      primaryMerchantCount: PRIMARY_CATALOG_MERCHANT_SLUGS.length,
      primarySeedCount: 0,
      validPrimaryOfferCount: 0,
    };
  }

  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseAdminClient();
  const { data: merchantData, error: merchantError } =
    await activeSupabaseClient
      .from(COMMERCE_MERCHANTS_TABLE)
      .select('id, slug, name, is_active')
      .in('slug', [...PRIMARY_CATALOG_MERCHANT_SLUGS])
      .eq('is_active', true);

  if (merchantError) {
    throw new Error('Unable to load primary catalog merchant availability.');
  }

  const primaryMerchants =
    (merchantData as CatalogCommerceMerchantRow[] | null) ?? [];
  const primaryMerchantIds = primaryMerchants.map((merchant) => merchant.id);

  if (primaryMerchantIds.length === 0) {
    return {
      primaryMerchantCount: 0,
      primarySeedCount: 0,
      validPrimaryOfferCount: 0,
    };
  }

  const { data: seedData, error: seedError } = await activeSupabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
    )
    .eq('set_id', canonicalSetId)
    .eq('is_active', true)
    .in('merchant_id', primaryMerchantIds);

  if (seedError) {
    throw new Error('Unable to load primary catalog merchant availability.');
  }

  const offerSeeds = (seedData as CatalogCommerceOfferSeedRow[] | null) ?? [];

  if (offerSeeds.length === 0) {
    return {
      primaryMerchantCount: primaryMerchantIds.length,
      primarySeedCount: 0,
      validPrimaryOfferCount: 0,
    };
  }

  const offerSeedIds = offerSeeds.map((offerSeed) => offerSeed.id);
  const { data: latestOfferData, error: latestOfferError } =
    await activeSupabaseClient
      .from(COMMERCE_OFFER_LATEST_TABLE)
      .select(
        'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, updated_at',
      )
      .in('offer_seed_id', offerSeedIds)
      .order('updated_at', {
        ascending: false,
      });

  if (latestOfferError) {
    throw new Error('Unable to load primary catalog merchant availability.');
  }

  const latestOffers =
    (latestOfferData as CatalogCommerceOfferLatestRow[] | null) ?? [];
  const latestOfferBySeedId = new Map<string, CatalogCommerceOfferLatestRow>();

  for (const latestOffer of latestOffers) {
    if (!latestOfferBySeedId.has(latestOffer.offer_seed_id)) {
      latestOfferBySeedId.set(latestOffer.offer_seed_id, latestOffer);
    }
  }

  const primarySeedMerchantIds = new Set(
    offerSeeds.map((offerSeed) => offerSeed.merchant_id),
  );
  const validPrimaryOfferMerchantIds = new Set(
    offerSeeds.flatMap((offerSeed) => {
      const latestOffer = latestOfferBySeedId.get(offerSeed.id);

      if (
        offerSeed.validation_status !== 'valid' ||
        !latestOffer ||
        latestOffer.fetch_status !== 'success' ||
        normalizeRuntimeOfferAvailability(latestOffer.availability) !==
          'in_stock'
      ) {
        return [];
      }

      return [offerSeed.merchant_id];
    }),
  );

  return {
    latestPrimaryOfferCheckedAt: getLatestCheckedAtForPrimaryOffers([
      ...latestOfferBySeedId.values(),
    ]),
    primaryMerchantCount: primaryMerchantIds.length,
    primarySeedCount: primarySeedMerchantIds.size,
    validPrimaryOfferCount: validPrimaryOfferMerchantIds.size,
  };
}

export async function getCatalogCurrentOfferSummaryBySetId({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  setId,
  supabaseClient,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCurrentOfferSummary> {
  const liveOffers = await listCatalogSetLiveOffersBySetId({
    apiBaseUrl,
    cacheOptions,
    fetchImpl,
    setId,
    supabaseClient,
  });

  return summarizeCatalogCurrentOffers({
    generatedOffers: [],
    liveOffers,
    setId,
  });
}

async function listCatalogCurrentOfferSummariesViaApi({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  setIds,
  signal,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  setIds: readonly string[];
  signal?: AbortSignal;
}): Promise<Map<string, CatalogCurrentOfferSummary>> {
  const summaryBySetId = new Map<string, CatalogCurrentOfferSummary>();
  const startedAt = Date.now();

  for (const setIdChunk of chunkCatalogValues(
    setIds,
    CATALOG_CURRENT_OFFER_HTTP_BATCH_SIZE,
  )) {
    throwIfCatalogReadAborted(signal);

    const response = await (fetchImpl ?? fetch)(
      `${apiBaseUrl ?? getCatalogApiBaseUrl()}${buildCatalogCurrentOfferSummariesApiPath(setIdChunk)}`,
      {
        headers: {
          accept: 'application/json',
        },
        signal,
        ...(typeof cacheOptions?.revalidateSeconds === 'number'
          ? {
              next: {
                revalidate: cacheOptions.revalidateSeconds,
                tags: cacheOptions.tags ? [...cacheOptions.tags] : undefined,
              },
            }
          : {
              next: {
                revalidate: 21_600,
                tags: [
                  cacheTags.prices(),
                  ...setIdChunk.map((setId) => cacheTags.set(setId)),
                ],
              },
            }),
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load current catalog offer summaries.');
    }

    throwIfCatalogReadAborted(signal);

    const payload = await response.json();

    for (const summaryRecord of Array.isArray(payload) ? payload : []) {
      const normalizedSummary =
        normalizeCatalogCurrentOfferSummaryRecord(summaryRecord);

      if (!normalizedSummary || normalizedSummary.offers.length === 0) {
        continue;
      }

      summaryBySetId.set(normalizedSummary.setId, normalizedSummary);
    }
  }

  logCurrentOfferSummaryReadDiagnostic({
    request_duration_ms: Date.now() - startedAt,
    set_id_count: setIds.length,
    source: 'api',
    summary_count: summaryBySetId.size,
  });

  return summaryBySetId;
}

export async function listCatalogCurrentOfferSummariesBySetIds({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  liveFallbackSetIdLimit,
  setIds,
  signal,
  supabaseClient,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  liveFallbackSetIdLimit?: number;
  setIds: readonly string[];
  signal?: AbortSignal;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<Map<string, CatalogCurrentOfferSummary>> {
  const uniqueSetIds = [
    ...new Set(
      setIds
        .map((setId) => getCanonicalCatalogSetId(setId))
        .filter((setId) => setId.length > 0),
    ),
  ];

  if (!uniqueSetIds.length) {
    return new Map();
  }

  try {
    const activeSupabaseClient =
      supabaseClient ??
      (fetchImpl || apiBaseUrl ? undefined : getWebCatalogSupabaseReadClient());

    if (!activeSupabaseClient) {
      return listCatalogCurrentOfferSummariesViaApi({
        apiBaseUrl,
        cacheOptions,
        fetchImpl,
        setIds: uniqueSetIds,
        signal,
      });
    }

    const startedAt = Date.now();
    const snapshotResult =
      await listCatalogCurrentOfferSnapshotSummariesBySetIds({
        signal,
        setIds: uniqueSetIds,
        supabaseClient: activeSupabaseClient,
      });
    const shouldUseLiveFallback =
      snapshotResult.fallbackSetIds.length > 0 &&
      (liveFallbackSetIdLimit === undefined ||
        snapshotResult.fallbackSetIds.length <= liveFallbackSetIdLimit);
    const fallbackOffersBySetId = shouldUseLiveFallback
      ? await listCatalogRuntimeOffersBySetIdsFromSupabase({
          signal,
          setIds: snapshotResult.fallbackSetIds,
          supabaseClient: activeSupabaseClient,
        })
      : new Map<string, CatalogRuntimeOffer[]>();
    const summaryBySetId = new Map([
      ...snapshotResult.summaryBySetId,
      ...toCatalogCurrentOfferSummaryMap(fallbackOffersBySetId),
    ]);

    logCurrentOfferSummaryReadDiagnostic({
      fallback_set_id_count: snapshotResult.fallbackSetIds.length,
      live_fallback_skipped_set_id_count: shouldUseLiveFallback
        ? 0
        : snapshotResult.fallbackSetIds.length,
      request_duration_ms: Date.now() - startedAt,
      set_id_count: uniqueSetIds.length,
      snapshot_hit_count: snapshotResult.summaryBySetId.size,
      snapshot_missing_best_offer_count:
        snapshotResult.snapshotMissingBestOfferCount,
      snapshot_stale_count: snapshotResult.snapshotStaleCount,
      source: 'direct_supabase_snapshot',
      summary_count: summaryBySetId.size,
    });

    return summaryBySetId;
  } catch (error) {
    if (!supabaseClient) {
      return new Map();
    }

    throw error;
  }
}

export async function listCatalogCurrentOfferSummaries({
  limit = CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT,
  supabaseClient,
}: {
  limit?: number;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<Map<string, CatalogCurrentOfferSummary>> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return new Map();
  }

  try {
    const liveOffersBySetId =
      await listCatalogRuntimeOffersByCurrentOffersFromSupabase({
        limit,
        supabaseClient: activeSupabaseClient,
      });

    return toCatalogCurrentOfferSummaryMap(liveOffersBySetId);
  } catch (error) {
    if (!supabaseClient) {
      return new Map();
    }

    throw error;
  }
}

export async function listCachedCatalogCurrentOfferSummaries({
  cacheOptions,
  limit = CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT,
}: {
  cacheOptions: Required<Pick<CatalogApiReadCacheOptions, 'tags'>> &
    Pick<CatalogApiReadCacheOptions, 'revalidateSeconds'>;
  limit?: number;
}): Promise<Map<string, CatalogCurrentOfferSummary>> {
  const cachedRead = unstable_cache(
    async () => {
      const currentOfferSummaryBySetId = await listCatalogCurrentOfferSummaries(
        {
          limit,
        },
      );

      return [...currentOfferSummaryBySetId.entries()];
    },
    ['catalog-current-offer-summaries-v2', String(limit)],
    {
      revalidate: cacheOptions.revalidateSeconds ?? 21_600,
      tags: [...cacheOptions.tags],
    },
  );

  return new Map(await cachedRead());
}

export async function listCatalogAllCurrentOfferSummaries({
  supabaseClient,
}: {
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<Map<string, CatalogCurrentOfferSummary>> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return new Map();
  }

  try {
    const liveOffersBySetId =
      await listCatalogRuntimeOffersByAllCurrentOffersFromSupabase({
        supabaseClient: activeSupabaseClient,
      });

    return toCatalogCurrentOfferSummaryMap(liveOffersBySetId);
  } catch (error) {
    if (!supabaseClient) {
      return new Map();
    }

    throw error;
  }
}

function getSafeCatalogCurrentOfferCandidateLimit(limit: number): number {
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

function normalizeCatalogCurrentOfferCandidateSetIdRecords(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.flatMap((record) => {
        if (typeof record === 'string') {
          return [getCanonicalCatalogSetId(record)];
        }

        if (!record || typeof record !== 'object') {
          return [];
        }

        const setId = (record as { set_id?: unknown; setId?: unknown }).set_id;
        const fallbackSetId = (record as { set_id?: unknown; setId?: unknown })
          .setId;
        const normalizedSetId = getCanonicalCatalogSetId(
          typeof setId === 'string'
            ? setId
            : typeof fallbackSetId === 'string'
              ? fallbackSetId
              : '',
        );

        return normalizedSetId ? [normalizedSetId] : [];
      }),
    ),
  ];
}

async function listCatalogCurrentOfferCandidateSetIdsFromRpc({
  limit,
  supabaseClient,
}: {
  limit: number;
  supabaseClient: CatalogSupabaseClient;
}): Promise<string[] | undefined> {
  const rpcClient = supabaseClient as CatalogSupabaseClient & {
    rpc?: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  if (typeof rpcClient.rpc !== 'function') {
    return undefined;
  }

  const { data, error } = await rpcClient.rpc(
    'list_catalog_current_offer_candidate_set_ids',
    {
      candidate_limit: limit,
    },
  );

  if (error) {
    return undefined;
  }

  return normalizeCatalogCurrentOfferCandidateSetIdRecords(data).slice(
    0,
    limit,
  );
}

async function listCatalogCurrentOfferCandidateSetIdsFromCompactQueries({
  limit,
  supabaseClient,
}: {
  limit: number;
  supabaseClient: CatalogSupabaseClient;
}): Promise<string[]> {
  const latestLookupLimit = Math.min(
    Math.max(
      limit * CATALOG_CURRENT_OFFER_MERCHANDISING_CANDIDATE_LOOKUP_MULTIPLIER,
      limit,
    ),
    CATALOG_CURRENT_OFFER_MERCHANDISING_CANDIDATE_LOOKUP_LIMIT,
  );
  const { data: latestOfferData, error: latestOfferError } =
    await supabaseClient
      .from(COMMERCE_OFFER_LATEST_TABLE)
      .select(
        'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, updated_at',
      )
      .eq('fetch_status', 'success')
      .eq('currency_code', 'EUR')
      .gt('price_minor', 0)
      .in('availability', ['in_stock', 'limited'])
      .order('updated_at', {
        ascending: false,
      })
      .limit(latestLookupLimit);

  if (latestOfferError) {
    throw new Error('Unable to load current offer candidate set ids.');
  }

  const latestOfferBySeedId = new Map<string, CatalogCommerceOfferLatestRow>();

  for (const latestOffer of (latestOfferData as
    | CatalogCommerceOfferLatestRow[]
    | null) ?? []) {
    if (!latestOfferBySeedId.has(latestOffer.offer_seed_id)) {
      latestOfferBySeedId.set(latestOffer.offer_seed_id, latestOffer);
    }
  }

  if (!latestOfferBySeedId.size) {
    return [];
  }

  const offerSeeds: CatalogCommerceOfferSeedRow[] = [];

  for (const seedIdChunk of chunkCatalogValues(
    [...latestOfferBySeedId.keys()],
    CATALOG_CURRENT_OFFER_IN_FILTER_PAGE_SIZE,
  )) {
    const { data: seedData, error: seedError } = await supabaseClient
      .from(COMMERCE_OFFER_SEEDS_TABLE)
      .select(
        'id, set_id, merchant_id, product_url, is_active, validation_status, notes',
      )
      .in('id', seedIdChunk)
      .eq('is_active', true)
      .eq('validation_status', 'valid');

    if (seedError) {
      throw new Error('Unable to load current offer candidate set ids.');
    }

    offerSeeds.push(
      ...((seedData as CatalogCommerceOfferSeedRow[] | null) ?? []),
    );
  }

  if (!offerSeeds.length) {
    return [];
  }

  const merchantIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
  ];
  const { data: merchantData, error: merchantError } = await supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .select('id, slug, name, is_active')
    .in('id', merchantIds)
    .eq('is_active', true);

  if (merchantError) {
    throw new Error('Unable to load current offer candidate set ids.');
  }

  const merchantById = new Map(
    ((merchantData as CatalogCommerceMerchantRow[] | null) ?? []).map(
      (merchantRow) => [merchantRow.id, merchantRow],
    ),
  );
  const candidateBySetId = new Map<
    string,
    {
      bestPriceCents: number;
      latestCheckedAt: string;
      offerCount: number;
    }
  >();

  for (const offerSeed of offerSeeds) {
    const latestOffer = latestOfferBySeedId.get(offerSeed.id);
    const merchant = merchantById.get(offerSeed.merchant_id);

    if (
      !latestOffer ||
      !merchant ||
      !isCommerceMerchantProductionFeed(merchant.slug)
    ) {
      continue;
    }

    const catalogRuntimeOffer = toCatalogRuntimeOffer({
      latestOffer,
      merchant,
      offerSeed,
    });

    if (
      !catalogRuntimeOffer ||
      catalogRuntimeOffer.availability !== 'in_stock' ||
      catalogRuntimeOffer.priceCents <= 0 ||
      catalogRuntimeOffer.url.length === 0 ||
      !isCommerceCommercialUnitComparableForDeals(
        catalogRuntimeOffer.commercialUnitType,
      )
    ) {
      continue;
    }

    const existingCandidate = candidateBySetId.get(catalogRuntimeOffer.setId);

    candidateBySetId.set(catalogRuntimeOffer.setId, {
      bestPriceCents: Math.min(
        existingCandidate?.bestPriceCents ?? Number.MAX_SAFE_INTEGER,
        catalogRuntimeOffer.priceCents,
      ),
      latestCheckedAt:
        existingCandidate &&
        existingCandidate.latestCheckedAt > catalogRuntimeOffer.checkedAt
          ? existingCandidate.latestCheckedAt
          : catalogRuntimeOffer.checkedAt,
      offerCount: (existingCandidate?.offerCount ?? 0) + 1,
    });
  }

  return [...candidateBySetId.entries()]
    .sort(
      ([leftSetId, left], [rightSetId, right]) =>
        right.offerCount - left.offerCount ||
        right.latestCheckedAt.localeCompare(left.latestCheckedAt) ||
        left.bestPriceCents - right.bestPriceCents ||
        leftSetId.localeCompare(rightSetId),
    )
    .map(([setId]) => setId)
    .slice(0, limit);
}

export async function listCatalogCurrentOfferCandidateSetIds({
  cacheOptions,
  limit = CATALOG_CURRENT_OFFER_MERCHANDISING_CANDIDATE_LIMIT,
  supabaseClient,
}: {
  cacheOptions?: Required<Pick<CatalogApiReadCacheOptions, 'tags'>> &
    Pick<CatalogApiReadCacheOptions, 'revalidateSeconds'>;
  limit?: number;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<string[]> {
  const loadCandidateSetIds = async () => {
    const activeSupabaseClient =
      supabaseClient ?? getWebCatalogSupabaseReadClient();
    const candidateLimit = getSafeCatalogCurrentOfferCandidateLimit(limit);

    if (!activeSupabaseClient) {
      return [];
    }

    const rpcCandidateSetIds =
      await listCatalogCurrentOfferCandidateSetIdsFromRpc({
        limit: candidateLimit,
        supabaseClient: activeSupabaseClient,
      });

    if (rpcCandidateSetIds) {
      return rpcCandidateSetIds;
    }

    return listCatalogCurrentOfferCandidateSetIdsFromCompactQueries({
      limit: candidateLimit,
      supabaseClient: activeSupabaseClient,
    });
  };

  if (!cacheOptions || supabaseClient) {
    return loadCandidateSetIds();
  }

  const cachedRead = unstable_cache(
    loadCandidateSetIds,
    ['catalog-current-offer-candidate-set-ids-v1', String(limit)],
    {
      revalidate: cacheOptions.revalidateSeconds ?? 21_600,
      tags: [...cacheOptions.tags],
    },
  );

  return cachedRead();
}

export async function listHomepageSetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  limit = 6,
  rotationSeed,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  limit?: number;
  rotationSeed?: number;
} = {}): Promise<CatalogHomepageSetCard[]> {
  const setCards = await listAllCatalogSetCards({
    listCanonicalCatalogSetsFn,
  });
  const dynamicSetCards = rankCatalogPremiumDiscoverySetCards({
    excludedSetIds,
    getCatalogDiscoverySignalFn:
      getCatalogDiscoverySignalFn ?? (() => undefined),
    limit,
    rotationSeed,
    setCards,
  });

  if (dynamicSetCards.length) {
    return dynamicSetCards;
  }

  if (listCanonicalCatalogSetsFn === listCanonicalCatalogSets) {
    return listCatalogSetCardsByIds({
      canonicalIds: catalogHomepageFeaturedSetIds.filter(
        (canonicalId) => !excludedSetIds.includes(canonicalId),
      ),
    }).then((setCardsById) => setCardsById.slice(0, limit));
  }

  return selectCatalogSetCardsByIds({
    canonicalIds: catalogHomepageFeaturedSetIds.filter(
      (canonicalId) => !excludedSetIds.includes(canonicalId),
    ),
    setCards,
  }).slice(0, limit);
}

export async function resolveHomepageFollowRailDiagnostics({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  limit = 20,
  rotationSeed,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  limit?: number;
  rotationSeed?: number;
} = {}): Promise<{
  excludedSetIds: readonly string[];
  rawCandidateCount: number;
  selectedCount: number;
  selectedSetIds: readonly string[];
  source: 'dynamic' | 'fallback';
}> {
  const setCards = await listAllCatalogSetCards({
    listCanonicalCatalogSetsFn,
  });
  const dynamicSetCards = rankCatalogPremiumDiscoverySetCards({
    excludedSetIds,
    getCatalogDiscoverySignalFn:
      getCatalogDiscoverySignalFn ?? (() => undefined),
    limit,
    rotationSeed,
    setCards,
  });
  const selectedSetCards = dynamicSetCards.length
    ? dynamicSetCards
    : selectCatalogSetCardsByIds({
        canonicalIds: catalogHomepageFeaturedSetIds.filter(
          (canonicalId) => !excludedSetIds.includes(canonicalId),
        ),
        setCards,
      }).slice(0, limit);

  return {
    excludedSetIds,
    rawCandidateCount: setCards.length,
    selectedCount: selectedSetCards.length,
    selectedSetIds: selectedSetCards
      .map((catalogSetCard) => catalogSetCard.id)
      .slice(0, 20),
    source: dynamicSetCards.length ? 'dynamic' : 'fallback',
  };
}

export async function listHomepageDealCandidateSetCards({
  getCatalogDiscoverySignalFn,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  limit = 3,
  setCards,
}: {
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  limit?: number;
  setCards?: readonly CatalogHomepageSetCard[];
} = {}): Promise<CatalogHomepageSetCard[]> {
  if (!getCatalogDiscoverySignalFn) {
    return setCards
      ? selectCatalogSetCardsByIds({
          canonicalIds: catalogHomepageDealCandidateIds,
          setCards,
        })
      : listCatalogSetCardsByIds({
          canonicalIds: catalogHomepageDealCandidateIds,
          listCanonicalCatalogSetsFn,
        });
  }

  return rankCatalogComparisonDiscoverySetCards({
    getCatalogDiscoverySignalFn,
    limit,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listCatalogSimilarSetCards({
  currentSetCard,
  getCatalogDiscoverySignalFn,
  limit = 20,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  referenceBestPriceMinor,
  signal,
  supabaseClient,
}: {
  currentSetCard: Pick<
    CatalogHomepageSetCard,
    'id' | 'name' | 'pieces' | 'releaseYear' | 'secondaryLabels' | 'theme'
  >;
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  referenceBestPriceMinor?: number;
  signal?: AbortSignal;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogHomepageSetCard[]> {
  const setCards =
    listCanonicalCatalogSetsFn === listCanonicalCatalogSets
      ? await listCatalogSimilarSetCandidateCardsFromSupabase({
          currentSetCard,
          signal,
          supabaseClient,
        })
      : await listAllCatalogSetCards({
          listCanonicalCatalogSetsFn,
          signal,
        });

  throwIfCatalogReadAborted(signal);

  const resolvedCurrentSetCard = currentSetCard.secondaryLabels?.length
    ? currentSetCard
    : {
        ...currentSetCard,
        secondaryLabels: setCards.find(
          (setCard) => setCard.id === currentSetCard.id,
        )?.secondaryLabels,
      };

  return rankCatalogSimilarSetCards({
    currentSetCard: resolvedCurrentSetCard,
    getCatalogDiscoverySignalFn,
    limit,
    referenceBestPriceMinor,
    setCards,
  });
}

export async function listDiscoverDealCandidateSetCards({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return listCatalogSetCardsByIds({
    canonicalIds: catalogDiscoverDealCandidateIds,
    listCanonicalCatalogSetsFn,
  });
}

export async function listDiscoverBestDealSetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  currentOfferSummaryBySetId,
  rotationSeed,
  setCards,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  currentOfferSummaryBySetId?: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  rotationSeed?: number;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogBestDealSetCards({
    excludedSetIds,
    getCatalogDiscoverySignalFn,
    limit,
    currentOfferSummaryBySetId,
    rotationSeed,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverNowInterestingSetCards({
  currentOfferSummaryBySetId,
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  rotationSeed,
  setCards,
}: {
  currentOfferSummaryBySetId?: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  rotationSeed?: number;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogNowInterestingSetCards({
    currentOfferSummaryBySetId,
    excludedSetIds,
    getCatalogDiscoverySignalFn,
    limit,
    rotationSeed,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverRecentPriceChangeSetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  rotationSeed,
  setCards,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  rotationSeed?: number;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogRecentPriceChangeSetCards({
    excludedSetIds,
    getCatalogDiscoverySignalFn,
    limit,
    rotationSeed,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverRecentlyReleasedSetCards({
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  now,
  setCards,
}: {
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogRecentlyReleasedSetCards({
    getCatalogDiscoverySignalFn,
    limit,
    now,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverNewInReleaseYearSetCards({
  currentYear,
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  setCards,
}: {
  currentYear?: number;
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogNewInReleaseYearSetCards({
    currentYear,
    getCatalogDiscoverySignalFn,
    limit,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverNewOnBrickhuntSetCards({
  currentYear,
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  now,
  setCards,
}: {
  currentYear?: number;
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  now?: Date;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogNewOnBrickhuntSetCards({
    currentYear,
    getCatalogDiscoverySignalFn,
    limit,
    now,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverForYouInterestingSetCards({
  excludedSetIds,
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  setCards,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogForYouInterestingSetCards({
    excludedSetIds,
    getCatalogDiscoverySignalFn,
    limit,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverHighlightSetCards({
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  reviewedSetIds,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  reviewedSetIds?: readonly string[];
} = {}): Promise<CatalogHomepageSetCard[]> {
  return sortDiscoverShowcaseSetCards({
    reviewedSetIds,
    setCards: await listAllCatalogSetCards({
      listCanonicalCatalogSetsFn,
    }),
  }).slice(0, limit);
}

export async function listDiscoverCharacterSetCards({
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  reviewedSetIds,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  reviewedSetIds?: readonly string[];
} = {}): Promise<CatalogHomepageSetCard[]> {
  return sortDiscoverShowcaseSetCards({
    reviewedSetIds,
    setCards: (
      await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })
    ).filter((catalogSetCard) => catalogSetCard.minifigureHighlights?.length),
  }).slice(0, limit);
}

export async function listCatalogSearchSuggestionSetCards({
  limit = 24,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  supabaseClient,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return (
    listCanonicalCatalogSetsFn === listCanonicalCatalogSets
      ? await listCatalogSetCardsFromSupabase({
          limit: Math.max(limit, CATALOG_PUBLIC_SEARCH_CANDIDATE_LIMIT),
          orderBy: 'release_year',
          supabaseClient,
        })
      : await listAllCatalogSetCards({
          listCanonicalCatalogSetsFn,
        })
  )
    .sort(
      (left, right) =>
        right.releaseYear - left.releaseYear ||
        left.name.localeCompare(right.name),
    )
    .slice(0, limit);
}

export async function listCatalogSetSlugs({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<string[]> {
  return (await listCanonicalCatalogSetsFn()).map(
    (canonicalCatalogSet) => canonicalCatalogSet.slug,
  );
}

export async function getCatalogSetBySlug({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  slug,
  supabaseClient,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  slug: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSetDetail | undefined> {
  const canonicalCatalogSet =
    listCanonicalCatalogSetsFn === listCanonicalCatalogSets
      ? await getCanonicalCatalogSetBySlug({
          slug,
          supabaseClient,
        })
      : (await listCanonicalCatalogSetsFn()).find(
          (catalogSet) => catalogSet.slug === slug,
        );

  if (!canonicalCatalogSet) {
    return undefined;
  }

  if (listCanonicalCatalogSetsFn !== listCanonicalCatalogSets) {
    return toCatalogSetDetailFromCanonicalSet(canonicalCatalogSet);
  }

  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return toCatalogSetDetailFromCanonicalSet(canonicalCatalogSet);
  }

  const minifigureCount = await getCatalogSetMinifigCountBySetId({
    setId: canonicalCatalogSet.setId,
    supabaseClient: activeSupabaseClient,
  });
  const legoProductMetadata = await getLegoNlProductDescriptionBySetId({
    setId: canonicalCatalogSet.setId,
    supabaseClient: activeSupabaseClient,
  });

  return toCatalogSetDetailFromCanonicalSet({
    ...canonicalCatalogSet,
    ...(legoProductMetadata?.description
      ? {
          legoProductDescription: legoProductMetadata.description,
        }
      : {}),
    ...(legoProductMetadata?.features?.length
      ? {
          legoProductFeatures: legoProductMetadata.features,
        }
      : {}),
    ...(typeof minifigureCount === 'number'
      ? {
          minifigureCount,
        }
      : {}),
  });
}

function getCatalogSearchMatchScore({
  legoNlTitleScore,
  query,
  row,
  setCard,
}: {
  legoNlTitleScore?: number;
  query: string;
  row: CatalogSetRow;
  setCard: CatalogHomepageSetCard;
}): number | undefined {
  if (typeof legoNlTitleScore === 'number') {
    return legoNlTitleScore;
  }

  const [cardMatch] = listCatalogSetCardSearchMatches({
    limit: 1,
    query,
    setCards: [setCard],
  });

  if (cardMatch) {
    return cardMatch.score;
  }

  const normalizedQuery = normalizeCatalogAsciiText(query).toLowerCase().trim();
  const normalizedQueryToken = normalizedQuery.replace(/[^a-z0-9]+/giu, '');
  const normalizedSlug = normalizeCatalogAsciiText(row.slug.replace(/-/gu, ' '))
    .toLowerCase()
    .trim();
  const normalizedSlugToken = normalizedSlug.replace(/[^a-z0-9]+/giu, '');
  const normalizedSourceSetNumber = normalizeCatalogAsciiText(
    row.source_set_number,
  )
    .toLowerCase()
    .trim();
  const normalizedSourceSetNumberToken = normalizedSourceSetNumber.replace(
    /[^a-z0-9]+/giu,
    '',
  );

  if (!normalizedQuery || !normalizedQueryToken) {
    return undefined;
  }

  if (
    normalizedSlug === normalizedQuery ||
    normalizedSlugToken === normalizedQueryToken ||
    normalizedSourceSetNumber === normalizedQuery ||
    normalizedSourceSetNumberToken === normalizedQueryToken
  ) {
    return 0;
  }

  if (
    normalizedSlug.startsWith(normalizedQuery) ||
    normalizedSlugToken.startsWith(normalizedQueryToken) ||
    normalizedSourceSetNumber.startsWith(normalizedQuery) ||
    normalizedSourceSetNumberToken.startsWith(normalizedQueryToken)
  ) {
    return 1;
  }

  if (
    normalizedSlug.includes(normalizedQuery) ||
    normalizedSlugToken.includes(normalizedQueryToken) ||
    normalizedSourceSetNumber.includes(normalizedQuery) ||
    normalizedSourceSetNumberToken.includes(normalizedQueryToken)
  ) {
    return 4;
  }

  return undefined;
}

async function listCatalogSearchMatchesFromSupabase({
  limit,
  query,
  supabaseClient,
}: {
  limit: number;
  query: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSearchMatch[]> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return [];
  }

  const safeCandidateLimit = normalizeCatalogReadLimit(
    Math.max(CATALOG_PUBLIC_SEARCH_CANDIDATE_LIMIT, limit * 24),
    CATALOG_PUBLIC_SEARCH_CANDIDATE_LIMIT,
  );
  const searchPattern = escapeCatalogSupabaseSearchPattern(query);

  try {
    const legoNlTitleMatchesBySetId = await listLegoNlDisplayTitleSearchMatches(
      {
        query,
        supabaseClient: activeSupabaseClient,
      },
    );
    const legoNlTitleMatchSetIds = [...legoNlTitleMatchesBySetId.keys()].sort(
      (left, right) => left.localeCompare(right),
    );
    const { data, error } = await activeSupabaseClient
      .from(CATALOG_SETS_TABLE)
      .select(CATALOG_SET_SELECT_COLUMNS)
      .eq('status', 'active')
      .or(
        [
          `set_id.ilike.%${searchPattern}%`,
          `source_set_number.ilike.%${searchPattern}%`,
          `name.ilike.%${searchPattern}%`,
          `slug.ilike.%${searchPattern}%`,
        ].join(','),
      )
      .order('release_year', { ascending: false })
      .order('name', { ascending: true })
      .order('set_id', { ascending: true })
      .limit(Math.min(CATALOG_PUBLIC_SEARCH_MATCH_LIMIT, safeCandidateLimit));
    const { data: legoNlTitleCatalogData, error: legoNlTitleCatalogError } =
      legoNlTitleMatchSetIds.length > 0
        ? await activeSupabaseClient
            .from(CATALOG_SETS_TABLE)
            .select(CATALOG_SET_SELECT_COLUMNS)
            .eq('status', 'active')
            .in('set_id', legoNlTitleMatchSetIds)
        : { data: [], error: null };

    if (error) {
      throw new Error('Unable to search catalog sets.');
    }

    if (legoNlTitleCatalogError) {
      throw new Error('Unable to search catalog sets by LEGO NL title.');
    }

    const catalogRowsBySetId = new Map<string, CatalogSetRow>();

    for (const row of [
      ...((data as CatalogSetRow[] | null) ?? []),
      ...((legoNlTitleCatalogData as CatalogSetRow[] | null) ?? []),
    ]) {
      catalogRowsBySetId.set(row.set_id, row);
    }

    const catalogRows = [...catalogRowsBySetId.values()];
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      catalogRows,
      supabaseClient: activeSupabaseClient,
    });
    const canonicalCatalogSets = catalogRows.map((row) =>
      toCanonicalCatalogSetFromRow({
        row,
        themeIdentity: themeIdentityBySetId.get(row.set_id),
      }),
    );
    const enrichedCatalogSetBySetId = new Map(
      (
        await enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
          canonicalCatalogSets,
          supabaseClient: activeSupabaseClient,
        })
      ).map((canonicalCatalogSet) => [
        canonicalCatalogSet.setId,
        canonicalCatalogSet,
      ]),
    );

    return catalogRows
      .flatMap((row): CatalogSearchMatch[] => {
        const setCard = toCatalogSetCardFromCanonicalSet(
          enrichedCatalogSetBySetId.get(row.set_id) ??
            toCanonicalCatalogSetFromRow({
              row,
              themeIdentity: themeIdentityBySetId.get(row.set_id),
            }),
        );
        const score = getCatalogSearchMatchScore({
          legoNlTitleScore: legoNlTitleMatchesBySetId.get(row.set_id)?.score,
          query,
          row,
          setCard,
        });

        return typeof score === 'number'
          ? [
              {
                discoverRank: getExplicitBrowseRank(
                  setCard.id,
                  catalogDiscoverSetOrder,
                ),
                score,
                setCard,
              },
            ]
          : [];
      })
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.discoverRank - right.discoverRank ||
          right.setCard.releaseYear - left.setCard.releaseYear ||
          left.setCard.name.localeCompare(right.setCard.name),
      )
      .slice(0, limit);
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function listCatalogSearchMatches({
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  query,
  supabaseClient,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  query: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogSearchMatch[]> {
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizeCatalogAsciiText(query).trim() || suggestionLimit === 0) {
    return [];
  }

  if (listCanonicalCatalogSetsFn === listCanonicalCatalogSets) {
    return listCatalogSearchMatchesFromSupabase({
      limit: suggestionLimit,
      query,
      supabaseClient,
    });
  }

  return listCatalogSetCardSearchMatches({
    limit: Number.MAX_SAFE_INTEGER,
    query,
    setCards: await listAllCatalogSetCards({
      listCanonicalCatalogSetsFn,
    }),
  })
    .map(
      ({ score, setCard }): CatalogSearchMatch => ({
        discoverRank: getExplicitBrowseRank(
          setCard.id,
          catalogDiscoverSetOrder,
        ),
        score,
        setCard,
      }),
    )
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.discoverRank - right.discoverRank ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        left.setCard.name.localeCompare(right.setCard.name),
    )
    .slice(0, suggestionLimit);
}

function getCatalogThemeSearchScore({
  query,
  theme,
}: {
  query: string;
  theme: CatalogThemeDirectoryItem;
}): number | undefined {
  const normalizedQuery = normalizeCatalogAsciiText(query).trim();
  const normalizedQueryToken = normalizedQuery.replace(/[^a-z0-9]+/giu, '');
  const normalizedThemeName = normalizeCatalogAsciiText(
    theme.themeSnapshot.name,
  ).trim();
  const normalizedThemeToken = normalizedThemeName.replace(/[^a-z0-9]+/giu, '');
  const normalizedThemeSlug = normalizeCatalogAsciiText(
    theme.themeSnapshot.slug.replace(/-/gu, ' '),
  ).trim();

  if (!normalizedQuery || !normalizedQueryToken) {
    return undefined;
  }

  if (
    normalizedThemeName === normalizedQuery ||
    normalizedThemeSlug === normalizedQuery ||
    normalizedThemeToken === normalizedQueryToken
  ) {
    return 0;
  }

  if (
    normalizedThemeName.startsWith(normalizedQuery) ||
    normalizedThemeSlug.startsWith(normalizedQuery) ||
    normalizedThemeToken.startsWith(normalizedQueryToken)
  ) {
    return 1;
  }

  if (
    normalizedThemeName.includes(normalizedQuery) ||
    normalizedThemeSlug.includes(normalizedQuery)
  ) {
    return 2;
  }

  return undefined;
}

export async function listCatalogThemeSearchMatches({
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  query,
  supabaseClient,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  query: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogThemeSearchMatch[]> {
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizeCatalogAsciiText(query).trim() || suggestionLimit === 0) {
    return [];
  }

  return (
    await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn,
      supabaseClient,
    })
  )
    .flatMap((theme): CatalogThemeSearchMatch[] => {
      const score = getCatalogThemeSearchScore({ query, theme });

      return typeof score === 'number'
        ? [
            {
              score,
              theme,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.theme.themeSnapshot.setCount -
          left.theme.themeSnapshot.setCount ||
        left.theme.themeSnapshot.name.localeCompare(
          right.theme.themeSnapshot.name,
          'nl',
        ),
    )
    .slice(0, suggestionLimit);
}

export async function listCatalogThemeDirectoryItems({
  allowFullCatalogRead = false,
  limit = CATALOG_PUBLIC_THEME_DIRECTORY_LIMIT,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  offset = 0,
  sortMode = 'directory',
  supabaseClient,
}: {
  allowFullCatalogRead?: boolean;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  offset?: number;
  sortMode?: 'directory' | 'homepage';
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  if (
    listCanonicalCatalogSetsFn === listCanonicalCatalogSets &&
    !allowFullCatalogRead
  ) {
    return listCatalogThemeDirectoryItemsFromSupabase({
      limit,
      offset,
      sortMode,
      supabaseClient,
    });
  }

  const themeGroups = await listCatalogBrowseThemeGroupsInternal({
    allowFullCatalogRead,
    listCanonicalCatalogSetsFn,
    supabaseClient,
  });

  return dedupeCatalogThemeDirectoryItemsBySlug(
    themeGroups
      .map((themeGroup) => {
        const themeSnapshot = createThemeSnapshot({
          setCards: themeGroup.setCards,
          theme: themeGroup.theme,
        });
        const imageUrl = getCatalogThemeRepresentativeImageUrl({
          setCards: themeGroup.setCards,
          themeSnapshot,
        });

        return {
          imageUrl,
          themeSnapshot,
          visual: imageUrl
            ? {
                imageUrl,
              }
            : undefined,
        } satisfies CatalogThemeDirectoryItem;
      })
      .sort(
        (left, right) =>
          left.themeSnapshot.name.localeCompare(
            right.themeSnapshot.name,
            'nl',
          ) || left.themeSnapshot.slug.localeCompare(right.themeSnapshot.slug),
      ),
  );
}

export async function listHomepageThemeDirectoryItems({
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  supabaseClient,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const themeDirectoryItems = await listCatalogThemeDirectoryItems({
    limit: CATALOG_PUBLIC_THEME_DIRECTORY_LIMIT,
    listCanonicalCatalogSetsFn,
    sortMode: 'homepage',
    supabaseClient,
  });

  return themeDirectoryItems.slice(0, limit);
}

export async function listHomepageThemeSpotlightItems({
  limit = 4,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  supabaseClient,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const primaryHomepageThemeNames = new Set(
    (
      await listHomepageThemeDirectoryItems({
        listCanonicalCatalogSetsFn,
        supabaseClient,
      })
    ).map(
      (catalogThemeDirectoryItem) =>
        catalogThemeDirectoryItem.themeSnapshot.name,
    ),
  );

  const themeDirectoryItems = await listCatalogThemeDirectoryItems({
    limit: CATALOG_PUBLIC_THEME_DIRECTORY_LIMIT,
    listCanonicalCatalogSetsFn,
    sortMode: 'homepage',
    supabaseClient,
  });

  return themeDirectoryItems
    .filter(
      (catalogThemeDirectoryItem) =>
        !primaryHomepageThemeNames.has(
          catalogThemeDirectoryItem.themeSnapshot.name,
        ),
    )
    .slice(0, limit);
}

export async function listCatalogThemePageSlugs({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  supabaseClient,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<string[]> {
  if (listCanonicalCatalogSetsFn === listCanonicalCatalogSets) {
    return (
      await listCatalogThemeDirectoryItems({
        supabaseClient,
      })
    ).map(
      (catalogThemeDirectoryItem) =>
        catalogThemeDirectoryItem.themeSnapshot.slug,
    );
  }

  return (
    await listCatalogThemeDirectoryItems({
      allowFullCatalogRead: true,
      listCanonicalCatalogSetsFn,
    })
  ).map(
    (catalogThemeDirectoryItem) => catalogThemeDirectoryItem.themeSnapshot.slug,
  );
}

export async function getCatalogThemePageBySlug({
  limit = CATALOG_PUBLIC_DEFAULT_PAGE_SIZE,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  offset = 0,
  slug,
  supabaseClient,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  offset?: number;
  slug: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogThemeLandingPage | undefined> {
  if (listCanonicalCatalogSetsFn === listCanonicalCatalogSets) {
    const activeSupabaseClient =
      supabaseClient ?? getWebCatalogSupabaseReadClient();

    if (!activeSupabaseClient) {
      return undefined;
    }

    try {
      const { data: themeData, error: themeError } =
        await measureCatalogThemePageQuery({
          label: 'catalog_themes',
          slug,
          load: async () =>
            await activeSupabaseClient
              .from(CATALOG_THEMES_TABLE)
              .select(
                'id, slug, display_name, public_display_name, public_description, public_image_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_logo_url, status, is_public, public_homepage_order, public_order',
              )
              .eq('slug', slug)
              .eq('status', 'active')
              .eq('is_public', true)
              .maybeSingle(),
        });

      if (themeError) {
        throw new Error('Unable to load catalog theme page.');
      }

      const themeRow = themeData as
        | (CatalogThemeRow & { slug?: string; status?: string })
        | null;

      if (!themeRow) {
        return undefined;
      }

      const publicDisplayName =
        normalizeCatalogThemePublicText(themeRow.public_display_name) ??
        themeRow.display_name;
      const publicDescription = normalizeCatalogThemePublicText(
        themeRow.public_description,
      );
      const publicImageUrl = normalizeCatalogThemePublicImageUrl(
        themeRow.public_image_url,
      );
      const publicAccentColor = normalizeCatalogThemePublicAccentColor(
        themeRow.public_accent_color,
      );
      const publicSurfaceColor = normalizeCatalogThemePublicAccentColor(
        themeRow.public_surface_color,
      );
      const publicSurfaceTextColor = normalizeCatalogThemePublicTextColor(
        themeRow.public_surface_text_color,
      );
      const publicHeroTextColor = normalizeCatalogThemePublicTextColor(
        themeRow.public_hero_text_color,
      );
      const safeLimit = normalizeCatalogReadLimit(
        limit,
        CATALOG_PUBLIC_DEFAULT_PAGE_SIZE,
      );
      const safeOffset = normalizeCatalogReadOffset(offset);
      const themeSummariesByThemeId = await measureCatalogThemePageQuery({
        label: 'catalog_theme_summaries',
        slug,
        load: () =>
          listCatalogThemeSummariesByThemeId({
            supabaseClient: activeSupabaseClient,
            themeIds: [themeRow.id],
          }),
      });
      const themeSummary = themeSummariesByThemeId.get(themeRow.id);
      const setQuery = activeSupabaseClient
        .from(CATALOG_SETS_TABLE)
        .select(
          CATALOG_SET_SELECT_COLUMNS,
          themeSummary ? undefined : { count: 'exact' },
        )
        .eq('status', 'active')
        .eq('primary_theme_id', themeRow.id)
        .order('release_year', { ascending: false })
        .order('name', { ascending: true })
        .order('set_id', { ascending: true })
        .range(safeOffset, safeOffset + safeLimit - 1);
      const {
        count: fallbackSetCount,
        data: setData,
        error: setError,
      } = await measureCatalogThemePageQuery({
        label: 'catalog_sets',
        slug,
        load: async () => await setQuery,
      });

      if (setError) {
        throw new Error('Unable to load catalog theme page.');
      }

      const catalogRows = (setData as CatalogSetRow[] | null) ?? [];
      const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
        catalogRows,
        supabaseClient: activeSupabaseClient,
      });
      const canonicalCatalogSets = catalogRows.map((row) =>
        toCanonicalCatalogSetFromRow({
          row,
          themeIdentity:
            themeIdentityBySetId.get(row.set_id) ??
            resolveCatalogThemeIdentityFromPersistence({
              primaryThemeName: publicDisplayName,
              sourceThemeName: undefined,
            }),
        }),
      );
      const enrichedCatalogSets =
        await enrichCanonicalCatalogSetsWithLegoNlDisplayTitles({
          canonicalCatalogSets,
          supabaseClient: activeSupabaseClient,
        });
      const setCards = enrichedCatalogSets.map(
        toCatalogSetCardFromCanonicalSet,
      );
      const themeSnapshot = {
        ...createPublicCatalogThemeSnapshot({
          setCards,
          setCount:
            themeSummary?.active_set_count ??
            fallbackSetCount ??
            catalogRows.length,
          slug: themeRow.slug ?? buildCatalogThemeSlug(publicDisplayName),
          theme: publicDisplayName,
        }),
        ...(publicDescription
          ? {
              momentum: publicDescription,
            }
          : {}),
      };
      const visualImageUrl =
        publicImageUrl ??
        normalizeCatalogThemePublicImageUrl(
          themeSummary?.representative_image_url,
        ) ??
        getCatalogThemeRepresentativeImageUrl({
          setCards,
          themeSnapshot,
        });

      return {
        setCards,
        themeSnapshot,
        visual: createPublicCatalogThemeVisual({
          imageUrl: visualImageUrl,
          publicAccentColor,
          publicHeroTextColor,
          publicSurfaceColor,
          publicSurfaceTextColor,
        }),
      };
    } catch (error) {
      if (!supabaseClient) {
        return undefined;
      }

      throw error;
    }
  }

  const themeGroups = await listCatalogBrowseThemeGroupsInternal({
    listCanonicalCatalogSetsFn,
  });
  const themeGroup = themeGroups.find(
    (catalogThemeGroup) => catalogThemeGroup.slug === slug,
  );

  if (!themeGroup) {
    return undefined;
  }

  return {
    themeSnapshot: createThemeSnapshot({
      setCards: themeGroup.setCards,
      theme: themeGroup.theme,
    }),
    setCards: themeGroup.setCards,
  };
}

export async function getCatalogThemeMetadataBySlug({
  slug,
  supabaseClient,
}: {
  slug: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogThemeSnapshot | undefined> {
  const activeSupabaseClient =
    supabaseClient ?? getWebCatalogSupabaseReadClient();

  if (!activeSupabaseClient) {
    return undefined;
  }

  try {
    const { data, error } = await measureCatalogThemePageQuery({
      label: 'catalog_theme_metadata',
      slug,
      load: async () =>
        await activeSupabaseClient
          .from(CATALOG_THEMES_TABLE)
          .select(
            'id, slug, display_name, public_display_name, public_description, status, is_public',
          )
          .eq('slug', slug)
          .eq('status', 'active')
          .eq('is_public', true)
          .maybeSingle(),
    });

    if (error) {
      throw new Error('Unable to load catalog theme metadata.');
    }

    const themeRow = data as Pick<
      CatalogThemeRow,
      | 'display_name'
      | 'id'
      | 'is_public'
      | 'public_description'
      | 'public_display_name'
      | 'slug'
      | 'status'
    > | null;

    if (!themeRow) {
      return undefined;
    }

    const publicDisplayName =
      normalizeCatalogThemePublicText(themeRow.public_display_name) ??
      themeRow.display_name;
    const publicDescription = normalizeCatalogThemePublicText(
      themeRow.public_description,
    );

    return {
      name: publicDisplayName,
      momentum: genericCatalogThemeMomentum,
      ...(publicDescription
        ? {
            momentum: publicDescription,
          }
        : {}),
      setCount: 0,
      signatureSet: publicDisplayName,
      slug: themeRow.slug ?? buildCatalogThemeSlug(publicDisplayName),
    };
  } catch (error) {
    if (!supabaseClient) {
      return undefined;
    }

    throw error;
  }
}

export async function listDiscoverBrowseThemeGroups({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  reviewedSetIds,
  setLimit = 6,
  themeLimit = 6,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  reviewedSetIds?: readonly string[];
  setLimit?: number;
  themeLimit?: number;
} = {}): Promise<CatalogBrowseThemeGroup[]> {
  return (
    await listCatalogBrowseThemeGroupsInternal({
      listCanonicalCatalogSetsFn,
    })
  )
    .map((catalogThemeGroup) => ({
      ...catalogThemeGroup,
      setCards: sortDiscoverThemeSetCards({
        reviewedSetIds,
        setCards: catalogThemeGroup.setCards,
      }).slice(0, setLimit),
      totalSetCount: catalogThemeGroup.setCards.length,
    }))
    .slice(0, themeLimit);
}
