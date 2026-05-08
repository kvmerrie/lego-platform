import {
  listCatalogSearchSuggestionSetCards,
  listCatalogThemeDirectoryItems,
} from '@lego-platform/catalog/data-access-web';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [sets, themes] = await Promise.all([
    listCatalogSearchSuggestionSetCards({ limit: 24 }),
    listCatalogThemeDirectoryItems(),
  ]);

  return NextResponse.json(
    {
      sets,
      themes,
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
