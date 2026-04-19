import {
  createCatalogSet,
  listCanonicalCatalogSets,
  searchCatalogMissingSets,
} from '@lego-platform/catalog/data-access-server';
import {
  hasRebrickableApiConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

function getRequiredArg({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: string;
}): string {
  const equalsStyleFlag = argv.find((argument) =>
    argument.startsWith(`${flag}=`),
  );

  if (equalsStyleFlag) {
    const value = equalsStyleFlag.slice(flag.length + 1).trim();

    if (value) {
      return value;
    }
  }

  const flagIndex = argv.findIndex((argument) => argument === flag);
  const value = flagIndex >= 0 ? argv[flagIndex + 1]?.trim() : undefined;

  if (!value) {
    throw new Error(`Use ${flag} <value>.`);
  }

  return value;
}

function normalizeSetQuery(query: string) {
  const trimmedQuery = query.trim();

  return /^\d+$/.test(trimmedQuery) ? `${trimmedQuery}-1` : trimmedQuery;
}

async function main() {
  const argv = process.argv.slice(2);
  const requestedSetNumber = normalizeSetQuery(
    getRequiredArg({
      argv,
      flag: '--set-number',
    }),
  );
  const startedAt = Date.now();

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for catalog set import.',
    );
  }

  if (!hasRebrickableApiConfig()) {
    throw new Error('REBRICKABLE_API_KEY is required for catalog set import.');
  }

  console.log(`[catalog-set-import] start set_number=${requestedSetNumber}`);

  const existingCatalogSets = await listCanonicalCatalogSets({
    includeInactive: true,
  });
  const existingCatalogSet = existingCatalogSets.find(
    (catalogSet) => catalogSet.sourceSetNumber === requestedSetNumber,
  );

  if (existingCatalogSet) {
    console.log(
      `[catalog-set-import] end status=already_present set_id=${existingCatalogSet.setId} slug=${existingCatalogSet.slug} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  const searchResults = await searchCatalogMissingSets({
    query: requestedSetNumber,
  });
  const matchingSearchResult = searchResults.find(
    (searchResult) => searchResult.sourceSetNumber === requestedSetNumber,
  );

  if (!matchingSearchResult) {
    throw new Error(
      `Catalog set ${requestedSetNumber} was not found in the current add-set search source.`,
    );
  }

  const createdSet = await createCatalogSet({
    input: matchingSearchResult,
  });

  console.log(
    `[catalog-set-import] end status=created set_id=${createdSet.setId} slug=${createdSet.slug} primary_theme=${createdSet.theme} source_theme_id=${createdSet.sourceThemeId ?? 'none'} primary_theme_id=${createdSet.primaryThemeId ?? 'none'} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  console.error('[catalog-set-import] failed');

  if (error instanceof Error) {
    console.error(`[catalog-set-import] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
