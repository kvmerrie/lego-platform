import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';

const catalogSetCardsApiPath = '/api/catalog/set-cards';

export async function listCatalogSetCardsByIdsForBrowser({
  canonicalIds,
  fetchImpl = fetch,
}: {
  canonicalIds: readonly string[];
  fetchImpl?: typeof fetch;
}): Promise<CatalogHomepageSetCard[]> {
  const orderedCanonicalIds = canonicalIds.filter(Boolean);

  if (!orderedCanonicalIds.length) {
    return [];
  }

  const uniqueCanonicalIds = [...new Set(orderedCanonicalIds)];

  try {
    const searchParams = new URLSearchParams();

    for (const canonicalId of uniqueCanonicalIds) {
      searchParams.append('setId', canonicalId);
    }

    const response = await fetchImpl(
      `${catalogSetCardsApiPath}?${searchParams.toString()}`,
      {
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load canonical catalog set cards.');
    }

    const responseSetCards =
      (await response.json()) as CatalogHomepageSetCard[];
    const responseSetCardById = new Map(
      responseSetCards.map((catalogSetCard) => [
        catalogSetCard.id,
        catalogSetCard,
      ]),
    );
    const fallbackSetCardById = new Map(
      listCatalogSetCardsByIds(uniqueCanonicalIds).map((catalogSetCard) => [
        catalogSetCard.id,
        catalogSetCard,
      ]),
    );

    return orderedCanonicalIds.flatMap((canonicalId) => {
      const catalogSetCard =
        responseSetCardById.get(canonicalId) ??
        fallbackSetCardById.get(canonicalId);

      return catalogSetCard ? [catalogSetCard] : [];
    });
  } catch {
    return listCatalogSetCardsByIds(orderedCanonicalIds);
  }
}
