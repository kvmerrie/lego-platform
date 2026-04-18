import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type CatalogBrowseThemeGroup,
  type CatalogSearchMatch,
  type CatalogThemeDirectoryItem,
  type CatalogThemeLandingPage,
  catalogSnapshot,
  getCatalogOffersBySetId,
  getCatalogSetBySlug,
  getCatalogThemePageBySlug,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  listCatalogSearchMatches,
  listCatalogThemeDirectoryItems,
  listDiscoverBrowseThemeGroups,
} from '@lego-platform/catalog/data-access';
import type {
  CatalogCanonicalSet,
  CatalogHomepageSetCard,
  CatalogOverlaySet,
  CatalogSetDetail,
  CatalogSetRecord,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import {
  buildCatalogThemeSlug,
  getCatalogPrimaryTheme,
  getCatalogThemeVisual,
  listCatalogSetCardSearchMatches,
  mergeCanonicalCatalogSets,
  normalizeCatalogAsciiText,
  resolveCatalogThemeIdentity,
  sortCanonicalCatalogSets,
} from '@lego-platform/catalog/util';
import {
  buildCatalogSetLiveOffersApiPath,
  getServerSupabaseConfig,
  getRuntimeBaseUrl,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

const CATALOG_SETS_OVERLAY_TABLE = 'catalog_sets_overlay';
const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
const genericOverlayThemeMomentum =
  'Nieuw in Brickhunt. We bouwen hier nu de eerste prijsvergelijkingen op.';

type CatalogSupabaseClient = Pick<SupabaseClient, 'from'>;

interface CatalogOverlaySetRow {
  created_at: string;
  image_url: string | null;
  name: string;
  piece_count: number;
  release_year: number;
  set_id: string;
  slug: string;
  source: 'rebrickable';
  source_set_number: string;
  status: 'active';
  theme: string;
  updated_at: string;
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

function toCatalogOverlaySet(row: CatalogOverlaySetRow): CatalogOverlaySet {
  return {
    createdAt: row.created_at,
    imageUrl: row.image_url ?? undefined,
    name: row.name,
    pieces: row.piece_count,
    releaseYear: row.release_year,
    setId: row.set_id,
    slug: row.slug,
    source: row.source,
    sourceSetNumber: row.source_set_number,
    status: row.status,
    theme: getCatalogPrimaryTheme({
      rawTheme: row.theme,
    }),
    updatedAt: row.updated_at,
  };
}

function toCanonicalCatalogSetFromSnapshotRecord(
  catalogSetRecord: CatalogSetRecord,
): CatalogCanonicalSet {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: catalogSetRecord.theme,
  });

  return {
    createdAt: catalogSnapshot.generatedAt,
    imageUrl: catalogSetRecord.imageUrl,
    name: catalogSetRecord.name,
    pieceCount: catalogSetRecord.pieces,
    primaryTheme: themeIdentity.primaryTheme,
    releaseYear: catalogSetRecord.releaseYear,
    secondaryLabels: themeIdentity.secondaryThemes,
    setId: catalogSetRecord.canonicalId,
    slug: catalogSetRecord.slug,
    source: 'snapshot',
    sourceSetNumber: catalogSetRecord.sourceSetNumber,
    status: 'active',
    updatedAt: catalogSnapshot.generatedAt,
  };
}

function toCanonicalCatalogSetFromOverlaySet(
  overlaySet: CatalogOverlaySet,
): CatalogCanonicalSet {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: overlaySet.theme,
  });

  return {
    createdAt: overlaySet.createdAt,
    imageUrl: overlaySet.imageUrl,
    name: overlaySet.name,
    pieceCount: overlaySet.pieces,
    primaryTheme: themeIdentity.primaryTheme,
    releaseYear: overlaySet.releaseYear,
    secondaryLabels: themeIdentity.secondaryThemes,
    setId: overlaySet.setId,
    slug: overlaySet.slug,
    source: overlaySet.source,
    sourceSetNumber: overlaySet.sourceSetNumber,
    status: overlaySet.status,
    updatedAt: overlaySet.updatedAt,
  };
}

function toCatalogSetDetailFromCanonicalSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetDetail {
  return {
    id: canonicalCatalogSet.setId,
    slug: canonicalCatalogSet.slug,
    name: canonicalCatalogSet.name,
    theme: canonicalCatalogSet.primaryTheme,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
    collectorAngle: `Nieuw in Brickhunt. ${canonicalCatalogSet.name} staat klaar voor de eerste prijscheck.`,
    tagline: `We bouwen nu de eerste prijsvergelijking op voor deze ${canonicalCatalogSet.primaryTheme}-set.`,
    availability: 'Brickhunt bouwt nu de eerste prijschecks op.',
    collectorHighlights: [
      `${canonicalCatalogSet.pieceCount.toLocaleString('nl-NL')} stenen`,
      `Release ${canonicalCatalogSet.releaseYear}`,
    ],
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

const snapshotCanonicalCatalogSets = sortCanonicalCatalogSets(
  catalogSnapshot.setRecords.map(toCanonicalCatalogSetFromSnapshotRecord),
);

export async function listCatalogOverlaySets({
  supabaseClient,
}: {
  supabaseClient?: CatalogSupabaseClient;
} = {}): Promise<CatalogOverlaySet[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return [];
  }

  try {
    const { data, error } = await (
      supabaseClient ?? getWebCatalogSupabaseAdminClient()
    )
      .from(CATALOG_SETS_OVERLAY_TABLE)
      .select(
        'set_id, source_set_number, slug, name, theme, release_year, piece_count, image_url, source, status, created_at, updated_at',
      )
      .eq('status', 'active')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new Error('Unable to load catalog overlay sets.');
    }

    return ((data as CatalogOverlaySetRow[] | null) ?? []).map(
      toCatalogOverlaySet,
    );
  } catch (error) {
    if (!supabaseClient) {
      return [];
    }

    throw error;
  }
}

