import {
  reEnrichCatalogSetsMissing,
  reEnrichImportedCatalogSets,
  type CatalogImportPipelineResult,
  type CatalogSetMissingEnrichmentScope,
} from '@lego-platform/api/data-access-server';
import { hasServerSupabaseConfig } from '@lego-platform/shared/config';

function getFlagValue({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string | undefined {
  const equalsStyleFlag = argv.find((argument) =>
    argument.startsWith(`${flag}=`),
  );

  if (equalsStyleFlag) {
    return equalsStyleFlag.slice(flag.length + 1);
  }

  const index = argv.indexOf(flag);

  return index >= 0 ? argv[index + 1] : undefined;
}

function hasFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

function getOptionalSetIds(argv: readonly string[]): readonly string[] {
  const rawSetIds = getFlagValue({
    argv,
    flag: '--set-ids',
  });

  if (!rawSetIds) {
    return [];
  }

  const setIds = [
    ...new Set(
      rawSetIds
        .split(',')
        .map((setId) => setId.trim())
        .filter(Boolean),
    ),
  ];

  if (!setIds.length) {
    throw new Error('--set-ids must include at least one set id.');
  }

  return setIds;
}

function getRequiredSetIds(argv: readonly string[]): readonly string[] {
  const setIds = getOptionalSetIds(argv);

  if (!setIds.length) {
    throw new Error('--set-ids is required, for example --set-ids 40519,10341');
  }

  return setIds;
}

function getOptionalPositiveInteger({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): number | undefined {
  const value = getFlagValue({
    argv,
    flag,
  });

  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    throw new Error(`${flag} must be a positive number.`);
  }

  return Math.floor(parsedValue);
}

function getMissingScopes(
  argv: readonly string[],
): readonly CatalogSetMissingEnrichmentScope[] | undefined {
  const rawMissingScopes = getFlagValue({
    argv,
    flag: '--missing',
  });

  if (!rawMissingScopes) {
    return undefined;
  }

  const allowedScopes = new Set<CatalogSetMissingEnrichmentScope>([
    'brickset',
    'minifigs',
    'source-metadata',
    'theme',
  ]);
  const scopes = rawMissingScopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  const unknownScopes = scopes.filter(
    (scope): scope is string =>
      !allowedScopes.has(scope as CatalogSetMissingEnrichmentScope),
  );

  if (unknownScopes.length > 0) {
    throw new Error(
      `--missing includes unknown scopes: ${unknownScopes.join(', ')}`,
    );
  }

  return [...new Set(scopes)] as CatalogSetMissingEnrichmentScope[];
}

function readRuntimeEnvironment(): string {
  return (
    process.env['APP_ENV'] ||
    process.env['BRICKHUNT_DEPLOY_ENV'] ||
    process.env['VERCEL_ENV'] ||
    process.env['NODE_ENV'] ||
    'development'
  )
    .trim()
    .toLowerCase();
}

function assertWritableStagingRuntime({ dryRun }: { dryRun: boolean }) {
  if (dryRun) {
    return;
  }

  const runtimeEnvironment = readRuntimeEnvironment();

  if (runtimeEnvironment === 'production' || runtimeEnvironment === 'prod') {
    throw new Error(
      'Refusing to re-enrich catalog sets in production runtime. Run against staging/admin DB or use --dry-run.',
    );
  }
}

function getResultCounts(results: readonly CatalogImportPipelineResult[]): {
  failedCount: number;
  successCount: number;
  warningCount: number;
} {
  let failedCount = 0;
  let successCount = 0;
  let warningCount = 0;

  for (const result of results) {
    const failed = Object.values(result.stages).some(
      (stage) => stage.status === 'failed',
    );

    if (failed) {
      failedCount += 1;
    } else if (result.warnings.length > 0) {
      warningCount += 1;
    } else {
      successCount += 1;
    }
  }

  return {
    failedCount,
    successCount,
    warningCount,
  };
}

function logSetResult(setResult: CatalogImportPipelineResult) {
  console.log(
    [
      '[catalog-set-re-enrich] set',
      `setId=${setResult.importedSetId}`,
      `bricksetStatus=${setResult.bricksetStatus}`,
      `minifigStatus=${setResult.minifigStatus}`,
      `themeStatus=${setResult.themeStatus}`,
      `sourceMetadataStatus=${setResult.sourceMetadataStatus ?? 'skipped'}`,
      `warnings=${JSON.stringify(setResult.warnings)}`,
    ].join(' '),
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const dryRun = hasFlag({
    argv,
    flag: '--dry-run',
  });
  const missingOnly = hasFlag({
    argv,
    flag: '--missing-only',
  });

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to re-enrich catalog sets.',
    );
  }

  assertWritableStagingRuntime({
    dryRun,
  });

  if (missingOnly) {
    const setIds = getOptionalSetIds(argv);
    const limit = getOptionalPositiveInteger({
      argv,
      flag: '--limit',
    });
    const batchSize = getOptionalPositiveInteger({
      argv,
      flag: '--batch-size',
    });
    const missing = getMissingScopes(argv);

    console.log(
      [
        '[catalog-set-re-enrich] start',
        'mode=missing',
        `set_ids=${setIds.length ? setIds.join(',') : 'all'}`,
        `dry_run=${dryRun}`,
        `limit=${limit ?? 'none'}`,
        `batch_size=${batchSize ?? 25}`,
        `missing=${missing?.join(',') ?? 'all'}`,
      ].join(' '),
    );

    const result = await reEnrichCatalogSetsMissing({
      batchSize,
      dryRun,
      limit,
      missing,
      setIds: setIds.length ? setIds : undefined,
    });

    console.log(
      [
        '[catalog-set-re-enrich] selection',
        `selected_count=${result.selectedCount}`,
        `skipped_count=${result.skippedCount}`,
        `reasons=${JSON.stringify(result.selection.reasonsBySetId)}`,
      ].join(' '),
    );

    for (const setResult of result.results) {
      logSetResult(setResult);
    }

    console.log(
      [
        '[catalog-set-re-enrich] end',
        `selected_count=${result.selectedCount}`,
        `skipped_count=${result.skippedCount}`,
        `success_count=${result.successCount}`,
        `warning_count=${result.warningCount}`,
        `failed_count=${result.failedCount}`,
        `duration_ms=${Date.now() - startedAt}`,
      ].join(' '),
    );
    return;
  }

  const setIds = getRequiredSetIds(argv);

  console.log(
    `[catalog-set-re-enrich] start set_ids=${setIds.join(',')} dry_run=${dryRun}`,
  );

  const result = await reEnrichImportedCatalogSets({
    dryRun,
    setIds,
  });
  const counts = getResultCounts(result.results);

  for (const setResult of result.results) {
    logSetResult(setResult);
  }

  console.log(
    [
      '[catalog-set-re-enrich] end',
      `selected_count=${result.results.length}`,
      'skipped_count=0',
      `success_count=${counts.successCount}`,
      `warning_count=${counts.warningCount}`,
      `failed_count=${counts.failedCount}`,
      `duration_ms=${Date.now() - startedAt}`,
    ].join(' '),
  );
}

main().catch((error) => {
  console.error('[catalog-set-re-enrich] failed');

  if (error instanceof Error) {
    console.error(`[catalog-set-re-enrich] error=${error.message}`);
    if (error.stack) {
      console.error(`[catalog-set-re-enrich] stack=${error.stack}`);
    }
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
