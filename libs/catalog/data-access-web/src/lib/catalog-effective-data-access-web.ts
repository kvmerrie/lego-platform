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
  listCatalogSetCardSearchMatches,
  normalizeCatalogAsciiText,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
  sortCanonicalCatalogSets,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import {
  buildCatalogSetLiveOffersApiPath,
  getServerSupabaseConfig,
  getRuntimeBaseUrl,
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

export interface CatalogPrimaryOfferAvailabilityState {
  latestPrimaryOfferCheckedAt?: string;
  primaryMerchantCount: number;
  primarySeedCount: number;
  validPrimaryOfferCount: number;
}

let webCatalogSupabaseAdminClient: SupabaseClient | undefined;

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

function getCatalogApiBaseUrl(): string {
  return process.env['API_PROXY_TARGET'] ?? getRuntimeBaseUrl('api');
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
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    const activeSupabaseClient =
      supabaseClient ?? getWebCatalogSupabaseAdminClient();
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

export async function listCatalogSetLiveOffersBySetId({
  apiBaseUrl,
  fetchImpl,
  setId,
  supabaseClient,
}: {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogRuntimeOffer[]> {
  try {
    if (!supabaseClient) {
      const response = await (fetchImpl ?? fetch)(
        `${apiBaseUrl ?? getCatalogApiBaseUrl()}${buildCatalogSetLiveOffersApiPath(setId)}`,
        {
          cache: 'no-store',
          headers: {
            accept: 'application/json',
          },
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
    const { data: seedData, error: seedError } = await activeSupabaseClient
      .from(COMMERCE_OFFER_SEEDS_TABLE)
      .select(
        'id, set_id, merchant_id, product_url, is_active, validation_status',
      )
      .eq('set_id', setId)
      .eq('is_active', true)
      .eq('validation_status', 'valid');

    if (seedError) {
      throw new Error('Unable to load live catalog offers.');
    }

    const offerSeeds = (seedData as CatalogCommerceOfferSeedRow[] | null) ?? [];

    if (!offerSeeds.length) {
      return [];
    }

    const merchantIds = [
      ...new Set(offerSeeds.map((offerSeed) => offerSeed.merchant_id)),
    ];
    const offerSeedIds = offerSeeds.map((offerSeed) => offerSeed.id);
    const [
      { data: merchantData, error: merchantError },
      { data: latestOfferData, error: latestOfferError },
    ] = await Promise.all([
      activeSupabaseClient
        .from(COMMERCE_MERCHANTS_TABLE)
        .select('id, slug, name, is_active')
        .in('id', merchantIds)
        .eq('is_active', true),
      activeSupabaseClient
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
    const latestOfferBySeedId = new Map<
      string,
      CatalogCommerceOfferLatestRow
    >();

    for (const latestOfferRow of (latestOfferData as
      | CatalogCommerceOfferLatestRow[]
      | null) ?? []) {
      if (!latestOfferBySeedId.has(latestOfferRow.offer_seed_id)) {
        latestOfferBySeedId.set(latestOfferRow.offer_seed_id, latestOfferRow);
      }
    }

    return sortResolvedCatalogOffers(
      offerSeeds.flatMap((offerSeed) => {
        const merchant = merchantById.get(offerSeed.merchant_id);
        const latestOffer = latestOfferBySeedId.get(offerSeed.id);

        if (!merchant || !latestOffer) {
          return [];
        }

        const catalogRuntimeOffer = toCatalogRuntimeOffer({
          latestOffer,
          merchant,
          offerSeed,
        });

        return catalogRuntimeOffer ? [catalogRuntimeOffer] : [];
      }),
    ) as CatalogRuntimeOffer[];
  } catch (error) {
    if (!supabaseClient && hasServerSupabaseConfig()) {
      return listCatalogSetLiveOffersBySetId({
        setId,
        supabaseClient: getWebCatalogSupabaseAdminClient(),
      });
    }

    if (!supabaseClient) {
      return [];
    }

    throw error;
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
  fetchImpl,
  setId,
  supabaseClient,
}: {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  setId: string;
  supabaseClient?: CatalogSupabaseClient;
}): Promise<CatalogCurrentOfferSummary> {
  const liveOffers = await listCatalogSetLiveOffersBySetId({
    apiBaseUrl,
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
  fetchImpl,
  setIds,
  supabaseClient,
}: {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  setIds: readonly string[];
  supabaseClient?: CatalogSupabaseClient;
}): Promise<Map<string, CatalogCurrentOfferSummary>> {
  const uniqueSetIds = [...new Set(setIds)];
  const summaries = await Promise.all(
    uniqueSetIds.map((setId) =>
      getCatalogCurrentOfferSummaryBySetId({
        apiBaseUrl,
        fetchImpl,
        setId,
        supabaseClient,
      }),
    ),
  );

  return new Map(
    summaries.map((catalogCurrentOfferSummary) => [
      catalogCurrentOfferSummary.setId,
      catalogCurrentOfferSummary,
    ]),
  );
}

export async function listHomepageSetCards({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return listCatalogSetCardsByIds({
    canonicalIds: catalogHomepageFeaturedSetIds,
    listCanonicalCatalogSetsFn,
  });
}

export async function listHomepageDealCandidateSetCards({
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
}: {
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  return listCatalogSetCardsByIds({
    canonicalIds: catalogHomepageDealCandidateIds,
    listCanonicalCatalogSetsFn,
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

  return themeGroups.map((themeGroup) => {
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
  });
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
