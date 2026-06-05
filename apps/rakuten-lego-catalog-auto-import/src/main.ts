import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  autoImportRakutenLegoCatalog,
  type RakutenLegoCatalogAutoImportOptions,
  type RakutenLegoCatalogAutoImportResult,
} from '@lego-platform/api/data-access-server';
import {
  getMissingServerSupabaseEnvKeys,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

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

function hasEnabledFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  const value = getFlagValue({ argv, flag });

  if (value) {
    return value !== 'false';
  }

  return argv.includes(flag);
}

function getOptionalPositiveInteger({
  argv,
  fallback,
  flag,
}: {
  argv: readonly string[];
  fallback?: number;
  flag: `--${string}`;
}): number | undefined {
  const value = getFlagValue({ argv, flag });

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    throw new Error(`${flag} must be a positive number.`);
  }

  return Math.floor(parsedValue);
}

function parseConfidenceFilter(
  argv: readonly string[],
): RakutenLegoCatalogAutoImportOptions['confidence'] {
  const rawConfidence = getFlagValue({
    argv,
    flag: '--confidence',
  });

  if (!rawConfidence) {
    return [];
  }

  const allowed = new Set(['high', 'medium', 'low']);
  const values = rawConfidence
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const unknownValues = values.filter((value) => !allowed.has(value));

  if (unknownValues.length > 0) {
    throw new Error(
      `--confidence includes unknown values: ${unknownValues.join(', ')}`,
    );
  }

  return [...new Set(values)] as NonNullable<
    RakutenLegoCatalogAutoImportOptions['confidence']
  >;
}

export function parseRakutenLegoCatalogAutoImportOptions(
  argv: readonly string[],
): RakutenLegoCatalogAutoImportOptions {
  return {
    allowAccessories:
      getFlagValue({ argv, flag: '--allow-accessories' }) !== 'false',
    autoPromote: hasEnabledFlag({
      argv,
      flag: '--auto-promote',
    }),
    concurrency: getOptionalPositiveInteger({
      argv,
      fallback: 1,
      flag: '--concurrency',
    }),
    confidence: parseConfidenceFilter(argv),
    dryRun: argv.includes('--dry-run'),
    limit: getOptionalPositiveInteger({
      argv,
      flag: '--limit',
    }),
    reportPath:
      getFlagValue({
        argv,
        flag: '--report-path',
      }) ?? 'tmp/rakuten-catalog-auto-import-report.json',
    source:
      getFlagValue({
        argv,
        flag: '--source',
      }) ?? 'rakuten-lego-eu',
  };
}

async function writeReport({
  path,
  report,
  stage,
}: {
  path: string;
  report: RakutenLegoCatalogAutoImportResult;
  stage: 'before_promote' | 'final';
}) {
  await mkdir(dirname(path), {
    recursive: true,
  });
  await writeFile(
    path,
    JSON.stringify(
      {
        stage,
        report,
      },
      null,
      2,
    ),
  );
  console.log(
    `[rakuten-lego-catalog-auto-import] report_written stage=${stage} path=${JSON.stringify(path)}`,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const options = parseRakutenLegoCatalogAutoImportOptions(argv);
  const startedAt = Date.now();

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      `Rakuten LEGO catalog auto-import requires Supabase server access. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  console.log(
    [
      '[rakuten-lego-catalog-auto-import] start',
      `dry_run=${options.dryRun === true}`,
      `auto_promote=${options.autoPromote === true}`,
      `allow_accessories=${options.allowAccessories !== false}`,
      `limit=${options.limit ?? 'all'}`,
      `source=${options.source ?? 'rakuten-lego-eu'}`,
      `confidence=${options.confidence?.join(',') || 'all'}`,
      `concurrency=${options.concurrency ?? 1}`,
      `report_path=${JSON.stringify(options.reportPath ?? '')}`,
    ].join(' '),
  );

  const report = await autoImportRakutenLegoCatalog({
    dependencies: {
      writeReportFn: writeReport,
    },
    options,
  });

  console.log(
    [
      '[rakuten-lego-catalog-auto-import] end',
      `feed_products_scanned=${report.feedProductsScanned}`,
      `missing_candidates=${report.missingCandidatesFound}`,
      `existing_catalog_matches=${report.existingCatalogMatches}`,
      `existing_candidate_hits=${report.existingCandidateHits}`,
      `candidates_imported=${report.candidatesImported.length}`,
      `candidates_skipped=${report.candidatesSkipped.length}`,
      `import_failures=${report.importFailures.length}`,
      `promoted=${report.promoted}`,
      `affected_themes=${report.promoteResult?.affectedThemeSlugs?.join(',') ?? 'none'}`,
      `revalidated_paths=${report.promoteResult?.revalidation?.pathCount ?? 0}`,
      `duration_ms=${Date.now() - startedAt}`,
    ].join(' '),
  );
}

main().catch((error) => {
  console.error('[rakuten-lego-catalog-auto-import] failed');

  if (error instanceof Error) {
    console.error(`[rakuten-lego-catalog-auto-import] error=${error.message}`);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
