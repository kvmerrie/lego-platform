import { listCatalogSearchSuggestionOverlaySetCards } from '@lego-platform/catalog/data-access-web';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const overlaySearchSuggestionSetCards =
    await listCatalogSearchSuggestionOverlaySetCards();

  return NextResponse.json(overlaySearchSuggestionSetCards, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
