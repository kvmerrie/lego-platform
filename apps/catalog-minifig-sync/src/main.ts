import {
  DEFAULT_CATALOG_MINIFIG_SYNC_LIMIT,
  DEFAULT_REBRICKABLE_MINIFIG_MAX_RETRIES,
  DEFAULT_REBRICKABLE_MINIFIG_REQUEST_DELAY_MS,
  runCatalogMinifigSync,
} from '@lego-platform/catalog/data-access-server';
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

interface CatalogMinifigSyncCliOptions {
  afterSetId?: string;
  limit: number | null;
  maxRetries: number;
  onlyMissing: boolean;
  requestDelayMs: number;
  selectedSetIds?: readonly string[];
}

function readFlagValue({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: string;
}): string | undefined {
  const flagIndex = argv.indexOf(flag);

  if (flagIndex === -1) {
    return undefined;
  }

  const value = argv[flagIndex + 1]?.trim();

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function readNonNegativeIntegerFlag({
  argv,
  defaultValue,
  flag,
}: {
  argv: readonly string[];
  defaultValue: number;
  flag: string;
}): number {
  const value = readFlagValue({ argv, flag });

  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return parsedValue;
}

function parseSetIds(argv: readonly string[]): readonly string[] | undefined {
  const setIds = [
    ...(readFlagValue({ argv, flag: '--set-id' }) ?? '')
      .split(',')
      .map((setId) => setId.trim())
      .filter(Boolean),
    ...(readFlagValue({ argv, flag: '--set-ids' }) ?? '')
      .split(',')
      .map((setId) => setId.trim())
      .filter(Boolean),
  ];

  return setIds.length ? [...new Set(setIds)] : undefined;
}

function getCliOptions(argv: readonly string[]): CatalogMinifigSyncCliOptions {
  const hasAllFlag = argv.includes('--all');
  const limitFlagValue = readFlagValue({ argv, flag: '--limit' });

  if (hasAllFlag && limitFlagValue !== undefined) {
    throw new Error('Use either --all or --limit, not both.');
  }

  let limit: number | null = DEFAULT_CATALOG_MINIFIG_SYNC_LIMIT;

  if (hasAllFlag) {
    limit = null;
  } else if (limitFlagValue !== undefined) {
    const parsedLimit = Number(limitFlagValue);

    if (!Number.isInteger(parsedLimit) || parsedLimit < 0) {
      throw new Error('--limit must be a non-negative integer.');
    }

    limit = parsedLimit;
  }

  return {
    afterSetId: readFlagValue({ argv, flag: '--after-set-id' }),
    limit,
    maxRetries: readNonNegativeIntegerFlag({
      argv,
      defaultValue: DEFAULT_REBRICKABLE_MINIFIG_MAX_RETRIES,
      flag: '--max-retries',
    }),
    onlyMissing: argv.includes('--only-missing'),
    requestDelayMs: readNonNegativeIntegerFlag({
      argv,
      defaultValue: DEFAULT_REBRICKABLE_MINIFIG_REQUEST_DELAY_MS,
      flag: '--request-delay-ms',
    }),
    selectedSetIds: parseSetIds(argv),
  };
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
  const argv = process.argv.slice(2);
  const mode = getSyncMode(argv);
  const cliOptions = getCliOptions(argv);
  const startedAt = Date.now();

  console.log(
    `[catalog-minifig-sync] start mode=${mode} limit=${cliOptions.limit ?? 'all'} after_set_id=${cliOptions.afterSetId ?? 'none'} only_missing=${cliOptions.onlyMissing} selected_set_ids=${cliOptions.selectedSetIds?.length ?? 0} request_delay_ms=${cliOptions.requestDelayMs} max_retries=${cliOptions.maxRetries}`,
  );

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
    afterSetId: cliOptions.afterSetId,
    limit: cliOptions.limit,
    maxRetries: cliOptions.maxRetries,
    mode,
    onlyMissing: cliOptions.onlyMissing,
    requestDelayMs: cliOptions.requestDelayMs,
    selectedSetIds: cliOptions.selectedSetIds,
  });

  if (result.isPartial) {
    console.log(
      `[catalog-minifig-sync] partial=true processed_sets=${result.processedSets} next_after_set_id=${result.nextAfterSetId ?? 'none'} last_processed_set_id=${result.lastProcessedSetId ?? 'none'}`,
    );
  }

  if (mode === 'check' && (result.driftCount > 0 || result.failedSets > 0)) {
    throw new Error(
      `Catalog minifig summaries are stale or incomplete. drift_count=${result.driftCount} failed_sets=${result.failedSets} partial=${result.isPartial} next_after_set_id=${result.nextAfterSetId ?? 'none'}`,
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
    `[catalog-minifig-sync] end mode=${mode} limit=${result.limit ?? 'all'} processed_sets=${result.processedSets} sets_checked=${result.setsChecked} summaries_upserted=${result.summariesUpserted} zero_minifig_sets=${result.zeroMinifigSets} drift_count=${result.driftCount} failed_sets=${result.failedSets} rate_limit_count=${result.rateLimitCount} next_after_set_id=${result.nextAfterSetId ?? 'none'} duration_ms=${Date.now() - startedAt}`,
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
