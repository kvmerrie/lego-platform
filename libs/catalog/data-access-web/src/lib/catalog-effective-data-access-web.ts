import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type CatalogBrowseThemeGroup,
  type CatalogSearchMatch,
  type CatalogThemeDirectoryItem,
  type CatalogThemeLandingPage,
  getCatalogSetBySlug,
  getCatalogThemePageBySlug,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  listCatalogSearchMatches,
  listCatalogSetSlugs,
  listCatalogThemeDirectoryItems,
  listDiscoverBrowseThemeGroups,
} from '@lego-platform/catalog/data-access';
import type {
  CatalogHomepageSetCard,
  CatalogSetDetail,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import {
  buildCatalogThemeSlug,
  getCatalogThemeVisual,
  normalizeCatalogAsciiText,
} from '@lego-platform/catalog/util';
import {
  getServerSupabaseConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

const CATALOG_SETS_OVERLAY_TABLE = 'catalog_sets_overlay';
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

interface CatalogOverlaySet {
  createdAt: string;
  imageUrl?: string;
  name: string;
  pieces: number;
  releaseYear: number;
  setId: string;
  slug: string;
  source: 'rebrickable';
  sourceSetNumber: string;
  status: 'active';
  theme: string;
  updatedAt: string;
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
    theme: row.theme,
    updatedAt: row.updated_at,
  };
}

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

function toOverlayCatalogSetDetail(
  overlaySet: Awaited<ReturnType<typeof listCatalogOverlaySets>>[number],
): CatalogSetDetail {
  return {
    id: overlaySet.setId,
    slug: overlaySet.slug,
    name: overlaySet.name,
    theme: overlaySet.theme,
    releaseYear: overlaySet.releaseYear,
    pieces: overlaySet.pieces,
    imageUrl: overlaySet.imageUrl,
    collectorAngle: `Nieuw in Brickhunt. ${overlaySet.name} staat klaar voor de eerste prijscheck.`,
    tagline: `We bouwen nu de eerste prijsvergelijking op voor deze ${overlaySet.theme}-set.`,
    availability: 'Brickhunt bouwt nu de eerste prijschecks op.',
    collectorHighlights: [
      `${overlaySet.pieces.toLocaleString('nl-NL')} stenen`,
      `Release ${overlaySet.releaseYear}`,
    ],
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

function normalizeCatalogSearchText(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCatalogSearchToken(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getCatalogSearchScore({
  setCard,
  queryText,
  queryToken,
}: {
  queryText: string;
  queryToken: string;
  setCard: CatalogHomepageSetCard;
}): number | undefined {
  const canonicalIdToken = normalizeCatalogSearchToken(setCard.id);
  const normalizedName = normalizeCatalogSearchText(setCard.name);
  const compactName = normalizeCatalogSearchToken(setCard.name);
  const highlightText = setCard.minifigureHighlights?.join(' ');
  const normalizedHighlights = highlightText
    ? normalizeCatalogSearchText(highlightText)
    : undefined;
  const compactHighlights = highlightText
    ? normalizeCatalogSearchToken(highlightText)
    : undefined;

  if (canonicalIdToken === queryToken) {
    return 0;
  }

  if (canonicalIdToken.startsWith(queryToken)) {
    return 1;
  }

  if (
    normalizedName.startsWith(queryText) ||
    compactName.startsWith(queryToken)
  ) {
    return 2;
  }

  if (
    normalizedName
      .split(' ')
      .some((normalizedNameWord) => normalizedNameWord.startsWith(queryText))
  ) {
    return 3;
  }

  if (normalizedName.includes(queryText) || compactName.includes(queryToken)) {
    return 4;
  }

  if (
    normalizedHighlights
      ?.split(' ')
      .some((normalizedHighlightWord) =>
        normalizedHighlightWord.startsWith(queryText),
      )
  ) {
    return 5;
  }

  if (
    normalizedHighlights?.includes(queryText) ||
    compactHighlights?.includes(queryToken)
  ) {
    return 6;
  }

  return undefined;
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
  const overlaySetDetails = (await listCatalogOverlaySetsFn()).map(
    toOverlayCatalogSetDetail,
  );

  return overlaySetDetails.map(toCatalogHomepageSetCard);
}

export async function listCatalogSetSlugsWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
} = {}): Promise<string[]> {
  const snapshotSlugs = listCatalogSetSlugs();
  const snapshotSlugSet = new Set(snapshotSlugs);
  const overlaySlugs = (await listCatalogOverlaySetsFn())
    .map((overlaySet) => overlaySet.slug)
    .filter((slug) => !snapshotSlugSet.has(slug))
    .sort((left, right) => left.localeCompare(right));

  return [...snapshotSlugs, ...overlaySlugs];
}

export async function getCatalogSetBySlugWithOverlay({
  listCatalogOverlaySetsFn = listCatalogOverlaySets,
  slug,
}: {
  listCatalogOverlaySetsFn?: typeof listCatalogOverlaySets;
  slug: string;
}): Promise<CatalogSetDetail | undefined> {
  const snapshotSet = getCatalogSetBySlug(slug);

  if (snapshotSet) {
    return snapshotSet;
  }

  const overlaySet = (await listCatalogOverlaySetsFn()).find(
    (candidate) => candidate.slug === slug,
  );

  return overlaySet ? toOverlayCatalogSetDetail(overlaySet) : undefined;
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
  const normalizedQueryText = normalizeCatalogSearchText(query);
  const normalizedQueryToken = normalizeCatalogSearchToken(query);
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizedQueryText || !normalizedQueryToken || suggestionLimit === 0) {
    return [];
  }

  const snapshotMatches = listCatalogSearchMatches(
    query,
    Number.MAX_SAFE_INTEGER,
  );
  const existingSetIds = new Set(
    snapshotMatches.map((catalogSearchMatch) => catalogSearchMatch.setCard.id),
  );
  const overlayMatches = (
    await listOverlayCatalogSetCards({
      listCatalogOverlaySetsFn,
    })
  )
    .filter((setCard) => !existingSetIds.has(setCard.id))
    .flatMap((setCard) => {
      const score = getCatalogSearchScore({
        queryText: normalizedQueryText,
        queryToken: normalizedQueryToken,
        setCard,
      });

      return typeof score === 'number'
        ? [
            {
              discoverRank: Number.MAX_SAFE_INTEGER,
              score,
              setCard,
            } satisfies CatalogSearchMatch,
          ]
        : [];
    });

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