export async function listCanonicalCatalogSets({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<CatalogCanonicalSet[]> {
  const canonicalOverlaySets = (await listCatalogOverlaySetsFn()).map(
    toCanonicalCatalogSetFromOverlaySet,
  );

  return sortCanonicalCatalogSets(
    mergeCanonicalCatalogSets({
      fallbackSets: snapshotCanonicalCatalogSets,
      preferredSets: canonicalOverlaySets,
    }),
  );
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
  const [generatedOffers, liveOffers] = await Promise.all([
    Promise.resolve(getCatalogOffersBySetId(setId)),
    listCatalogSetLiveOffersBySetId({
      apiBaseUrl,
      fetchImpl,
      setId,
      supabaseClient,
    }),
  ]);

  return summarizeCatalogCurrentOffers({
    generatedOffers,
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

function toOverlayCatalogSetDetail(
  overlaySet: Awaited<ReturnType<typeof listCatalogOverlaySets>>[number],
): CatalogSetDetail {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: overlaySet.theme,
  });

  return {
    id: overlaySet.setId,
    slug: overlaySet.slug,
    name: overlaySet.name,
    theme: themeIdentity.primaryTheme,
    releaseYear: overlaySet.releaseYear,
    pieces: overlaySet.pieces,
    imageUrl: overlaySet.imageUrl,
    collectorAngle: `Nieuw in Brickhunt. ${overlaySet.name} staat klaar voor de eerste prijscheck.`,
    tagline: `We bouwen nu de eerste prijsvergelijking op voor deze ${themeIdentity.primaryTheme}-set.`,
    availability: 'Brickhunt bouwt nu de eerste prijschecks op.',
    collectorHighlights: [
      `${overlaySet.pieces.toLocaleString('nl-NL')} stenen`,
      `Release ${overlaySet.releaseYear}`,
    ],
    ...(themeIdentity.secondaryThemes[0]
      ? {
          subtheme: themeIdentity.secondaryThemes[0],
        }
      : {}),
    images: overlaySet.imageUrl
      ? [
          {
            order: 0,
            type: 'hero',
            url: overlaySet.imageUrl,
          },
        ]
      : undefined,
    primaryImage: overlaySet.imageUrl,
  };
}

function toCatalogHomepageSetCard(
  catalogSetDetail: CatalogSetDetail,
): CatalogHomepageSetCard {
  return {
    id: catalogSetDetail.id,
    slug: catalogSetDetail.slug,
    name: catalogSetDetail.name,
    theme: catalogSetDetail.theme,
    releaseYear: catalogSetDetail.releaseYear,
    pieces: catalogSetDetail.pieces,
    collectorAngle: catalogSetDetail.collectorAngle,
    imageUrl: catalogSetDetail.imageUrl,
    images: catalogSetDetail.images,
    primaryImage: catalogSetDetail.primaryImage,
    tagline: catalogSetDetail.tagline,
    availability: catalogSetDetail.availability,
    minifigureCount: catalogSetDetail.minifigureCount,
    minifigureHighlights: catalogSetDetail.minifigureHighlights,
  };
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

function sortDiscoverThemeSetCards({
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
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
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

function createFallbackThemeSnapshot({
  setCards,
  theme,
}: {
  setCards: readonly CatalogHomepageSetCard[];
  theme: string;
}): CatalogThemeSnapshot {
  return {
    name: theme,
    slug: buildCatalogThemeSlug(theme),
    setCount: setCards.length,
    momentum: genericOverlayThemeMomentum,
    signatureSet: setCards[0]?.name ?? theme,
  };
}

function mergeThemeSetCards({
  overlaySetCards,
  snapshotSetCards,
}: {
  overlaySetCards: readonly CatalogHomepageSetCard[];
  snapshotSetCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const overlaySetIds = new Set(overlaySetCards.map((setCard) => setCard.id));

  return [
    ...overlaySetCards,
    ...snapshotSetCards.filter((setCard) => !overlaySetIds.has(setCard.id)),
  ];
}

async function listOverlayCatalogSetCards({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  const overlaySetDetails = (await listCatalogOverlaySetsFn())
    .filter((overlaySet) => overlaySet.status === 'active')
    .map(toOverlayCatalogSetDetail);

  return overlaySetDetails.map(toCatalogHomepageSetCard);
}

export async function listCatalogSearchSuggestionOverlaySetCards({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<CatalogHomepageSetCard[]> {
  const overlaySetCards = await listOverlayCatalogSetCards({
    listCatalogOverlaySetsFn,
  });
  const dedupedSetCardsById = new Map<string, CatalogHomepageSetCard>();

  for (const overlaySetCard of overlaySetCards) {
    if (!dedupedSetCardsById.has(overlaySetCard.id)) {
      dedupedSetCardsById.set(overlaySetCard.id, overlaySetCard);
    }
  }

  return [...dedupedSetCardsById.values()].sort(
    (left, right) =>
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
}

export async function listCatalogSetSlugsWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<string[]> {
  return (await listCanonicalCatalogSets({ listCatalogOverlaySetsFn })).map(
    (canonicalCatalogSet) => canonicalCatalogSet.slug,
  );
}

export async function getCatalogSetBySlugWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
  slug,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
  slug: string;
}): Promise<CatalogSetDetail | undefined> {
  const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
    listCanonicalCatalogSetsFn: async () =>
      listCanonicalCatalogSets({
        listCatalogOverlaySetsFn,
      }),
    slug,
  });

  if (!canonicalCatalogSet) {
    return undefined;
  }

  if (canonicalCatalogSet.source === 'snapshot') {
    return getCatalogSetBySlug(slug);
  }

  return toCatalogSetDetailFromCanonicalSet(canonicalCatalogSet);
}

export async function listCatalogSearchMatchesWithOverlay({
  limit = 6,
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
  query,
}: {
  limit?: number;
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
  query: string;
}): Promise<CatalogSearchMatch[]> {
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizeCatalogAsciiText(query).trim() || suggestionLimit === 0) {
    return [];
  }

  const snapshotMatches = listCatalogSearchMatches(
    query,
    Number.MAX_SAFE_INTEGER,
  );
  const existingSetIds = new Set(
    snapshotMatches.map((catalogSearchMatch) => catalogSearchMatch.setCard.id),
  );
  const overlayMatches = listCatalogSetCardSearchMatches({
    limit: Number.MAX_SAFE_INTEGER,
    query,
    setCards: (
      await listOverlayCatalogSetCards({
        listCatalogOverlaySetsFn,
      })
    ).filter((setCard) => !existingSetIds.has(setCard.id)),
  }).map(
    ({ score, setCard }): CatalogSearchMatch => ({
      discoverRank: Number.MAX_SAFE_INTEGER,
      score,
      setCard,
    }),
  );

  return [...snapshotMatches, ...overlayMatches]
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.discoverRank - right.discoverRank ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        left.setCard.name.localeCompare(right.setCard.name),
    )
    .slice(0, suggestionLimit);
}

export async function listCatalogThemeDirectoryItemsWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const snapshotItems = listCatalogThemeDirectoryItems();
  const snapshotItemByTheme = new Map(
    snapshotItems.map((catalogThemeDirectoryItem) => [
      catalogThemeDirectoryItem.themeSnapshot.name,
      catalogThemeDirectoryItem,
    ]),
  );
  const overlaySetCards = await listOverlayCatalogSetCards({
    listCatalogOverlaySetsFn,
  });
  const overlayCardsByTheme = new Map<string, CatalogHomepageSetCard[]>();

  for (const overlaySetCard of overlaySetCards) {
    const existingSetCards =
      overlayCardsByTheme.get(overlaySetCard.theme) ?? [];
    existingSetCards.push(overlaySetCard);
    overlayCardsByTheme.set(overlaySetCard.theme, existingSetCards);
  }

  const mergedSnapshotItems = snapshotItems.map((snapshotItem) => {
    const overlayCards = overlayCardsByTheme.get(
      snapshotItem.themeSnapshot.name,
    );

    if (!overlayCards?.length) {
      return snapshotItem;
    }

    const themeSnapshot = {
      ...snapshotItem.themeSnapshot,
      setCount: snapshotItem.themeSnapshot.setCount + overlayCards.length,
    };
    const imageUrl =
      snapshotItem.imageUrl ??
      overlayCards.find((setCard) => setCard.imageUrl)?.imageUrl;

    return {
      imageUrl,
      themeSnapshot,
      visual: getCatalogThemeVisual(themeSnapshot.name)
        ? {
            ...getCatalogThemeVisual(themeSnapshot.name),
            imageUrl:
              getCatalogThemeVisual(themeSnapshot.name)?.imageUrl ?? imageUrl,
          }
        : imageUrl
          ? {
              imageUrl,
            }
          : undefined,
    } satisfies CatalogThemeDirectoryItem;
  });

  const overlayOnlyItems = [...overlayCardsByTheme.entries()]
    .filter(([theme]) => !snapshotItemByTheme.has(theme))
    .sort(([leftTheme], [rightTheme]) => leftTheme.localeCompare(rightTheme))
    .map(([theme, setCards]) => {
      const themeSnapshot = createFallbackThemeSnapshot({
        setCards,
        theme,
      });
      const imageUrl = getCatalogThemeRepresentativeImageUrl({
        setCards,
        themeSnapshot,
      });

      return {
        imageUrl,
        themeSnapshot,
        visual: getCatalogThemeVisual(themeSnapshot.name)
          ? {
              ...getCatalogThemeVisual(themeSnapshot.name),
              imageUrl:
                getCatalogThemeVisual(themeSnapshot.name)?.imageUrl ?? imageUrl,
            }
          : imageUrl
            ? {
                imageUrl,
              }
            : undefined,
      } satisfies CatalogThemeDirectoryItem;
    });

  return [...mergedSnapshotItems, ...overlayOnlyItems];
}

export async function listHomepageThemeDirectoryItemsWithOverlay({
  limit = 6,
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  limit?: number;
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const snapshotHomepageItems = listHomepageThemeDirectoryItems(limit);
  const mergedThemeDirectoryItems =
    await listCatalogThemeDirectoryItemsWithOverlay({
      listCatalogOverlaySetsFn,
    });
  const mergedThemeDirectoryItemByName = new Map(
    mergedThemeDirectoryItems.map((catalogThemeDirectoryItem) => [
      catalogThemeDirectoryItem.themeSnapshot.name,
      catalogThemeDirectoryItem,
    ]),
  );

  return snapshotHomepageItems.map(
    (snapshotHomepageThemeDirectoryItem) =>
      mergedThemeDirectoryItemByName.get(
        snapshotHomepageThemeDirectoryItem.themeSnapshot.name,
      ) ?? snapshotHomepageThemeDirectoryItem,
  );
}

export async function listHomepageThemeSpotlightItemsWithOverlay({
  limit = 4,
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  limit?: number;
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<CatalogThemeDirectoryItem[]> {
  const snapshotHomepageSpotlightItems = listHomepageThemeSpotlightItems(limit);
  const mergedThemeDirectoryItems =
    await listCatalogThemeDirectoryItemsWithOverlay({
      listCatalogOverlaySetsFn,
    });
  const mergedThemeDirectoryItemByName = new Map(
    mergedThemeDirectoryItems.map((catalogThemeDirectoryItem) => [
      catalogThemeDirectoryItem.themeSnapshot.name,
      catalogThemeDirectoryItem,
    ]),
  );

  return snapshotHomepageSpotlightItems.map(
    (snapshotHomepageThemeDirectoryItem) =>
      mergedThemeDirectoryItemByName.get(
        snapshotHomepageThemeDirectoryItem.themeSnapshot.name,
      ) ?? snapshotHomepageThemeDirectoryItem,
  );
}

export async function listCatalogThemePageSlugsWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<string[]> {
  return (
    await listCatalogThemeDirectoryItemsWithOverlay({
      listCatalogOverlaySetsFn,
    })
  ).map(
    (catalogThemeDirectoryItem) => catalogThemeDirectoryItem.themeSnapshot.slug,
  );
}

export async function getCatalogThemePageBySlugWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
  slug,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
  slug: string;
}): Promise<CatalogThemeLandingPage | undefined> {
  const snapshotThemePage = getCatalogThemePageBySlug(slug);
  const overlaySetCards = await listOverlayCatalogSetCards({
    listCatalogOverlaySetsFn,
  });
  const overlayCardsForTheme = overlaySetCards.filter(
    (setCard) => buildCatalogThemeSlug(setCard.theme) === slug,
  );

  if (!snapshotThemePage && overlayCardsForTheme.length === 0) {
    return undefined;
  }

  if (!snapshotThemePage) {
    return {
      themeSnapshot: createFallbackThemeSnapshot({
        setCards: overlayCardsForTheme,
        theme: overlayCardsForTheme[0]?.theme ?? slug,
      }),
      setCards: sortDiscoverThemeSetCards({
        setCards: overlayCardsForTheme,
      }),
    };
  }

  const mergedSetCards = mergeThemeSetCards({
    overlaySetCards: overlayCardsForTheme,
    snapshotSetCards: snapshotThemePage.setCards,
  });

  return {
    themeSnapshot: {
      ...snapshotThemePage.themeSnapshot,
      setCount: mergedSetCards.length,
    },
    setCards: mergedSetCards,
  };
}

export async function listDiscoverBrowseThemeGroupsWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
  reviewedSetIds,
  setLimit = 6,
  themeLimit = 6,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
  reviewedSetIds?: readonly string[];
  setLimit?: number;
  themeLimit?: number;
} = {}): Promise<CatalogBrowseThemeGroup[]> {
  const snapshotThemeGroups = listDiscoverBrowseThemeGroups({
    reviewedSetIds,
    setLimit: Number.MAX_SAFE_INTEGER,
    themeLimit: Number.MAX_SAFE_INTEGER,
  });
  const snapshotThemeGroupBySlug = new Map(
    snapshotThemeGroups.map((catalogThemeGroup) => [
      catalogThemeGroup.slug,
      catalogThemeGroup,
    ]),
  );
  const overlaySetCards = await listOverlayCatalogSetCards({
    listCatalogOverlaySetsFn,
  });
  const overlayCardsBySlug = new Map<string, CatalogHomepageSetCard[]>();

  for (const overlaySetCard of overlaySetCards) {
    const slug = buildCatalogThemeSlug(overlaySetCard.theme);
    const existingSetCards = overlayCardsBySlug.get(slug) ?? [];
    existingSetCards.push(overlaySetCard);
    overlayCardsBySlug.set(slug, existingSetCards);
  }

  const mergedSnapshotGroups = snapshotThemeGroups.map((snapshotThemeGroup) => {
    const overlayCards = overlayCardsBySlug.get(snapshotThemeGroup.slug) ?? [];
    const mergedSetCards = sortDiscoverThemeSetCards({
      reviewedSetIds,
      setCards: mergeThemeSetCards({
        overlaySetCards: overlayCards,
        snapshotSetCards: snapshotThemeGroup.setCards,
      }),
    });

    return {
      ...snapshotThemeGroup,
      setCards: mergedSetCards.slice(0, setLimit),
      totalSetCount: mergedSetCards.length,
    };
  });

  const overlayOnlyGroups = [...overlayCardsBySlug.entries()]
    .filter(([slug]) => !snapshotThemeGroupBySlug.has(slug))
    .sort(([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug))
    .map(([slug, setCards]) => {
      const sortedSetCards = sortDiscoverThemeSetCards({
        reviewedSetIds,
        setCards,
      });

      return {
        slug,
        theme: setCards[0]?.theme ?? slug,
        setCards: sortedSetCards.slice(0, setLimit),
        totalSetCount: sortedSetCards.length,
      } satisfies CatalogBrowseThemeGroup;
    });

  return [...mergedSnapshotGroups, ...overlayOnlyGroups].slice(0, themeLimit);
}
