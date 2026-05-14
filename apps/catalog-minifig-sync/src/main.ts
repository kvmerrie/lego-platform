import { runCatalogMinifigSync } from '@lego-platform/catalog/data-access-server';
import {
  buildSetDetailPath,
  cacheTags,
  getMissingRebrickableEnvKeys,
  getMissingServerSupabaseEnvKeys,
  hasRebrickableApiConfig,
  hasServerSupabaseConfig,
  productEmailEnvKeys,
  publicWebRevalidationEnvKeys,
} from '@lego-platform/shared/config';

function getSyncMode(argv: readonly string[]): 'check' | 'write' {
  const hasCheckFlag = argv.includes('--check');
  const hasWriteFlag = argv.includes('--write');

  if (hasCheckFlag && hasWriteFlag) {
    throw new Error('Use exactly one of --check or --write.');
  }

  return hasCheckFlag ? 'check' : 'write';
}

async function revalidateChangedSetPages({
  paths,
  reason,
  tags,
}: {
  paths: readonly string[];
  reason: string;
  tags: readonly string[];
}): Promise<{
  attempted: boolean;
  pathCount: number;
  skipped: boolean;
  tagCount: number;
}> {
  const webBaseUrl = process.env[productEmailEnvKeys.webBaseUrl]?.trim();
  const revalidationSecret =
    process.env[publicWebRevalidationEnvKeys.secret]?.trim();

  if (!webBaseUrl || !revalidationSecret) {
    return {
      attempted: false,
      pathCount: paths.length,
      skipped: true,
      tagCount: tags.length,
    };
  }

  const targetUrl = new URL('/api/revalidate', webBaseUrl);
  const response = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-revalidate-secret': revalidationSecret,
    },
    body: JSON.stringify({
      paths,
      reason,
      tags,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Catalog minifig public web revalidation failed with status ${response.status}.`,
    );
  }

  return {
    attempted: true,
    pathCount: paths.length,
    skipped: false,
    tagCount: tags.length,
  };
}

async function main() {
  const mode = getSyncMode(process.argv.slice(2));
  const startedAt = Date.now();

  console.log(`[catalog-minifig-sync] start mode=${mode}`);

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      `Catalog minifig sync requires Supabase server configuration. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  if (!hasRebrickableApiConfig()) {
    throw new Error(
      `Catalog minifig sync requires Rebrickable configuration. Missing: ${getMissingRebrickableEnvKeys().join(', ')}.`,
    );
  }

  const result = await runCatalogMinifigSync({
    mode,
  });

  if (mode === 'check' && (result.driftCount > 0 || result.failedSets > 0)) {
    throw new Error(
      `Catalog minifig summaries are stale or incomplete. drift_count=${result.driftCount} failed_sets=${result.failedSets}`,
    );
  }

  if (mode === 'write' && result.changedSetSlugs.length > 0) {
    const paths = result.changedSetSlugs.map((slug) =>
      buildSetDetailPath(slug),
    );
    const tags = [
      ...new Set(
        result.changedSetIds.flatMap((setId, index) => [
          cacheTags.set(setId),
          cacheTags.set(result.changedSetSlugs[index] ?? setId),
        ]),
      ),
    ];

    const revalidation = await revalidateChangedSetPages({
      paths,
      reason: 'catalog_minifig_sync',
      tags,
    });

    console.log(
      `[catalog-minifig-sync] revalidation attempted=${revalidation.attempted} skipped=${revalidation.skipped} paths=${revalidation.pathCount} tags=${revalidation.tagCount}`,
    );
  }

  console.log(
    `[catalog-minifig-sync] end mode=${mode} sets_checked=${result.setsChecked} summaries_upserted=${result.summariesUpserted} zero_minifig_sets=${result.zeroMinifigSets} drift_count=${result.driftCount} failed_sets=${result.failedSets} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const mode = getSyncMode(process.argv.slice(2));

  console.error(`[catalog-minifig-sync] failed mode=${mode}`);

  if (error instanceof Error) {
    console.error(`[catalog-minifig-sync] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
