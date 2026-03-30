import {
  CatalogHomepageSetCard,
  CatalogSetDetail,
  CatalogSetOverlay,
  CatalogSetRecord,
  CatalogSetSummary,
  CatalogThemeSnapshot,
  getCatalogProductSlug,
  normalizeCatalogAsciiText,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import { catalogSetOverlays, catalogThemeOverlays } from './catalog-overlays';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

const HOMEPAGE_SET_LIMIT = 3;
const catalogThemeOrder = catalogThemeOverlays.map(
  (catalogThemeOverlay) => catalogThemeOverlay.name,
);

export interface CatalogBrowseThemeGroup {
  setCards: CatalogHomepageSetCard[];
  theme: string;
}

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
  compactName: string;
  normalizedName: string;
  setCard: CatalogHomepageSetCard;
  sourceSetNumberToken: string;
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
  };
}

function createCatalogSearchIndex(): CatalogSearchIndexEntry[] {
  return catalogSnapshot.setRecords.map((catalogSetRecord) => {
    const catalogSetCard = toCatalogHomepageSetCard(
      toCatalogSetDetail(catalogSetRecord),
    );

    return {
      canonicalIdToken: normalizeCatalogSearchToken(
        catalogSetRecord.canonicalId,
      ),
      compactName: normalizeCatalogSearchToken(catalogSetCard.name),
      normalizedName: normalizeCatalogSearchText(catalogSetCard.name),
      setCard: catalogSetCard,
      sourceSetNumberToken: normalizeCatalogSearchToken(
        catalogSetRecord.sourceSetNumber,
      ),
    };
  });
}

const catalogSearchIndex = createCatalogSearchIndex();

function sortCatalogHomepageSetCards(
  setCards: readonly CatalogHomepageSetCard[],
): CatalogHomepageSetCard[] {
  return [...setCards].sort(
    (left, right) =>
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
}

function getCatalogThemeBrowseOrder(theme: string): number {
  const themeOrderIndex = catalogThemeOrder.indexOf(theme);

  return themeOrderIndex === -1 ? Number.MAX_SAFE_INTEGER : themeOrderIndex;
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

  if (entry.normalizedName.startsWith(queryText)) {
    return 2;
  }

  if (
    entry.normalizedName.includes(queryText) ||
    entry.compactName.includes(queryToken)
  ) {
    return 3;
  }

  return undefined;
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
  return sortCatalogSetSummaries(
    catalogSyncManifest.homepageFeaturedSetIds
      .slice(0, HOMEPAGE_SET_LIMIT)
      .map((canonicalId) =>
        toCatalogSetSummary(getCatalogSetDetailById(canonicalId)),
      ),
  ).slice(0, HOMEPAGE_SET_LIMIT);
}

export function listHomepageSetCards(): CatalogHomepageSetCard[] {
  return [...catalogSyncManifest.homepageFeaturedSetIds]
    .slice(0, HOMEPAGE_SET_LIMIT)
    .map((canonicalId) =>
      toCatalogHomepageSetCard(getCatalogSetDetailById(canonicalId)),
    )
    .sort(
      (left, right) =>
        right.releaseYear - left.releaseYear ||
        left.name.localeCompare(right.name),
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
      theme,
      setCards: sortCatalogHomepageSetCards(setCards),
    }))
    .sort(
      (left, right) =>
        getCatalogThemeBrowseOrder(left.theme) -
          getCatalogThemeBrowseOrder(right.theme) ||
        left.theme.localeCompare(right.theme),
    );
}

export function searchCatalogSetCards(query: string): CatalogHomepageSetCard[] {
  const normalizedQueryText = normalizeCatalogSearchText(query);
  const normalizedQueryToken = normalizeCatalogSearchToken(query);

  if (!normalizedQueryText || !normalizedQueryToken) {
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
    .map((entry) => entry.setCard);
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
    setCount: catalogThemeOverlay.setCount,
    momentum: catalogThemeOverlay.momentum,
    signatureSet: catalogThemeOverlay.signatureSet,
  }));
}
