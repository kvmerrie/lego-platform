import { syncLocalRebrickableMirror } from '@lego-platform/catalog/data-access-server';
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

function getOptionalLimit(argv: readonly string[]): number | undefined {
  const value = getFlagValue({
    argv,
    flag: '--limit',
  });

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('--limit must be a positive integer.');
  }

  return parsed;
}

function assertModeFlags(argv: readonly string[]) {
  const modeCount = [
    argv.includes('--sets-only'),
    argv.includes('--themes-only'),
  ].filter(Boolean).length;

  if (modeCount > 1) {
    throw new Error('Use only one of --sets-only or --themes-only.');
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const dryRun = argv.includes('--dry-run');

  assertModeFlags(argv);

  if (!dryRun && !hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Rebrickable mirror sync.',
    );
  }

  console.log(
    `[rebrickable-mirror-sync] start dry_run=${dryRun} limit=${
      getFlagValue({ argv, flag: '--limit' }) ?? 'all'
    } sets_only=${argv.includes('--sets-only')} themes_only=${argv.includes(
      '--themes-only',
    )} source_dir=${
      getFlagValue({ argv, flag: '--source-dir' }) ?? 'none'
    } download_dir=${getFlagValue({ argv, flag: '--download-dir' }) ?? 'none'}`,
  );

  const result = await syncLocalRebrickableMirror({
    downloadDir: getFlagValue({
      argv,
      flag: '--download-dir',
    }),
    dryRun,
    limit: getOptionalLimit(argv),
    setsOnly: argv.includes('--sets-only'),
    sourceDir: getFlagValue({
      argv,
      flag: '--source-dir',
    }),
    themesOnly: argv.includes('--themes-only'),
  });

  if (result.themes) {
    console.log(
      `[rebrickable-mirror-sync] themes source_url=${JSON.stringify(
        result.themes.sourceUrl,
      )} source_updated_at=${
        result.themes.sourceUpdatedAt ?? 'unknown'
      } downloaded_rows=${result.themes.downloadedRows} parsed_rows=${
        result.themes.parsedRows
      } skipped_rows=${result.themes.skippedRows} upserted_rows=${
        result.themes.upsertedRows
      }`,
    );
  }

  if (result.sets) {
    console.log(
      `[rebrickable-mirror-sync] sets source_url=${JSON.stringify(
        result.sets.sourceUrl,
      )} source_updated_at=${
        result.sets.sourceUpdatedAt ?? 'unknown'
      } downloaded_rows=${result.sets.downloadedRows} parsed_rows=${
        result.sets.parsedRows
      } skipped_rows=${result.sets.skippedRows} upserted_rows=${
        result.sets.upsertedRows
      }`,
    );
  }

  console.log(
    `[rebrickable-mirror-sync] end dry_run=${result.dryRun} duration_ms=${
      Date.now() - startedAt
    } helper_duration_ms=${result.durationMs}`,
  );
}

main().catch((error) => {
  console.error('[rebrickable-mirror-sync] failed');

  if (error instanceof Error) {
    console.error(`[rebrickable-mirror-sync] error=${error.message}`);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
