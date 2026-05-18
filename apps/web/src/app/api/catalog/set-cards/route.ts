import { buildCurrentSetCardPriceContextBySetId } from '../../../lib/current-set-card-price-context';
import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogSetCardsByIds,
} from '@lego-platform/catalog/data-access-web';
import { cacheTags } from '@lego-platform/shared/config';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const setIds = request.nextUrl.searchParams.getAll('setId').filter(Boolean);
  const catalogSetCards = await listCatalogSetCardsByIds({
    canonicalIds: setIds,
  });
  const currentOfferSummaryBySetId = catalogSetCards.length
    ? await listCatalogCurrentOfferSummariesBySetIds({
        cacheOptions: {
          revalidateSeconds: 300,
          tags: [
            cacheTags.prices(),
            ...catalogSetCards.map((catalogSetCard) =>
              cacheTags.set(catalogSetCard.id),
            ),
          ],
        },
        setIds: catalogSetCards.map((catalogSetCard) => catalogSetCard.id),
      })
    : new Map();
  const priceContextBySetId = buildCurrentSetCardPriceContextBySetId({
    currentOfferSummaryBySetId,
    setCards: catalogSetCards,
  });
  const enrichedCatalogSetCards = catalogSetCards.map((catalogSetCard) => ({
    ...catalogSetCard,
    priceContext: priceContextBySetId.get(catalogSetCard.id),
  }));

  return NextResponse.json(enrichedCatalogSetCards, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
