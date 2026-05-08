import {
  listCatalogSearchMatches,
  listCatalogSearchSuggestionSetCards,
  listCatalogThemeDirectoryItems,
} from '@lego-platform/catalog/data-access-web';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_SEARCH_SUGGESTION_LIMIT = 6;
const DEFAULT_PRELOAD_SUGGESTION_LIMIT = 24;
const MAX_SEARCH_SUGGESTION_LIMIT = 24;

function normalizeCatalogSearchSuggestionQuery(query: string | null): string {
  return query?.trim().replace(/\s+/gu, ' ') ?? '';
}

function parseCatalogSearchSuggestionLimit(
  value: string | null,
  fallback: number,
): number {
  if (value === null) {
    return fallback;
  }

  const parsedLimit = Number(value);

  if (!Number.isFinite(parsedLimit)) {
    return fallback;
  }

  return Math.min(
    MAX_SEARCH_SUGGESTION_LIMIT,
    Math.max(1, Math.floor(parsedLimit)),
  );
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = normalizeCatalogSearchSuggestionQuery(searchParams.get('q'));
  const limit = parseCatalogSearchSuggestionLimit(
    searchParams.get('limit'),
    query ? DEFAULT_SEARCH_SUGGESTION_LIMIT : DEFAULT_PRELOAD_SUGGESTION_LIMIT,
  );
  const [sets, themes] = await Promise.all([
    query
      ? listCatalogSearchMatches({ limit, query }).then((matches) =>
          matches.map((match) => match.setCard),
        )
      : listCatalogSearchSuggestionSetCards({ limit }),
    listCatalogThemeDirectoryItems(),
  ]);

  return NextResponse.json(
    {
      query,
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
