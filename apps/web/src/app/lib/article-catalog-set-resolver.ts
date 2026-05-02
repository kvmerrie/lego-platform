import { catalogSnapshot } from '@lego-platform/catalog/data-access';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  getCanonicalCatalogSetId,
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
