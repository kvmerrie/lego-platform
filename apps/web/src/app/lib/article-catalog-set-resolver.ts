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

const VEHICLE_RELATED_KEYWORDS = [
  'car',
  'fighter',
  'kart',
  'ship',
  'shuttle',
  'speeder',
  'starfighter',
  'train',
  'truck',
  'vehicle',
] as const;
const DISPLAY_RELATED_KEYWORDS = [
  'architecture',
  'botanical',
  'display',
  'diorama',
  'helmet',
  'icons',
  'skyline',
  'statue',
  'tower',
] as const;

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

function getNormalizedArticleCatalogTheme(setCard: CatalogHomepageSetCard) {
  return getCatalogThemeDisplayName(setCard.theme) ?? setCard.theme;
}

function getComparableSetName(setCard: CatalogHomepageSetCard) {
  return setCard.name.toLocaleLowerCase('nl-NL');
}

function getSharedKeywords({
  left,
  right,
  keywords,
}: {
  left: CatalogHomepageSetCard;
  right: CatalogHomepageSetCard;
  keywords: readonly string[];
}) {
  const leftName = getComparableSetName(left);
  const rightName = getComparableSetName(right);

  return keywords.filter(
    (keyword) => leftName.includes(keyword) && rightName.includes(keyword),
  );
}

function isSameCatalogTheme(
  left: CatalogHomepageSetCard,
  right: CatalogHomepageSetCard,
) {
  return (
    getNormalizedArticleCatalogTheme(left) ===
    getNormalizedArticleCatalogTheme(right)
  );
}

function isHelmetCollectionSet(setCard: CatalogHomepageSetCard) {
  return /\bhelmet\b/iu.test(setCard.name);
}

function resolveCuratedRelatedSetContext(
  featuredSetCard: CatalogHomepageSetCard,
): { title: string; type: 'display' | 'helmet' | 'vehicle' } | undefined {
  const featuredSetName = getComparableSetName(featuredSetCard);

  if (isHelmetCollectionSet(featuredSetCard)) {
    return {
      title: 'Andere helmets in deze lijn',
      type: 'helmet',
    };
  }

  if (
    VEHICLE_RELATED_KEYWORDS.some((keyword) =>
      featuredSetName.includes(keyword),
    )
  ) {
    return {
      title: 'Vergelijkbare voertuigen',
      type: 'vehicle',
    };
  }

  if (
    DISPLAY_RELATED_KEYWORDS.some((keyword) =>
      featuredSetName.includes(keyword),
    )
  ) {
    return {
      title: 'Vergelijkbare displaysets',
      type: 'display',
    };
  }

  return undefined;
}

function isStrongRelatedCatalogSet({
  candidateSetCard,
  featuredSetCard,
  type,
}: {
  candidateSetCard: CatalogHomepageSetCard;
  featuredSetCard: CatalogHomepageSetCard;
  type: 'display' | 'helmet' | 'vehicle';
}) {
  if (
    candidateSetCard.id === featuredSetCard.id ||
    !isSameCatalogTheme(featuredSetCard, candidateSetCard)
  ) {
    return false;
  }

  if (type === 'helmet') {
    return isHelmetCollectionSet(candidateSetCard);
  }

  const keywordGroup =
    type === 'vehicle' ? VEHICLE_RELATED_KEYWORDS : DISPLAY_RELATED_KEYWORDS;

  return (
    getSharedKeywords({
      keywords: keywordGroup,
      left: featuredSetCard,
      right: candidateSetCard,
    }).length > 0
  );
}

function getSnapshotSetCards() {
  return catalogSnapshot.setRecords.map(toCatalogSetCardFromSnapshotRecord);
}

function findRepresentativeSnapshotSetCardByTheme(
  theme: string,
): CatalogHomepageSetCard | undefined {
  const normalizedTheme = getCatalogThemeDisplayName(theme) ?? theme;
  const candidates = catalogSnapshot.setRecords
    .map(toCatalogSetCardFromSnapshotRecord)
    .filter(
      (setCard) =>
        getNormalizedArticleCatalogTheme(setCard) === normalizedTheme &&
        getArticleCatalogSetImageUrl(setCard),
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
    const resolvedLiveSetCards = await listCatalogSetCards({ limit: 240 });
    liveSetCards = Array.isArray(resolvedLiveSetCards)
      ? resolvedLiveSetCards
      : [];
  } catch {
    liveSetCards = [];
  }

  const [liveRepresentativeSetCard] = liveSetCards
    .filter(
      (setCard) =>
        getNormalizedArticleCatalogTheme(setCard) === normalizedTheme &&
        getArticleCatalogSetImageUrl(setCard),
    )
    .sort(sortRepresentativeCatalogSetCards);

  return (
    liveRepresentativeSetCard ??
    findRepresentativeSnapshotSetCardByTheme(normalizedTheme)
  );
}

export async function resolveCuratedRelatedArticleCatalogSetRail({
  featuredSetCard,
  limit = 20,
}: {
  featuredSetCard: CatalogHomepageSetCard;
  limit?: number;
}): Promise<
  | {
      setCards: CatalogHomepageSetCard[];
      title: string;
    }
  | undefined
> {
  const context = resolveCuratedRelatedSetContext(featuredSetCard);

  if (!context) {
    return undefined;
  }

  let liveSetCards: CatalogHomepageSetCard[] = [];

  try {
    const resolvedLiveSetCards = await listCatalogSetCards({ limit: 240 });
    liveSetCards = Array.isArray(resolvedLiveSetCards)
      ? resolvedLiveSetCards
      : [];
  } catch {
    liveSetCards = [];
  }

  const seenCandidateSetIds = new Set<string>([featuredSetCard.id]);
  const candidateSetCards = (
    liveSetCards.length ? liveSetCards : getSnapshotSetCards()
  )
    .filter((candidateSetCard) => {
      if (seenCandidateSetIds.has(candidateSetCard.id)) {
        return false;
      }

      seenCandidateSetIds.add(candidateSetCard.id);
      return true;
    })
    .filter((candidateSetCard) =>
      isStrongRelatedCatalogSet({
        candidateSetCard,
        featuredSetCard,
        type: context.type,
      }),
    )
    .filter((setCard) => getArticleCatalogSetImageUrl(setCard))
    .sort(sortRepresentativeCatalogSetCards)
    .slice(0, limit);

  if (candidateSetCards.length < 2) {
    return undefined;
  }

  return {
    setCards: candidateSetCards,
    title: context.title,
  };
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
