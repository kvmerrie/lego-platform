import {
  CatalogHomepageSetCard,
  CatalogSetDetail,
  CatalogSetOverlay,
  CatalogSetRecord,
  CatalogSetSummary,
  CatalogThemeVisual,
  CatalogThemeSnapshot,
  buildCatalogThemeSlug,
  getCatalogProductSlug,
  normalizeCatalogAsciiText,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import {
  catalogOffers,
  type CatalogOfferRecord,
} from './catalog-offers.generated';
import { catalogSetOverlays, catalogThemeOverlays } from './catalog-overlays';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

const HOMEPAGE_SET_LIMIT = 3;
const HOMEPAGE_THEME_SPOTLIGHT_LIMIT = 4;
const DISCOVER_HIGHLIGHT_LIMIT = 6;
const DISCOVER_THEME_LIMIT = 6;
const DISCOVER_THEME_SET_LIMIT = 6;
const fallbackCatalogThemeOrder = catalogThemeOverlays.map(
  (catalogThemeOverlay) => catalogThemeOverlay.name,
);
const curatedDiscoverThemeOrder = [
  'Icons',
  'Marvel',
  'Ideas',
  'Star Wars',
  'Harry Potter',
  'Technic',
  'Modular Buildings',
  'Botanicals',
  'Architecture',
  'Art',
  'Disney',
  'NINJAGO',
  'Super Mario',
  'Jurassic World',
] as const;
const curatedDiscoverSetOrder = [
  '10316',
  '10333',
  '10294',
  '76269',
  '76178',
  '75367',
  '75313',
  '75331',
  '76417',
  '76419',
  '76437',
  '21348',
  '21350',
  '10300',
  '21333',
  '10280',
  '10311',
  '31208',
  '21345',
  '21349',
  '10305',
  '10326',
  '10332',
  '10318',
  '10341',
  '10317',
  '76218',
  '42143',
  '42115',
  '43222',
  '71411',
  '71741',
] as const;
const homepageDealCandidateIds = [
  '76269',
  '21348',
  '10294',
  '21349',
  '10332',
  '10305',
  '21061',
] as const;
const discoverDealCandidateIds = [
  '76269',
  '10316',
  '21348',
  '10333',
  '10294',
  '21333',
  '21349',
  '10332',
  '10305',
  '21061',
] as const;
const HOMEPAGE_THEME_LIMIT = 6;

export interface CatalogBrowseThemeGroup {
  slug: string;
  setCards: CatalogHomepageSetCard[];
  theme: string;
  totalSetCount?: number;
}

export interface CatalogThemeLandingPage {
  setCards: CatalogHomepageSetCard[];
  themeSnapshot: CatalogThemeSnapshot;
}

export interface CatalogThemeDirectoryItem {
  imageUrl?: string;
  themeSnapshot: CatalogThemeSnapshot;
  visual?: CatalogThemeVisual;
}

const curatedThemeVisualsByName = new Map<string, CatalogThemeVisual>([
  [
    'Icons',
    {
      backgroundColor: '#f0c63b',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
      textColor: '#171a22',
    },
  ],
  [
    'Marvel',
    {
      backgroundColor: '#cf554c',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
      textColor: '#ffffff',
    },
  ],
  [
    'Ideas',
    {
      backgroundColor: '#68b8a0',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/21348-1/138409.jpg',
      textColor: '#10241f',
    },
  ],
  [
    'Star Wars',
    {
      backgroundColor: '#5573b5',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75367-1/127838.jpg',
      textColor: '#ffffff',
    },
  ],
  [
    'Harry Potter',
    {
      backgroundColor: '#7f67bf',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76417-1/127873.jpg',
      textColor: '#ffffff',
    },
  ],
  [
    'Technic',
    {
      backgroundColor: '#a8b4c2',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/42143-1/103001.jpg',
      textColor: '#171a22',
    },
  ],
]);

const catalogSetOverlayById = new Map(
  catalogSetOverlays.map((catalogSetOverlay) => [
    catalogSetOverlay.canonicalId,
    catalogSetOverlay,
  ]),
);
const catalogSetRecordById = new Map(
  catalogSnapshot.setRecords.map((catalogSetRecord) => [
    catalogSetRecord.canonicalId,
    catalogSetRecord,
  ]),
);
const catalogOffersBySetId = new Map<string, CatalogOfferRecord[]>();

function getCatalogOfferAvailabilityRank(
  availability: CatalogOfferRecord['availability'],
): number {
  if (availability === 'in_stock') {
    return 0;
  }

  if (availability === 'unknown') {
    return 1;
  }

  return 2;
}

function sortCatalogOffers(
  offers: readonly CatalogOfferRecord[],
): CatalogOfferRecord[] {
  return [...offers].sort(
    (left, right) =>
      getCatalogOfferAvailabilityRank(left.availability) -
        getCatalogOfferAvailabilityRank(right.availability) ||
      left.priceCents - right.priceCents ||
      left.merchantName.localeCompare(right.merchantName),
  );
}

function toCatalogSetSummary(
  catalogSetDetail: CatalogSetDetail,
): CatalogSetSummary {
  return {
    id: catalogSetDetail.id,
    slug: catalogSetDetail.slug,
    name: catalogSetDetail.name,
    theme: catalogSetDetail.theme,
    releaseYear: catalogSetDetail.releaseYear,
    pieces: catalogSetDetail.pieces,
    priceRange: catalogSetDetail.priceRange,
    collectorAngle: catalogSetDetail.collectorAngle,
    imageUrl: catalogSetDetail.imageUrl,
  };
}

function toCatalogHomepageSetCard(
  catalogSetDetail: CatalogSetDetail,
): CatalogHomepageSetCard {
  return {
    ...toCatalogSetSummary(catalogSetDetail),
    tagline: catalogSetDetail.tagline,
    availability: catalogSetDetail.availability,
    ...(typeof catalogSetDetail.minifigureCount === 'number'
      ? {
          minifigureCount: catalogSetDetail.minifigureCount,
        }
      : {}),
    ...(catalogSetDetail.minifigureHighlights?.length
      ? {
          minifigureHighlights: [...catalogSetDetail.minifigureHighlights],
        }
      : {}),
  };
}

function getThemeVisual({
  fallbackImageUrl,
  themeSnapshot,
}: {
  fallbackImageUrl?: string;
  themeSnapshot: CatalogThemeSnapshot;
}): CatalogThemeVisual | undefined {
  const curatedThemeVisual = curatedThemeVisualsByName.get(themeSnapshot.name);

  if (!curatedThemeVisual && !fallbackImageUrl) {
    return undefined;
  }

  return {
    backgroundColor: curatedThemeVisual?.backgroundColor,
    imageUrl: curatedThemeVisual?.imageUrl ?? fallbackImageUrl,
    textColor: curatedThemeVisual?.textColor,
  };
}

function requireCatalogSetOverlay(
  catalogSetRecord: CatalogSetRecord,
): CatalogSetOverlay {
  const catalogSetOverlay = catalogSetOverlayById.get(
    catalogSetRecord.canonicalId,
  );

  if (!catalogSetOverlay) {
    throw new Error(
      `Missing collector overlay for catalog set ${catalogSetRecord.canonicalId}.`,
    );
  }

  return catalogSetOverlay;
}

function getCatalogDisplayName(
  catalogSetRecord: CatalogSetRecord,
  catalogSetOverlay: CatalogSetOverlay,
): string {
  return catalogSetOverlay.displayName ?? catalogSetRecord.name;
}

function getCatalogDisplayTheme(
  catalogSetRecord: CatalogSetRecord,
  catalogSetOverlay: CatalogSetOverlay,
): string {
  return catalogSetOverlay.displayTheme ?? catalogSetRecord.theme;
}

function registerCatalogSetRecordForSlug({
  catalogSetRecord,
  map,
  slug,
}: {
  catalogSetRecord: CatalogSetRecord;
  map: Map<string, CatalogSetRecord>;
  slug: string;
}) {
  const existingCatalogSetRecord = map.get(slug);

  if (
    existingCatalogSetRecord &&
    existingCatalogSetRecord.canonicalId !== catalogSetRecord.canonicalId
  ) {
    throw new Error(`Duplicate product catalog slug: ${slug}.`);
  }

  map.set(slug, catalogSetRecord);
}

function createCatalogSetRecordByProductSlug() {
  const catalogSetRecordByProductSlug = new Map<string, CatalogSetRecord>();

  for (const catalogSetRecord of catalogSnapshot.setRecords) {
    const catalogSetOverlay = requireCatalogSetOverlay(catalogSetRecord);
    const productSlug = getCatalogProductSlug({
      catalogSetRecord,
      catalogSetOverlay,
    });

    registerCatalogSetRecordForSlug({
      catalogSetRecord,
      map: catalogSetRecordByProductSlug,
      slug: productSlug,
    });
  }

  return catalogSetRecordByProductSlug;
}

const catalogSetRecordBySlug = createCatalogSetRecordByProductSlug();

interface CatalogSearchIndexEntry {
  canonicalIdToken: string;
  compactHighlights?: string;
  compactName: string;
  discoverRank: number;
  normalizedHighlights?: string;
  normalizedName: string;
  setCard: CatalogHomepageSetCard;
  sourceSetNumberToken: string;
}

export interface CatalogSearchMatch {
  discoverRank: number;
  score: number;
  setCard: CatalogHomepageSetCard;
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

function toCatalogSetDetail(
  catalogSetRecord: CatalogSetRecord,
): CatalogSetDetail {
  const catalogSetOverlay = requireCatalogSetOverlay(catalogSetRecord);

  return {
    id: catalogSetRecord.canonicalId,
    slug: getCatalogProductSlug({
      catalogSetRecord,
      catalogSetOverlay,
    }),
    name: getCatalogDisplayName(catalogSetRecord, catalogSetOverlay),
    theme: getCatalogDisplayTheme(catalogSetRecord, catalogSetOverlay),
    releaseYear: catalogSetRecord.releaseYear,
    pieces: catalogSetRecord.pieces,
    imageUrl: catalogSetRecord.imageUrl,
    priceRange: catalogSetOverlay.priceRange,
    collectorAngle: catalogSetOverlay.collectorAngle,
    tagline: catalogSetOverlay.tagline,
    availability: catalogSetOverlay.availability,
    collectorHighlights: [...catalogSetOverlay.collectorHighlights],
    ...(typeof catalogSetOverlay.minifigureCount === 'number'
      ? {
          minifigureCount: catalogSetOverlay.minifigureCount,
        }
      : {}),
    ...(catalogSetOverlay.minifigureHighlights?.length
      ? {
          minifigureHighlights: [...catalogSetOverlay.minifigureHighlights],
        }
      : {}),
    ...(catalogSetOverlay.subtheme
      ? {
          subtheme: catalogSetOverlay.subtheme,
        }
      : {}),
    ...(catalogSetOverlay.setStatus
      ? {
          setStatus: catalogSetOverlay.setStatus,
        }
      : {}),
  };
}

function createCatalogSearchIndex(): CatalogSearchIndexEntry[] {
  return catalogSnapshot.setRecords.map((catalogSetRecord) => {
    const catalogSetCard = toCatalogHomepageSetCard(
      toCatalogSetDetail(catalogSetRecord),
    );
    const minifigureHighlights = catalogSetCard.minifigureHighlights?.join(' ');

    return {
      canonicalIdToken: normalizeCatalogSearchToken(
        catalogSetRecord.canonicalId,
      ),
      ...(minifigureHighlights
        ? {
            compactHighlights:
              normalizeCatalogSearchToken(minifigureHighlights),
            normalizedHighlights:
              normalizeCatalogSearchText(minifigureHighlights),
          }
        : {}),
      compactName: normalizeCatalogSearchToken(catalogSetCard.name),
      discoverRank: getExplicitBrowseRank(
        catalogSetCard.id,
        curatedDiscoverSetOrder,
      ),
      normalizedName: normalizeCatalogSearchText(catalogSetCard.name),
      setCard: catalogSetCard,
      sourceSetNumberToken: normalizeCatalogSearchToken(
        catalogSetRecord.sourceSetNumber,
      ),
    };
  });
}

const catalogSearchIndex = createCatalogSearchIndex();

for (const catalogOffer of catalogOffers) {
  const existingCatalogOffers =
    catalogOffersBySetId.get(catalogOffer.setId) ?? [];

  existingCatalogOffers.push(catalogOffer);
  catalogOffersBySetId.set(catalogOffer.setId, existingCatalogOffers);
}

function getExplicitBrowseRank(
  canonicalId: string,
  rankedIds: readonly string[],
): number {
  const rank = rankedIds.indexOf(canonicalId);

  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function sortCatalogDiscoverSetCards(
  setCards: readonly CatalogHomepageSetCard[],
): CatalogHomepageSetCard[] {
  return [...setCards].sort(
    (left, right) =>
      getExplicitBrowseRank(left.id, curatedDiscoverSetOrder) -
        getExplicitBrowseRank(right.id, curatedDiscoverSetOrder) ||
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
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
      getExplicitBrowseRank(left.id, curatedDiscoverSetOrder) -
        getExplicitBrowseRank(right.id, curatedDiscoverSetOrder) ||
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
  const curatedThemeOrderIndex = curatedDiscoverThemeOrder.indexOf(
    theme as (typeof curatedDiscoverThemeOrder)[number],
  );

  if (curatedThemeOrderIndex !== -1) {
    return curatedThemeOrderIndex;
  }

  const fallbackThemeOrderIndex = fallbackCatalogThemeOrder.indexOf(theme);

  return fallbackThemeOrderIndex === -1
    ? Number.MAX_SAFE_INTEGER
    : fallbackThemeOrderIndex + curatedDiscoverThemeOrder.length;
}

function getCatalogSearchScore({
  entry,
  queryText,
  queryToken,
}: {
  entry: CatalogSearchIndexEntry;
  queryText: string;
  queryToken: string;
}): number | undefined {
  if (
    entry.canonicalIdToken === queryToken ||
    entry.sourceSetNumberToken === queryToken
  ) {
    return 0;
  }

  if (
    entry.canonicalIdToken.startsWith(queryToken) ||
    entry.sourceSetNumberToken.startsWith(queryToken)
  ) {
    return 1;
  }

  if (
    entry.normalizedName.startsWith(queryText) ||
    entry.compactName.startsWith(queryToken)
  ) {
    return 2;
  }

  if (
    entry.normalizedName
      .split(' ')
      .some((normalizedNameWord) => normalizedNameWord.startsWith(queryText))
  ) {
    return 3;
  }

  if (
    entry.normalizedName.includes(queryText) ||
    entry.compactName.includes(queryToken)
  ) {
    return 4;
  }

  if (
    entry.normalizedHighlights
      ?.split(' ')
      .some((normalizedHighlightWord) =>
        normalizedHighlightWord.startsWith(queryText),
      )
  ) {
    return 5;
  }

  if (
    entry.normalizedHighlights?.includes(queryText) ||
    entry.compactHighlights?.includes(queryToken)
  ) {
    return 6;
  }

  return undefined;
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

function getCatalogSetDetailById(canonicalId: string): CatalogSetDetail {
  const catalogSetRecord = catalogSetRecordById.get(canonicalId);

  if (!catalogSetRecord) {
    throw new Error(
      `Missing catalog snapshot record for curated set ${canonicalId}.`,
    );
  }

  return toCatalogSetDetail(catalogSetRecord);
}

export function listCatalogSetSummaries(): CatalogSetSummary[] {
  return sortCatalogSetSummaries(
    catalogSnapshot.setRecords.map((catalogSetRecord) =>
      toCatalogSetSummary(toCatalogSetDetail(catalogSetRecord)),
    ),
  );
}

export function listHomepageSets(): CatalogSetSummary[] {
  return catalogSyncManifest.homepageFeaturedSetIds
    .slice(0, HOMEPAGE_SET_LIMIT)
    .map((canonicalId) =>
      toCatalogSetSummary(getCatalogSetDetailById(canonicalId)),
    );
}

export function listHomepageSetCards(): CatalogHomepageSetCard[] {
  return [...catalogSyncManifest.homepageFeaturedSetIds]
    .slice(0, HOMEPAGE_SET_LIMIT)
    .map((canonicalId) =>
      toCatalogHomepageSetCard(getCatalogSetDetailById(canonicalId)),
    )
    .slice(0, HOMEPAGE_SET_LIMIT);
}

export function listCatalogSetCardsByIds(
  canonicalIds: readonly string[],
): CatalogHomepageSetCard[] {
  return canonicalIds.flatMap((canonicalId) => {
    const catalogSetRecord = catalogSetRecordById.get(canonicalId);

    if (!catalogSetRecord) {
      return [];
    }

    return [toCatalogHomepageSetCard(toCatalogSetDetail(catalogSetRecord))];
  });
}

export function listHomepageDealCandidateSetCards(): CatalogHomepageSetCard[] {
  return listCatalogSetCardsByIds(homepageDealCandidateIds);
}

export function listDiscoverDealCandidateSetCards(): CatalogHomepageSetCard[] {
  return listCatalogSetCardsByIds(discoverDealCandidateIds);
}

export function listDiscoverHighlightSetCards({
  limit = DISCOVER_HIGHLIGHT_LIMIT,
  reviewedSetIds,
}: {
  limit?: number;
  reviewedSetIds?: readonly string[];
} = {}): CatalogHomepageSetCard[] {
  return sortDiscoverShowcaseSetCards({
    reviewedSetIds,
    setCards: listCatalogSetCardsByIds(curatedDiscoverSetOrder),
  }).slice(0, limit);
}

export function listDiscoverCharacterSetCards({
  limit = DISCOVER_HIGHLIGHT_LIMIT,
  reviewedSetIds,
}: {
  limit?: number;
  reviewedSetIds?: readonly string[];
} = {}): CatalogHomepageSetCard[] {
  return sortDiscoverShowcaseSetCards({
    reviewedSetIds,
    setCards: listCatalogSetCardsByIds(curatedDiscoverSetOrder).filter(
      (catalogSetCard) => catalogSetCard.minifigureHighlights?.length,
    ),
  }).slice(0, limit);
}

export function getCatalogOffersBySetId(setId: string): CatalogOfferRecord[] {
  return sortCatalogOffers(catalogOffersBySetId.get(setId) ?? []);
}

export function listCatalogBrowseThemeGroups(): CatalogBrowseThemeGroup[] {
  const setCardsByTheme = new Map<string, CatalogHomepageSetCard[]>();

  for (const catalogSetRecord of catalogSnapshot.setRecords) {
    const catalogSetCard = toCatalogHomepageSetCard(
      toCatalogSetDetail(catalogSetRecord),
    );
    const existingSetCards = setCardsByTheme.get(catalogSetCard.theme) ?? [];

    existingSetCards.push(catalogSetCard);
    setCardsByTheme.set(catalogSetCard.theme, existingSetCards);
  }

  return [...setCardsByTheme.entries()]
    .map(([theme, setCards]) => ({
      slug: buildCatalogThemeSlug(theme),
      theme,
      setCards: sortCatalogDiscoverSetCards(setCards),
    }))
    .sort(
      (left, right) =>
        getCatalogThemeBrowseOrder(left.theme) -
          getCatalogThemeBrowseOrder(right.theme) ||
        left.theme.localeCompare(right.theme),
    );
}

export function listDiscoverBrowseThemeGroups({
  reviewedSetIds,
  themeLimit = DISCOVER_THEME_LIMIT,
  setLimit = DISCOVER_THEME_SET_LIMIT,
}: {
  reviewedSetIds?: readonly string[];
  themeLimit?: number;
  setLimit?: number;
} = {}): CatalogBrowseThemeGroup[] {
  return listCatalogBrowseThemeGroups()
    .slice(0, themeLimit)
    .map((catalogThemeGroup) => ({
      ...catalogThemeGroup,
      setCards: sortDiscoverThemeSetCards({
        setCards: catalogThemeGroup.setCards,
        reviewedSetIds,
      }).slice(0, setLimit),
      totalSetCount: catalogThemeGroup.setCards.length,
    }));
}

export function searchCatalogSetCards(query: string): CatalogHomepageSetCard[] {
  return listCatalogSearchMatches(query, Number.MAX_SAFE_INTEGER).map(
    (catalogSearchMatch) => catalogSearchMatch.setCard,
  );
}

export function listCatalogSearchMatches(
  query: string,
  limit = 6,
): CatalogSearchMatch[] {
  const normalizedQueryText = normalizeCatalogSearchText(query);
  const normalizedQueryToken = normalizeCatalogSearchToken(query);
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizedQueryText || !normalizedQueryToken || suggestionLimit === 0) {
    return [];
  }

  return catalogSearchIndex
    .flatMap((entry) => {
      const score = getCatalogSearchScore({
        entry,
        queryText: normalizedQueryText,
        queryToken: normalizedQueryToken,
      });

      return typeof score === 'number'
        ? [
            {
              discoverRank: entry.discoverRank,
              score,
              setCard: entry.setCard,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        left.setCard.name.localeCompare(right.setCard.name),
    )
    .slice(0, suggestionLimit);
}

export function listCatalogSearchSuggestions(
  query: string,
  limit = 6,
): CatalogHomepageSetCard[] {
  return listCatalogSearchMatches(query, limit).map(
    (catalogSearchMatch) => catalogSearchMatch.setCard,
  );
}

export function listCatalogSetSlugs(): string[] {
  return catalogSnapshot.setRecords.map((catalogSetRecord) =>
    getCatalogProductSlug({
      catalogSetRecord,
      catalogSetOverlay: requireCatalogSetOverlay(catalogSetRecord),
    }),
  );
}

export function getCatalogSetBySlug(slug: string) {
  const catalogSetRecord = catalogSetRecordBySlug.get(slug);

  return catalogSetRecord ? toCatalogSetDetail(catalogSetRecord) : undefined;
}

export function listCatalogThemes(): CatalogThemeSnapshot[] {
  return catalogThemeOverlays.map((catalogThemeOverlay) => ({
    name: catalogThemeOverlay.name,
    slug: buildCatalogThemeSlug(catalogThemeOverlay.name),
    setCount: catalogThemeOverlay.setCount,
    momentum: catalogThemeOverlay.momentum,
    signatureSet: catalogThemeOverlay.signatureSet,
  }));
}

export function listHomepageThemeSnapshots(
  limit = HOMEPAGE_THEME_LIMIT,
): CatalogThemeSnapshot[] {
  const catalogThemeSnapshotByName = new Map(
    listCatalogThemes().map((catalogThemeSnapshot) => [
      catalogThemeSnapshot.name,
      catalogThemeSnapshot,
    ]),
  );

  return listCatalogBrowseThemeGroups()
    .flatMap((catalogThemeGroup) => {
      const catalogThemeSnapshot = catalogThemeSnapshotByName.get(
        catalogThemeGroup.theme,
      );

      return catalogThemeSnapshot ? [catalogThemeSnapshot] : [];
    })
    .slice(0, limit);
}

export function listHomepageThemeDirectoryItems(
  limit = HOMEPAGE_THEME_LIMIT,
): CatalogThemeDirectoryItem[] {
  const catalogThemeDirectoryItemByName = new Map(
    listCatalogThemeDirectoryItems().map((catalogThemeDirectoryItem) => [
      catalogThemeDirectoryItem.themeSnapshot.name,
      catalogThemeDirectoryItem,
    ]),
  );

  return listHomepageThemeSnapshots(limit).flatMap((catalogThemeSnapshot) => {
    const catalogThemeDirectoryItem = catalogThemeDirectoryItemByName.get(
      catalogThemeSnapshot.name,
    );

    if (!catalogThemeDirectoryItem) {
      return [];
    }

    return [
      {
        ...catalogThemeDirectoryItem,
        visual: getThemeVisual({
          fallbackImageUrl: catalogThemeDirectoryItem.imageUrl,
          themeSnapshot: catalogThemeSnapshot,
        }),
      },
    ];
  });
}

export function listHomepageThemeSpotlightItems(
  limit = HOMEPAGE_THEME_SPOTLIGHT_LIMIT,
): CatalogThemeDirectoryItem[] {
  return listHomepageThemeDirectoryItems().slice(0, limit);
}

export function listCatalogThemeDirectoryItems(): CatalogThemeDirectoryItem[] {
  const catalogThemeSnapshotByName = new Map(
    listCatalogThemes().map((catalogThemeSnapshot) => [
      catalogThemeSnapshot.name,
      catalogThemeSnapshot,
    ]),
  );

  return listCatalogBrowseThemeGroups().flatMap((catalogThemeGroup) => {
    const catalogThemeSnapshot = catalogThemeSnapshotByName.get(
      catalogThemeGroup.theme,
    );

    if (!catalogThemeSnapshot) {
      return [];
    }

    const imageUrl = getCatalogThemeRepresentativeImageUrl({
      setCards: catalogThemeGroup.setCards,
      themeSnapshot: catalogThemeSnapshot,
    });

    return [
      {
        imageUrl,
        themeSnapshot: catalogThemeSnapshot,
        visual: getThemeVisual({
          fallbackImageUrl: imageUrl,
          themeSnapshot: catalogThemeSnapshot,
        }),
      },
    ];
  });
}

function listCatalogThemeLandingPages(): CatalogThemeLandingPage[] {
  const catalogThemeSnapshotByName = new Map(
    listCatalogThemes().map((catalogThemeSnapshot) => [
      catalogThemeSnapshot.name,
      catalogThemeSnapshot,
    ]),
  );

  return listCatalogBrowseThemeGroups().flatMap((catalogThemeGroup) => {
    const catalogThemeSnapshot = catalogThemeSnapshotByName.get(
      catalogThemeGroup.theme,
    );

    if (!catalogThemeSnapshot) {
      return [];
    }

    return [
      {
        themeSnapshot: catalogThemeSnapshot,
        setCards: catalogThemeGroup.setCards,
      },
    ];
  });
}

export function listCatalogThemePageSlugs(): string[] {
  return listCatalogThemeLandingPages().map(
    (catalogThemeLandingPage) => catalogThemeLandingPage.themeSnapshot.slug,
  );
}

export function getCatalogThemePageBySlug(
  slug: string,
): CatalogThemeLandingPage | undefined {
  return listCatalogThemeLandingPages().find(
    (catalogThemeLandingPage) =>
      catalogThemeLandingPage.themeSnapshot.slug === slug,
  );
}
