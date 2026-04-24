import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CatalogCanonicalSet,
  CatalogBrowseThemeGroup,
  CatalogHomepageSetCard,
  CatalogSearchMatch,
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeDirectoryItem,
  CatalogThemeLandingPage,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import {
  buildCatalogThemeSlug,
  catalogDiscoverDealCandidateIds,
  catalogDiscoverSetOrder,
  catalogDiscoverThemeOrder,
  catalogHomepageDealCandidateIds,
  catalogHomepageFeaturedSetIds,
  catalogThemeOverlays,
  getCatalogThemeDisplayName,
  getCatalogThemeVisual,
  isCatalogBrowsablePrimaryTheme,
  listCatalogSetCardSearchMatches,
  normalizeCatalogAsciiText,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
  sortCanonicalCatalogSets,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import {
  buildCatalogCurrentOfferSummariesApiPath,
  buildCatalogDiscoverySignalsApiPath,
  buildCatalogSetLiveOffersApiPath,
  getBrowserSupabaseConfig,
  getServerSupabaseConfig,
  getRuntimeBaseUrl,
  hasBrowserSupabaseConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

const CATALOG_SETS_TABLE = 'catalog_sets';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
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
}

interface CatalogThemeMappingRow {
  primary_theme_id: string;
  source_theme_id: string;
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

function isCatalogCurrentOfferSummaryRecord(
  value: unknown,
): value is CatalogCurrentOfferSummaryRecord {
  return (
    isObjectRecord(value) &&
    typeof value['setId'] === 'string' &&
    Array.isArray(value['offers']) &&
    value['offers'].every(isCatalogResolvedOfferRecord) &&
    (typeof value['bestOffer'] === 'undefined' ||
      isCatalogResolvedOfferRecord(value['bestOffer']))
  );
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
    getCatalogThemeDisplayName(canonicalCatalogSet.primaryTheme) ??
    canonicalCatalogSet.primaryTheme;

  return {
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: displayTheme,
    ...(canonicalCatalogSet.secondaryLabels.length
      ? {
          secondaryLabels: canonicalCatalogSet.secondaryLabels,
        }
      : {}),
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
  };
}

function toCatalogSetDetailFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetDetail {
  const displayTheme =
    getCatalogThemeDisplayName(canonicalCatalogSet.primaryTheme) ??
    canonicalCatalogSet.primaryTheme;

  return {
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: displayTheme,
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
          .select('id, display_name')
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
        const primaryThemeId =
          catalogRow.primary_theme_id ??
          (catalogRow.source_theme_id
            ? primaryThemeIdBySourceThemeId.get(catalogRow.source_theme_id)
            : undefined);
        const primaryThemeName = primaryThemeId
          ? primaryThemeById.get(primaryThemeId)?.display_name
          : undefined;

        return [
          catalogRow.set_id,
          resolveCatalogThemeIdentityFromPersistence({
            primaryThemeName,
            sourceThemeName,
          }),
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
    setId: offerSeed.set_id,
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
        'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, piece_count, image_url, source, status, created_at, updated_at',
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

export async function getCanonicalCatalogSetById({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  setId,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  setId: string;
}): Promise<CatalogCanonicalSet | undefined> {
  const canonicalCatalogSets = await listCanonicalCatalogSetsFn();

  return canonicalCatalogSets.find(
    (canonicalCatalogSet) => canonicalCatalogSet.setId === setId,
  );
}

export async function getCanonicalCatalogSetBySlug({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  slug,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  slug: string;
}): Promise<CatalogCanonicalSet | undefined> {
  const canonicalCatalogSets = await listCanonicalCatalogSetsFn();

  return canonicalCatalogSets.find(
    (canonicalCatalogSet) => canonicalCatalogSet.slug === slug,
  );
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
    id: catalogSetDetail.id,
    slug: catalogSetDetail.slug,
    name: catalogSetDetail.name,
    theme: catalogSetDetail.theme,
    ...(canonicalCatalogSet.secondaryLabels.length
      ? {
          secondaryLabels: canonicalCatalogSet.secondaryLabels,
        }
      : {}),
    releaseYear: catalogSetDetail.releaseYear,
    pieces: catalogSetDetail.pieces,
    imageUrl: catalogSetDetail.imageUrl,
    images: catalogSetDetail.images,
    primaryImage: catalogSetDetail.primaryImage,
  };
}

async function listAllCatalogSetCards({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return (await listCanonicalCatalogSetsFn()).map(
    toCatalogSetCardFromCanonicalSet,
  );
}

export async function listCatalogSetCards({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return listAllCatalogSetCards({
    listCanonicalCatalogSetsFn,
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

function getCatalogPremiumDiscoveryScore(
  catalogDiscoverySignal: CatalogDiscoverySignal,
): number {
  const priceLevelScore = Math.min(
    catalogDiscoverySignal.bestPriceMinor / 1500,
    80,
  );
  const coverageScore = Math.min(catalogDiscoverySignal.merchantCount, 6) * 14;
  const spreadScore = Math.min(
    catalogDiscoverySignal.priceSpreadMinor / 125,
    70,
  );
  const freshnessScore =
    getCatalogDiscoveryFreshnessScore(catalogDiscoverySignal.observedAt) * 0.6;

  return priceLevelScore + coverageScore + spreadScore + freshnessScore;
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
    typeof catalogDiscoverySignal.recentReferencePriceChangedAt !== 'string'
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
  const hasRecentChange =
    typeof catalogDiscoverySignal.recentReferencePriceChangeMinor ===
      'number' &&
    catalogDiscoverySignal.recentReferencePriceChangeMinor !== 0 &&
    getCatalogSignalAgeHours(
      catalogDiscoverySignal.recentReferencePriceChangedAt,
    ) <= 48;
  const hasMeaningfulSpread = catalogDiscoverySignal.priceSpreadMinor >= 1500;
  const hasBroadCoverage = catalogDiscoverySignal.merchantCount >= 3;

  return hasRecentChange || hasMeaningfulSpread || hasBroadCoverage;
}

function getCatalogRecentlyReleasedScore({
  catalogDiscoverySignal,
  currentYear,
  setCard,
}: {
  catalogDiscoverySignal?: CatalogDiscoverySignal;
  currentYear: number;
  setCard: CatalogHomepageSetCard;
}): number {
  const releaseYearGap = currentYear - setCard.releaseYear;

  if (releaseYearGap < 0 || releaseYearGap > 1) {
    return 0;
  }

  const releaseFreshnessScore = releaseYearGap === 0 ? 72 : 40;
  const comparisonReadinessScore = getCatalogSimilarSetComparisonReadinessScore(
    catalogDiscoverySignal,
  );
  const coverageScore =
    Math.min(catalogDiscoverySignal?.merchantCount ?? 0, 6) * 3;

  return releaseFreshnessScore + comparisonReadinessScore + coverageScore;
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
  scoreCatalogDiscoverySignal,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
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

      if (
        !catalogDiscoverySignal ||
        catalogDiscoverySignal.merchantCount < 2 ||
        catalogDiscoverySignal.bestPriceMinor < 15000
      ) {
        return undefined;
      }

      return catalogDiscoverySignal;
    },
    scoreCatalogDiscoverySignal: getCatalogPremiumDiscoveryScore,
    setCards,
  }).slice(0, limit);
}

export function rankCatalogRecentPriceChangeSetCards({
  getCatalogDiscoverySignalFn,
  limit = 6,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return [...setCards]
    .flatMap((setCard) => {
      const catalogDiscoverySignal = getCatalogDiscoverySignalFn(setCard.id);

      if (
        !catalogDiscoverySignal ||
        catalogDiscoverySignal.merchantCount < 2 ||
        typeof catalogDiscoverySignal.recentReferencePriceChangeMinor !==
          'number' ||
        catalogDiscoverySignal.recentReferencePriceChangeMinor === 0 ||
        typeof catalogDiscoverySignal.recentReferencePriceChangedAt !== 'string'
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
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        Date.parse(
          right.catalogDiscoverySignal.recentReferencePriceChangedAt ?? '',
        ) -
          Date.parse(
            left.catalogDiscoverySignal.recentReferencePriceChangedAt ?? '',
          ) ||
        Math.abs(
          right.catalogDiscoverySignal.recentReferencePriceChangeMinor ?? 0,
        ) -
          Math.abs(
            left.catalogDiscoverySignal.recentReferencePriceChangeMinor ?? 0,
          ) ||
        right.catalogDiscoverySignal.merchantCount -
          left.catalogDiscoverySignal.merchantCount ||
        right.catalogDiscoverySignal.priceSpreadMinor -
          left.catalogDiscoverySignal.priceSpreadMinor ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogNowInterestingSetCards({
  getCatalogDiscoverySignalFn,
  limit = 6,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  setCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  return [...setCards]
    .flatMap((setCard) => {
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
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        Date.parse(
          right.catalogDiscoverySignal.recentReferencePriceChangedAt ??
            right.catalogDiscoverySignal.observedAt,
        ) -
          Date.parse(
            left.catalogDiscoverySignal.recentReferencePriceChangedAt ??
              left.catalogDiscoverySignal.observedAt,
          ) ||
        right.catalogDiscoverySignal.priceSpreadMinor -
          left.catalogDiscoverySignal.priceSpreadMinor ||
        right.catalogDiscoverySignal.merchantCount -
          left.catalogDiscoverySignal.merchantCount ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        right.setCard.pieces - left.setCard.pieces ||
        left.setCard.name.localeCompare(right.setCard.name) ||
        left.setCard.id.localeCompare(right.setCard.id),
    )
    .slice(0, limit)
    .map((catalogDiscoveryCandidate) => catalogDiscoveryCandidate.setCard);
}

export function rankCatalogRecentlyReleasedSetCards({
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
        })
      ) {
        return [];
      }

      const score = getCatalogRecentlyReleasedScore({
        catalogDiscoverySignal,
        currentYear,
        setCard,
      });

      if (score <= 0) {
        return [];
      }

      return [
        {
          comparisonReadinessScore:
            getCatalogSimilarSetComparisonReadinessScore(
              catalogDiscoverySignal,
            ),
          merchantCount: catalogDiscoverySignal?.merchantCount ?? 0,
          score,
          setCard,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
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
  limit = 6,
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

  return [...setCards]
    .flatMap((setCard) => {
      if (
        setCard.id === currentSetCard.id ||
        setCard.theme !== currentSetCard.theme
      ) {
        return [];
      }

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
  const curatedThemeOrderIndex = catalogDiscoverThemeOrder.indexOf(
    theme as (typeof catalogDiscoverThemeOrder)[number],
  );

  if (curatedThemeOrderIndex !== -1) {
    return curatedThemeOrderIndex;
  }

  const fallbackThemeOrder = catalogThemeOverlays.map(
    (catalogThemeOverlay) => catalogThemeOverlay.name,
  );
  const fallbackThemeOrderIndex = fallbackThemeOrder.indexOf(theme);

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
  const catalogThemeOverlay = catalogThemeOverlays.find(
    (themeOverlay) => themeOverlay.name === theme,
  );

  return {
    name: theme,
    slug: buildCatalogThemeSlug(theme),
    setCount: setCards.length,
    momentum: catalogThemeOverlay?.momentum ?? genericCatalogThemeMomentum,
    signatureSet:
      catalogThemeOverlay?.signatureSet ?? setCards[0]?.name ?? theme,
  };
}

async function listCatalogBrowseThemeGroupsInternal({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogBrowseThemeGroup[]> {
  const setCards = await listAllCatalogSetCards({
    listCanonicalCatalogSetsFn,
  });
  const setCardsByTheme = new Map<string, CatalogHomepageSetCard[]>();

  for (const setCard of setCards) {
    const existingSetCards = setCardsByTheme.get(setCard.theme) ?? [];
    existingSetCards.push(setCard);
    setCardsByTheme.set(setCard.theme, existingSetCards);
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

export async function listCatalogSetCardsByIds({
  canonicalIds = [],
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  canonicalIds?: readonly string[];
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogHomepageSetCard[]> {
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
  const uniqueSetIds = [...new Set(setIds)].filter((setId) => setId.length > 0);
  const liveOffersBySetId = new Map(
    uniqueSetIds.map((setId) => [setId, [] as CatalogRuntimeOffer[]]),
  );

  if (!uniqueSetIds.length) {
    return liveOffersBySetId;
  }

  const { data: seedData, error: seedError } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status',
    )
    .in('set_id', uniqueSetIds)
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

    const existingOffers = liveOffersBySetId.get(offerSeed.set_id);

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
                },
              }
            : {
                cache: 'no-store' as const,
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
}: {
  apiBaseUrl?: string;
  cacheOptions?: CatalogApiReadCacheOptions;
  fetchImpl?: typeof fetch;
} = {}): Promise<Map<string, CatalogDiscoverySignal>> {
  try {
    const response = await (fetchImpl ?? fetch)(
      `${apiBaseUrl ?? getCatalogApiBaseUrl()}${buildCatalogDiscoverySignalsApiPath()}`,
      {
        headers: {
          accept: 'application/json',
        },
        ...(typeof cacheOptions?.revalidateSeconds === 'number'
          ? {
              next: {
                revalidate: cacheOptions.revalidateSeconds,
              },
            }
          : {
              cache: 'no-store' as const,
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
    .eq('set_id', setId)
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
  const uniqueSetIds = [...new Set(setIds)].filter((setId) => setId.length > 0);

  if (!uniqueSetIds.length) {
    return new Map();
  }

  const createEmptySummary = (
    setId: string,
  ): CatalogCurrentOfferSummaryRecord => ({
    offers: [],
    setId,
  });

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
                },
              }
            : {
                cache: 'no-store' as const,
              }),
        },
      );

      if (!response.ok) {
        throw new Error('Unable to load current catalog offer summaries.');
      }

      const payload = await response.json();
      const summaryBySetId = new Map(
        (Array.isArray(payload) ? payload : []).flatMap((summaryRecord) => {
          if (!isCatalogCurrentOfferSummaryRecord(summaryRecord)) {
            return [];
          }

          return [[summaryRecord.setId, summaryRecord] as const];
        }),
      );

      return new Map(
        uniqueSetIds.map((setId) => [
          setId,
          summaryBySetId.get(setId) ?? createEmptySummary(setId),
        ]),
      );
    }

    const liveOffersBySetId =
      await listCatalogRuntimeOffersBySetIdsFromSupabase({
        setIds: uniqueSetIds,
        supabaseClient,
      });

    return new Map(
      uniqueSetIds.map((setId) => {
        const offers = liveOffersBySetId.get(setId) ?? [];

        return [
          setId,
          summarizeCatalogCurrentOffers({
            generatedOffers: [],
            liveOffers: offers,
            setId,
          }),
        ] as const;
      }),
    );
  } catch (error) {
    if (!supabaseClient && hasServerSupabaseConfig()) {
      const liveOffersBySetId =
        await listCatalogRuntimeOffersBySetIdsFromSupabase({
          setIds: uniqueSetIds,
          supabaseClient: getWebCatalogSupabaseAdminClient(),
        });

      return new Map(
        uniqueSetIds.map((setId) => {
          const offers = liveOffersBySetId.get(setId) ?? [];

          return [
            setId,
            summarizeCatalogCurrentOffers({
              generatedOffers: [],
              liveOffers: offers,
              setId,
            }),
          ] as const;
        }),
      );
    }

    if (!supabaseClient) {
      return new Map(
        uniqueSetIds.map((setId) => [setId, createEmptySummary(setId)]),
      );
    }

    throw error;
  }
}

export async function listHomepageSetCards({
  excludedSetIds = [],
  getCatalogDiscoverySignalFn,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  limit = 6,
}: {
  excludedSetIds?: readonly string[];
  getCatalogDiscoverySignalFn?: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  limit?: number;
} = {}): Promise<CatalogHomepageSetCard[]> {
  if (!getCatalogDiscoverySignalFn) {
    return listCatalogSetCardsByIds({
      canonicalIds: catalogHomepageFeaturedSetIds.filter(
        (canonicalId) => !excludedSetIds.includes(canonicalId),
      ),
      listCanonicalCatalogSetsFn,
    });
  }

  return rankCatalogPremiumDiscoverySetCards({
    excludedSetIds,
    getCatalogDiscoverySignalFn,
    limit,
    setCards: await listAllCatalogSetCards({
      listCanonicalCatalogSetsFn,
    }),
  });
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
  limit = 6,
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
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return listHomepageDealCandidateSetCards({
    getCatalogDiscoverySignalFn,
    limit,
    listCanonicalCatalogSetsFn,
    setCards,
  });
}

export async function listDiscoverNowInterestingSetCards({
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogNowInterestingSetCards({
    getCatalogDiscoverySignalFn,
    limit,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverRecentPriceChangeSetCards({
  getCatalogDiscoverySignalFn,
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  setCards,
}: {
  getCatalogDiscoverySignalFn: (
    setId: string,
  ) => CatalogDiscoverySignal | undefined;
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  setCards?: readonly CatalogHomepageSetCard[];
}): Promise<CatalogHomepageSetCard[]> {
  return rankCatalogRecentPriceChangeSetCards({
    getCatalogDiscoverySignalFn,
    limit,
    setCards:
      setCards ??
      (await listAllCatalogSetCards({
        listCanonicalCatalogSetsFn,
      })),
  });
}

export async function listDiscoverRecentlyReleasedSetCards({
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
  return rankCatalogRecentlyReleasedSetCards({
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
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return (
    await listAllCatalogSetCards({
      listCanonicalCatalogSetsFn,
    })
  ).sort(
    (left, right) =>
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
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
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  slug: string;
}): Promise<CatalogSetDetail | undefined> {
  const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
    listCanonicalCatalogSetsFn,
    slug,
  });

  if (!canonicalCatalogSet) {
    return undefined;
  }

  return toCatalogSetDetailFromCanonicalSet(canonicalCatalogSet);
}

export async function listCatalogSearchMatches({
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  query,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  query: string;
}): Promise<CatalogSearchMatch[]> {
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizeCatalogAsciiText(query).trim() || suggestionLimit === 0) {
    return [];
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

export async function listCatalogThemeDirectoryItems({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const themeGroups = await listCatalogBrowseThemeGroupsInternal({
    listCanonicalCatalogSetsFn,
  });

  return themeGroups
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
        left.themeSnapshot.name.localeCompare(right.themeSnapshot.name, 'nl') ||
        left.themeSnapshot.slug.localeCompare(right.themeSnapshot.slug),
    );
}

export async function listHomepageThemeDirectoryItems({
  limit = 6,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  limit?: number;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  return (
    await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn,
    })
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

  return (
    await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn,
    })
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
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<string[]> {
  return (
    await listCatalogThemeDirectoryItems({
      listCanonicalCatalogSetsFn,
    })
  ).map(
    (catalogThemeDirectoryItem) => catalogThemeDirectoryItem.themeSnapshot.slug,
  );
}

export async function getCatalogThemePageBySlug({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  slug,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  slug: string;
}): Promise<CatalogThemeLandingPage | undefined> {
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
