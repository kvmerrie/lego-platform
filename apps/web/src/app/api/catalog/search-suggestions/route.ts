import { listCatalogSearchSuggestionSetCards } from '@lego-platform/catalog/data-access-web';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const searchSuggestionSetCards = await listCatalogSearchSuggestionSetCards();

  return NextResponse.json(searchSuggestionSetCards, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
