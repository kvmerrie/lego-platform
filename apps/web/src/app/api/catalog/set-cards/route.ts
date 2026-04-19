import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access-web';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const setIds = request.nextUrl.searchParams.getAll('setId').filter(Boolean);
  const catalogSetCards = await listCatalogSetCardsByIds({
    canonicalIds: setIds,
  });

  return NextResponse.json(catalogSetCards, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
