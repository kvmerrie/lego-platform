import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import type {
  CatalogCanonicalSet,
  CatalogBrowseThemeGroup,
  CatalogHomepageSetCard,
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
  catalogDiscoverDealCandidateIds,
  catalogDiscoverSetOrder,
  catalogDiscoverThemeOrder,
  catalogHomepageDealCandidateIds,
  catalogHomepageFeaturedSetIds,
  catalogThemeOverlays,
  getCanonicalCatalogSetId,
  getCatalogReleaseYear,
  getCatalogThemeDisplayName,
  getCatalogThemeVisual,
  getThemeTileImage,
  isCatalogBrowsablePrimaryTheme,
  listCatalogSetCardSearchMatches,
  normalizeTheme,
  normalizeCatalogAsciiText,
  resolveCatalogReleaseDatePrecision,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
  sortCanonicalCatalogSets,
  sortCatalogSetSummaries,
  sortThemesForHome,
} from '@lego-platform/catalog/util';
import {
  buildCatalogCurrentOfferSummariesApiPath,
  buildCatalogDiscoverySignalsApiPath,
  buildCatalogSetLiveOffersApiPath,
  cacheTags,
  getBrowserSupabaseConfig,
  getMissingBrowserSupabaseEnvKeys,
  getMissingServerSupabaseEnvKeys,
  getServerSupabaseConfig,
  getServerSupabaseUrlSource,
  getRuntimeBaseUrl,
  hasBrowserSupabaseConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

const CATALOG_SETS_TABLE = 'catalog_sets';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const CATALOG_THEME_SUMMARIES_TABLE = 'catalog_theme_summaries';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
const CATALOG_CURRENT_OFFER_CANDIDATE_LIMIT = 300;
const CATALOG_PUBLIC_DEFAULT_PAGE_SIZE = 96;
const CATALOG_PUBLIC_RAIL_CANDIDATE_LIMIT = 240;
const CATALOG_PUBLIC_SEARCH_CANDIDATE_LIMIT = 120;
const CATALOG_PUBLIC_SEARCH_MATCH_LIMIT = 500;
const CATALOG_PUBLIC_THEME_DIRECTORY_LIMIT = 100;
const CATALOG_THEME_REPRESENTATIVE_SET_LIMIT = 8;
const CATALOG_SET_SELECT_COLUMNS =
  'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, release_date, release_date_precision, piece_count, image_url, source, status, created_at, updated_at';
const PRIMARY_CATALOG_MERCHANT_SLUGS = [
  'lego-nl',
  'intertoys',
  'bol',
  'misterbricks',
] as const;
const genericCatalogThemeMomentum =
  'Nieuw in Brickhunt. We bouwen hier nu de eerste prijsvergelijkingen op.';

type CatalogSupabaseClient = Pick<SupabaseClient, 'from'>;

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

interface CatalogSourceThemeRow {
  id: string;
  source_theme_name: string;
}

interface CatalogThemeRow {
  display_name: string;
  id: string;
  is_public?: boolean;
  public_accent_color?: string | null;
  public_description?: string | null;
  public_display_name?: string | null;
  public_image_url?: string | null;
  public_logo_url?: string | null;
  public_order?: number | null;
  slug?: string;
  status?: string;
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
  product_url: string;
  set_id: string;
  validation_status: string;
}

export interface CatalogResolvedOffer {
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  checkedAt: string;
  condition: 'new';
  currency: 'EUR';
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
    merchantName,
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
  const bestOffer =
    normalizeCatalogResolvedOfferRecord(
      value['bestOffer'] ?? value['best_offer'] ?? value['currentOffer'],
      setId,
    ) ?? offers[0];

  return {
    ...(bestOffer ? { bestOffer } : {}),
    offers: offers.length ? offers : bestOffer ? [bestOffer] : [],
    setId,
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

function toCatalogSummaryFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetSummary {
  const displayTheme =
    getCatalogThemeDisplayName(canonicalCatalogSet.primaryTheme, {
      name: canonicalCatalogSet.name,
      secondaryLabels: canonicalCatalogSet.secondaryLabels,
      setId: canonicalCatalogSet.setId,
      slug: canonicalCatalogSet.slug,
      sourceSetNumber: canonicalCatalogSet.sourceSetNumber,
      theme: canonicalCatalogSet.primaryTheme,
    }) ?? canonicalCatalogSet.primaryTheme;

  return {
    createdAt: canonicalCatalogSet.createdAt,
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
  const displayTheme =
    getCatalogThemeDisplayName(canonicalCatalogSet.primaryTheme, {
      name: canonicalCatalogSet.name,
      secondaryLabels: canonicalCatalogSet.secondaryLabels,
      setId: canonicalCatalogSet.setId,
      slug: canonicalCatalogSet.slug,
      sourceSetNumber: canonicalCatalogSet.sourceSetNumber,
      theme: canonicalCatalogSet.primaryTheme,
    }) ?? canonicalCatalogSet.primaryTheme;

  return {
    createdAt: canonicalCatalogSet.createdAt,
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
    ...(canonicalCatalogSet.secondaryLabels[0]
      ? {
          subtheme: canonicalCatalogSet.secondaryLabels[0],
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
    const [sourceThemeResponse, themeMappingResponse] = await Promise.all([
      sourceThemeIds.length
        ? supabaseClient
            .from(CATALOG_SOURCE_THEMES_TABLE)
            .select('id, source_theme_name')
            .in('id', sourceThemeIds)
        : Promise.resolve({ data: [], error: null }),
      sourceThemeIds.length
        ? supabaseClient
            .from(CATALOG_THEME_MAPPINGS_TABLE)
            .select('source_theme_id, primary_theme_id')
            .in('source_theme_id', sourceThemeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (sourceThemeResponse.error || themeMappingResponse.error) {
      return new Map();
    }

    const sourceThemes =
      (sourceThemeResponse.data as CatalogSourceThemeRow[]) ?? [];
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
            'id, slug, display_name, public_display_name, status, is_public',
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
        const mappedPrimaryThemeId = catalogRow.source_theme_id
          ? primaryThemeIdBySourceThemeId.get(catalogRow.source_theme_id)
          : undefined;
        const candidatePrimaryThemeIds = [
          mappedPrimaryThemeId,
          catalogRow.primary_theme_id,
        ].filter((themeId): themeId is string => Boolean(themeId));
        const publicPrimaryTheme = candidatePrimaryThemeIds
          .map((themeId) => primaryThemeById.get(themeId))
          .find(
            (catalogTheme): catalogTheme is CatalogThemeRow =>
              Boolean(catalogTheme) &&
              catalogTheme.is_public === true &&
              catalogTheme.status === 'active' &&
              Boolean(catalogTheme.slug),
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

        return [
          catalogRow.set_id,
          {
            ...(publicPrimaryTheme?.slug && publicThemeName
              ? {
                  primaryTheme: publicThemeName,
                  publicTheme: {
                    name: publicThemeName,
                    slug: publicPrimaryTheme.slug,
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

  if (merchantSlug === 'lego') {
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

function sortResolvedCatalogOffers<Offer extends CatalogResolvedOffer>(
  catalogOffers: readonly Offer[],
): Offer[] {
  return [...catalogOffers].sort(
    (left, right) =>
      getCatalogOfferAvailabilityRank(left.availability) -
        getCatalogOfferAvailabilityRank(right.availability) ||
      left.priceCents - right.priceCents ||
      left.merchantName.localeCompare(right.merchantName),
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
    latestOffer.observed_at ?? latestOffer.updated_at ?? undefined;

  if (!checkedAt) {
    return undefined;
  }

  return {
    availability: normalizeRuntimeOfferAvailability(latestOffer.availability),
    checkedAt,
    condition: 'new',
    currency: 'EUR',
    market: 'NL',
    merchant: getCatalogOfferMerchantFromMerchantSlug(merchant.slug),
    merchantName: merchant.name,
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
    .map((latestOffer) => latestOffer.observed_at ?? latestOffer.updated_at)
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
    return sortResolvedCatalogOffers(generatedOffers);
  }

  const generatedOfferByMerchantKey = new Map(
    generatedOffers.map((catalogOffer) => [
      getOfferLookupKey({
        merchantName: catalogOffer.merchantName,
      }),
      catalogOffer,
    ]),
  );

  return sortResolvedCatalogOffers(
    liveOffers.map((liveOffer) => {
      const matchingGeneratedOffer = generatedOfferByMerchantKey.get(
        getOfferLookupKey({
          merchantName: liveOffer.merchantName,
          merchantSlug: liveOffer.merchantSlug,
        }),
      );

      if (!matchingGeneratedOffer) {
        return liveOffer;
      }

      return {
        ...liveOffer,
        condition: matchingGeneratedOffer.condition,
        market: matchingGeneratedOffer.market,
        merchant: matchingGeneratedOffer.merchant,
        merchantName: matchingGeneratedOffer.merchantName,
        url: matchingGeneratedOffer.url,
      } satisfies CatalogResolvedOffer;
    }),
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
    bestOffer: offers[0],
    offers,
    setId,
  };
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

    return sortCanonicalCatalogSets(
      catalogRows.map((row) =>
        toCanonicalCatalogSetFromRow({
          row,
          themeIdentity: themeIdentityBySetId.get(row.set_id),
        }),
      ),
    );
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

    return toCanonicalCatalogSetFromRow({
      row,
      themeIdentity: themeIdentityBySetId.get(row.set_id),
    });
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
    createdAt: catalogSetDetail.createdAt,
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
  supabaseClient,
}: {
  ascending?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'name' | 'release_year' | 'updated_at';
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
    const { data, error } = await activeSupabaseClient
      .from(CATALOG_SETS_TABLE)
      .select(CATALOG_SET_SELECT_COLUMNS)
      .eq('status', 'active')
      .order(orderBy, { ascending })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) {
      throw new Error('Unable to load catalog set cards.');
    }

    const catalogRows = (data as CatalogSetRow[] | null) ?? [];
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      catalogRows,
      supabaseClient: activeSupabaseClient,
    });

    return catalogRows.map((row) =>
      toCatalogSetCardFromCanonicalSet(
        toCanonicalCatalogSetFromRow({
          row,
          themeIdentity: themeIdentityBySetId.get(row.set_id),
        }),
      ),
    );
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
  supabaseClient,
}: {
  allowFullCatalogRead?: boolean;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  limit?: number;
  offset?: number;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogHomepageSetCard[]> {
  if (
    listCanonicalCatalogSetsFn === listCanonicalCatalogSets &&
    !allowFullCatalogRead
  ) {
    return listCatalogSetCardsFromSupabase({
      limit,
      offset,
      supabaseClient,
    });
  }

  return (await listCanonicalCatalogSetsFn()).map(
    toCatalogSetCardFromCanonicalSet,
  );
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
  const hasMeaningfulSpread = catalogDiscoverySignal.priceSpreadMinor >= 1500;

  return hasRecentPriceDrop || isBelowReference || hasMeaningfulSpread;
}

function isCatalogBestDealCandidate(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): boolean {
  const hasReferenceDiscount =
    typeof catalogDiscoverySignal.referenceDeltaMinor === 'number' &&
    catalogDiscoverySignal.referenceDeltaMinor < 0;
  const hasRecentPriceDrop =
    typeof catalogDiscoverySignal.recentReferencePriceChangeMinor ===
      'number' &&
    catalogDiscoverySignal.recentReferencePriceChangeMinor < 0 &&
    getCatalogSignalAgeHours(
      catalogDiscoverySignal.recentReferencePriceChangedAt,
    ) <= 48;

  return hasReferenceDiscount || hasRecentPriceDrop;
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
  rotationSeed,
  setCards,
}: {
  catalogDiscoverySignalBySetId: ReadonlyMap<string, CatalogDiscoverySignal>;
  currentOfferSummaryBySetId: ReadonlyMap<string, CatalogCurrentOfferSummary>;
  excludedSetIds?: readonly string[];
  limit?: number;
  rotationSeed?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const excludedSetIdSet = new Set(excludedSetIds);

  return [...setCards]
    .filter(
      (setCard) =>
        !excludedSetIdSet.has(setCard.id) &&
        hasCatalogCurrentPartnerOffer(
          currentOfferSummaryBySetId.get(setCard.id),
        ),
    )
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
        catalogDiscoverySignal.merchantCount < 1 ||
        !isCatalogBestDealCandidate(catalogDiscoverySignal)
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
        !isCatalogInterestingNowCandidate(catalogDiscoverySignal)
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
  const themeSlug = buildCatalogThemeSlug(theme);
  const curatedThemeOrderIndex = catalogDiscoverThemeOrder.findIndex(
    (catalogDiscoverTheme) =>
      buildCatalogThemeSlug(catalogDiscoverTheme) === themeSlug,
  );

  if (curatedThemeOrderIndex !== -1) {
    return curatedThemeOrderIndex;
  }

  const fallbackThemeOrder = catalogThemeOverlays.map(
    (catalogThemeOverlay) => catalogThemeOverlay.name,
  );
  const fallbackThemeOrderIndex = fallbackThemeOrder.findIndex(
    (fallbackThemeName) =>
      buildCatalogThemeSlug(fallbackThemeName) === themeSlug,
  );

  return fallbackThemeOrderIndex === -1
    ? Number.MAX_SAFE_INTEGER
    : fallbackThemeOrderIndex + catalogDiscoverThemeOrder.length;
}

function getCatalogThemeRepresentativeImageUrl({
  setCards,
  themeSnapshot,
}: {
  setCards: readonly CatalogHomepageSetCard[];
  themeSnapshot: CatalogThemeSnapshot;
}): string | undefined {
  const tileImageSetId = getThemeTileImage(themeSnapshot.name);
  const tileImageSetCard = tileImageSetId
    ? setCards.find((catalogSetCard) => catalogSetCard.id === tileImageSetId)
    : undefined;

  if (tileImageSetCard?.imageUrl) {
    return tileImageSetCard.imageUrl;
  }

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
  const catalogThemeOverlay = catalogThemeOverlays.find(
    (themeOverlay) =>
      themeOverlay.name === theme ||
      themeOverlay.name === displayThemeName ||
      buildCatalogThemeSlug(themeOverlay.name) === themeSlug,
  );

  return {
    name: displayThemeName,
    slug: themeSlug,
    setCount: setCards.length,
    momentum: catalogThemeOverlay?.momentum ?? genericCatalogThemeMomentum,
    signatureSet:
      catalogThemeOverlay?.signatureSet ??
      setCards[0]?.name ??
      displayThemeName,
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
  const displayThemeName = normalizeTheme(theme)?.displayName ?? theme;
  const themeSnapshot = createThemeSnapshot({
    setCards,
    theme: displayThemeName,
  });

  return {
    ...themeSnapshot,
    name: displayThemeName,
    setCount,
    signatureSet:
      themeSnapshot.signatureSet === themeSnapshot.name
        ? displayThemeName
        : themeSnapshot.signatureSet,
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

function createPublicCatalogThemeVisual({
  imageUrl,
  publicAccentColor,
  themeName,
}: {
  imageUrl?: string;
  publicAccentColor?: string;
  themeName: string;
}): CatalogThemeVisual | undefined {
  const themeVisual = getCatalogThemeVisual(themeName);
  const visual = {
    ...(themeVisual ?? {}),
    ...(publicAccentColor
      ? {
          backgroundColor: publicAccentColor,
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
  supabaseClient,
}: {
  limit?: number;
  offset?: number;
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
    const { data: themeData, error: themeError } = await activeSupabaseClient
      .from(CATALOG_THEMES_TABLE)
      .select(
        'id, slug, display_name, public_display_name, public_description, public_image_url, public_accent_color, public_logo_url, status, is_public, public_order',
      )
      .eq('status', 'active')
      .eq('is_public', true)
      .order('public_order', { ascending: true })
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

          const setCards = catalogRows.map((row) =>
            toCatalogSetCardFromCanonicalSet(
              toCanonicalCatalogSetFromRow({
                row,
                themeIdentity: resolveCatalogThemeIdentityFromPersistence({
                  primaryThemeName: publicDisplayName,
                  sourceThemeName: undefined,
                }),
              }),
            ),
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
            themeName: themeSnapshot.name,
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
          const leftPublicOrder =
            typeof leftThemeRow?.public_order === 'number'
              ? leftThemeRow.public_order
              : Number.MAX_SAFE_INTEGER;
          const rightPublicOrder =
            typeof rightThemeRow?.public_order === 'number'
              ? rightThemeRow.public_order
              : Number.MAX_SAFE_INTEGER;

          return (
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
      const setCards = catalogRows.map((row) =>
        toCatalogSetCardFromCanonicalSet(
          toCanonicalCatalogSetFromRow({
            row,
            themeIdentity: themeIdentityBySetId.get(row.set_id),
          }),
        ),
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
  supabaseClient,
}: {
  setIds: readonly string[];
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

  const { data: seedData, error: seedError } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status',
    )
    .in('set_id', setIdLookupVariants)
    .eq('is_active', true)
    .eq('validation_status', 'valid');

  if (seedError) {
    throw new Error('Unable to load live catalog offers.');
  }

  const offerSeeds = (seedData as CatalogCommerceOfferSeedRow[] | null) ?? [];

  if (!offerSeeds.length) {
    return liveOffersBySetId;
  }

  const merchantIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
  ];
  const offerSeedIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.id)),
  ];
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
    throw new Error('Unable to load live catalog offers.');
  }

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
        'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, updated_at',
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
      'id, set_id, merchant_id, product_url, is_active, validation_status',
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

  const merchantIds = [
    ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
  ];
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

    const canonicalSetId = getCanonicalCatalogSetId(offerSeed.set_id);
    const existingOffers = liveOffersBySetId.get(canonicalSetId) ?? [];
    existingOffers.push(catalogRuntimeOffer);
    liveOffersBySetId.set(canonicalSetId, existingOffers);
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
          'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, updated_at',
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
          'id, set_id, merchant_id, product_url, is_active, validation_status',
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
              'id, set_id, merchant_id, product_url, is_active, validation_status',
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

export async function listCatalogDiscoverySignalsBySetId({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  setIds,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  setIds?: readonly string[];
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
    const response = await (fetchImpl ?? fetch)(
      `${apiBaseUrl ?? getCatalogApiBaseUrl()}${buildCatalogDiscoverySignalsApiPath(scopedSetIds)}`,
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
                tags: [cacheTags.prices()],
              },
            }),
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load catalog discovery signals.');
    }

    const payload = await response.json();

    if (!Array.isArray(payload)) {
      return new Map();
    }

    return new Map(
      payload.flatMap((catalogDiscoverySignalRecord) => {
        if (!isCatalogDiscoverySignalRecord(catalogDiscoverySignalRecord)) {
          return [];
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

        return [
          [
            setId,
            {
              bestPriceMinor,
              merchantCount,
              nextBestPriceMinor,
              observedAt,
              priceSpreadMinor,
              recentReferencePriceChangeMinor,
              recentReferencePriceChangedAt,
              referenceDeltaMinor,
            } satisfies CatalogDiscoverySignal,
          ],
        ];
      }),
    );
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
      'id, set_id, merchant_id, product_url, is_active, validation_status',
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
        'offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, updated_at',
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

export async function listCatalogCurrentOfferSummariesBySetIds({
  apiBaseUrl,
  cacheOptions,
  fetchImpl,
  setIds,
  supabaseClient,
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
  setIds: readonly string[];
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
    if (!supabaseClient) {
      const response = await (fetchImpl ?? fetch)(
        `${apiBaseUrl ?? getCatalogApiBaseUrl()}${buildCatalogCurrentOfferSummariesApiPath(uniqueSetIds)}`,
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
                  tags: [
                    cacheTags.prices(),
                    ...uniqueSetIds.map((setId) => cacheTags.set(setId)),
                  ],
                },
              }),
        },
      );

      if (!response.ok) {
        throw new Error('Unable to load current catalog offer summaries.');
      }

      const payload = await response.json();
      const summaryBySetId = new Map(
        (Array.isArray(payload) ? payload : []).flatMap((summaryRecord) => {
          const normalizedSummary =
            normalizeCatalogCurrentOfferSummaryRecord(summaryRecord);

          if (!normalizedSummary || normalizedSummary.offers.length === 0) {
            return [];
          }

          return [[normalizedSummary.setId, normalizedSummary] as const];
        }),
      );

      if (summaryBySetId.size > 0 || !hasServerSupabaseConfig()) {
        return summaryBySetId;
      }

      try {
        const liveOffersBySetId =
          await listCatalogRuntimeOffersBySetIdsFromSupabase({
            setIds: uniqueSetIds,
            supabaseClient: getWebCatalogSupabaseAdminClient(),
          });

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
      } catch {
        return summaryBySetId;
      }
    }

    const liveOffersBySetId =
      await listCatalogRuntimeOffersBySetIdsFromSupabase({
        setIds: uniqueSetIds,
        supabaseClient,
      });

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
  } catch (error) {
    if (!supabaseClient && hasServerSupabaseConfig()) {
      try {
        const liveOffersBySetId =
          await listCatalogRuntimeOffersBySetIdsFromSupabase({
            setIds: uniqueSetIds,
            supabaseClient: getWebCatalogSupabaseAdminClient(),
          });

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
      } catch {
        return new Map();
      }
    }

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
}): Promise<CatalogHomepageSetCard[]> {
  const setCards = await listAllCatalogSetCards({
    listCanonicalCatalogSetsFn,
  });
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
  return rankCatalogBestDealSetCards({
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

export async function listDiscoverNowInterestingSetCards({
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
  return rankCatalogNowInterestingSetCards({
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

  return toCatalogSetDetailFromCanonicalSet(canonicalCatalogSet);
}

function getCatalogSearchMatchScore({
  query,
  row,
  setCard,
}: {
  query: string;
  row: CatalogSetRow;
  setCard: CatalogHomepageSetCard;
}): number | undefined {
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

    if (error) {
      throw new Error('Unable to search catalog sets.');
    }

    const catalogRows = (data as CatalogSetRow[] | null) ?? [];
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      catalogRows,
      supabaseClient: activeSupabaseClient,
    });

    return catalogRows
      .flatMap((row): CatalogSearchMatch[] => {
        const setCard = toCatalogSetCardFromCanonicalSet(
          toCanonicalCatalogSetFromRow({
            row,
            themeIdentity: themeIdentityBySetId.get(row.set_id),
          }),
        );
        const score = getCatalogSearchMatchScore({
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
  supabaseClient,
}: {
  allowFullCatalogRead?: boolean;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  offset?: number;
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  if (
    listCanonicalCatalogSetsFn === listCanonicalCatalogSets &&
    !allowFullCatalogRead
  ) {
    return listCatalogThemeDirectoryItemsFromSupabase({
      limit,
      offset,
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
        const themeVisual = getCatalogThemeVisual(themeSnapshot.name);

        return {
          imageUrl,
          themeSnapshot,
          visual: themeVisual
            ? {
                ...themeVisual,
                imageUrl: themeVisual.imageUrl ?? imageUrl,
              }
            : imageUrl
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
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  return sortThemesForHome(
    await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn,
    }),
  ).slice(0, limit);
}

export async function listHomepageThemeSpotlightItems({
  limit = 4,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const primaryHomepageThemeNames = new Set(
    (
      await listHomepageThemeDirectoryItems({
        listCanonicalCatalogSetsFn,
      })
    ).map(
      (catalogThemeDirectoryItem) =>
        catalogThemeDirectoryItem.themeSnapshot.name,
    ),
  );

  return sortThemesForHome(
    await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn,
    }),
  )
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
      const { data: themeData, error: themeError } = await activeSupabaseClient
        .from(CATALOG_THEMES_TABLE)
        .select(
          'id, slug, display_name, public_display_name, public_description, public_image_url, public_accent_color, public_logo_url, status, is_public, public_order',
        )
        .eq('slug', slug)
        .eq('status', 'active')
        .eq('is_public', true)
        .maybeSingle();

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
      const safeLimit = normalizeCatalogReadLimit(
        limit,
        CATALOG_PUBLIC_DEFAULT_PAGE_SIZE,
      );
      const safeOffset = normalizeCatalogReadOffset(offset);
      const themeSummariesByThemeId = await listCatalogThemeSummariesByThemeId({
        supabaseClient: activeSupabaseClient,
        themeIds: [themeRow.id],
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
      } = await setQuery;

      if (setError) {
        throw new Error('Unable to load catalog theme page.');
      }

      const catalogRows = (setData as CatalogSetRow[] | null) ?? [];
      const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
        catalogRows,
        supabaseClient: activeSupabaseClient,
      });
      const setCards = catalogRows.map((row) =>
        toCatalogSetCardFromCanonicalSet(
          toCanonicalCatalogSetFromRow({
            row,
            themeIdentity:
              themeIdentityBySetId.get(row.set_id) ??
              resolveCatalogThemeIdentityFromPersistence({
                primaryThemeName: publicDisplayName,
                sourceThemeName: undefined,
              }),
          }),
        ),
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
          themeName: themeSnapshot.name,
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
    const { data, error } = await activeSupabaseClient
      .from(CATALOG_THEMES_TABLE)
      .select(
        'id, slug, display_name, public_display_name, public_description, status, is_public',
      )
      .eq('slug', slug)
      .eq('status', 'active')
      .eq('is_public', true)
      .maybeSingle();

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
      ...createThemeSnapshot({
        setCards: [],
        theme: publicDisplayName,
      }),
      ...(publicDescription
        ? {
            momentum: publicDescription,
          }
        : {}),
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
