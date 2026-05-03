import { catalogSnapshot } from '@lego-platform/catalog/data-access';
import {
  listCatalogSetCards,
  listCatalogSetCardsByIds,
} from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  getCanonicalCatalogSetId,
  getCatalogThemeDisplayName,
  normalizeCatalogSetImages,
} from '@lego-platform/catalog/util';

function toCatalogSetCardFromSnapshotRecord(
  snapshotRecord: (typeof catalogSnapshot.setRecords)[number],
): CatalogHomepageSetCard {
  return {
    id: snapshotRecord.canonicalId,
    imageUrl: snapshotRecord.imageUrl,
    images: snapshotRecord.images,
    name: snapshotRecord.name,
    pieces: snapshotRecord.pieces,
    primaryImage: snapshotRecord.primaryImage,
    releaseDate: snapshotRecord.releaseDate,
    releaseDatePrecision: snapshotRecord.releaseDatePrecision,
    releaseYear: snapshotRecord.releaseYear,
    slug: snapshotRecord.slug,
    theme: snapshotRecord.theme,
  };
}

function buildArticleSnapshotSetCardLookup() {
  const snapshotSetCardById = new Map<string, CatalogHomepageSetCard>();

  for (const snapshotRecord of catalogSnapshot.setRecords) {
    const setCard = toCatalogSetCardFromSnapshotRecord(snapshotRecord);
    const lookupKeys = [
      snapshotRecord.canonicalId,
      getCanonicalCatalogSetId(snapshotRecord.canonicalId),
      snapshotRecord.sourceSetNumber,
      getCanonicalCatalogSetId(snapshotRecord.sourceSetNumber),
    ].filter(Boolean);

    for (const lookupKey of lookupKeys) {
      if (!snapshotSetCardById.has(lookupKey)) {
        snapshotSetCardById.set(lookupKey, setCard);
      }
    }
  }

  return snapshotSetCardById;
}

const articleSnapshotSetCardById = buildArticleSnapshotSetCardLookup();

function sortRepresentativeCatalogSetCards(
  left: CatalogHomepageSetCard,
  right: CatalogHomepageSetCard,
): number {
  const leftHasPositivePieces = left.pieces > 0 ? 1 : 0;
  const rightHasPositivePieces = right.pieces > 0 ? 1 : 0;
  const leftReleaseDate = left.releaseDate
    ? Date.parse(`${left.releaseDate}T00:00:00Z`)
    : 0;
  const rightReleaseDate = right.releaseDate
    ? Date.parse(`${right.releaseDate}T00:00:00Z`)
    : 0;

  return (
    rightHasPositivePieces - leftHasPositivePieces ||
    right.pieces - left.pieces ||
    right.releaseYear - left.releaseYear ||
    rightReleaseDate - leftReleaseDate ||
    left.id.localeCompare(right.id, 'nl-NL') ||
    left.name.localeCompare(right.name, 'nl-NL')
  );
}

function findRepresentativeSnapshotSetCardByTheme(
  theme: string,
): CatalogHomepageSetCard | undefined {
  const normalizedTheme = getCatalogThemeDisplayName(theme) ?? theme;
  const candidates = catalogSnapshot.setRecords
    .map(toCatalogSetCardFromSnapshotRecord)
    .filter(
      (setCard) =>
        (getCatalogThemeDisplayName(setCard.theme) ?? setCard.theme) ===
          normalizedTheme && getArticleCatalogSetImageUrl(setCard),
    )
    .sort(sortRepresentativeCatalogSetCards);

  return candidates[0];
}

export async function resolveArticleCatalogSetCards({
  canonicalIds,
}: {
  canonicalIds: readonly string[];
}): Promise<CatalogHomepageSetCard[]> {
  let liveSetCards: CatalogHomepageSetCard[] = [];

  try {
    liveSetCards = await listCatalogSetCardsByIds({
      canonicalIds,
    });
  } catch {
    liveSetCards = [];
  }

  const liveSetCardById = new Map(
    liveSetCards.map((setCard) => [setCard.id, setCard]),
  );

  return canonicalIds.flatMap((canonicalId) => {
    const liveSetCard = liveSetCardById.get(canonicalId);

    if (liveSetCard) {
      return [liveSetCard];
    }

    const snapshotSetCard = articleSnapshotSetCardById.get(canonicalId);

    return snapshotSetCard ? [snapshotSetCard] : [];
  });
}

export async function resolveArticleCatalogSetCard({
  canonicalId,
}: {
  canonicalId: string;
}): Promise<CatalogHomepageSetCard | undefined> {
  const [setCard] = await resolveArticleCatalogSetCards({
    canonicalIds: [canonicalId],
  });

  return setCard;
}

export async function resolveRepresentativeArticleCatalogSetCardByTheme({
  theme,
}: {
  theme: string;
}): Promise<CatalogHomepageSetCard | undefined> {
  const normalizedTheme = getCatalogThemeDisplayName(theme) ?? theme;
  let liveSetCards: CatalogHomepageSetCard[] = [];

  try {
    liveSetCards = await listCatalogSetCards();
  } catch {
    liveSetCards = [];
  }

  const [liveRepresentativeSetCard] = liveSetCards
    .filter(
      (setCard) =>
        (getCatalogThemeDisplayName(setCard.theme) ?? setCard.theme) ===
          normalizedTheme && getArticleCatalogSetImageUrl(setCard),
    )
    .sort(sortRepresentativeCatalogSetCards);

  return (
    liveRepresentativeSetCard ??
    findRepresentativeSnapshotSetCardByTheme(normalizedTheme)
  );
}

export function getArticleCatalogSetImageUrl(
  setCard?: CatalogHomepageSetCard,
): string | undefined {
  if (!setCard) {
    return undefined;
  }

  const normalizedImages = normalizeCatalogSetImages({
    imageUrl: setCard.imageUrl,
    images: setCard.images,
    primaryImage: setCard.primaryImage,
  });

  return (
    normalizedImages.primaryImage ??
    normalizedImages.imageUrl ??
    normalizedImages.images?.[0]?.url
  );
}
