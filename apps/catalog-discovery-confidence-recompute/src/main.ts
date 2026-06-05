import { recomputeCatalogDiscoveryCandidateConfidence } from '@lego-platform/api/data-access-server';
import { preflightCatalogDiscoveryCandidates } from '@lego-platform/catalog/data-access-server';
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

function getLimit(argv: readonly string[]): number | undefined {
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

function hasFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

async function logDebugPreflight() {
  const preflight = await preflightCatalogDiscoveryCandidates();

  console.log('[catalog-discovery-confidence] debug preflight');
  console.log(
    `[catalog-discovery-confidence] debug table=${preflight.table} table_access_ok=${preflight.tableAccess.ok} table_count=${
      preflight.tableAccess.count ?? 'unknown'
    }`,
  );

  if (preflight.tableAccess.error) {
    console.log(
      `[catalog-discovery-confidence] debug table_access_error=${preflight.tableAccess.error}`,
    );
  }

  console.log(
    `[catalog-discovery-confidence] debug selected_columns=${preflight.selectedColumns.join(
      ',',
    )}`,
  );
  console.log(
    `[catalog-discovery-confidence] debug selected_column_probe_ok=${preflight.selectedColumnProbe.ok}`,
  );

  if (preflight.selectedColumnProbe.error) {
    console.log(
      `[catalog-discovery-confidence] debug selected_column_probe_error=${preflight.selectedColumnProbe.error}`,
    );
  }

  console.log(
    `[catalog-discovery-confidence] debug set_number_columns=${preflight.usedSetNumberColumns.join(
      ',',
    )}`,
  );
  console.log(
    `[catalog-discovery-confidence] debug operator_confidence_column_exists=${preflight.optionalStoredOperatorConfidenceColumn.exists}`,
  );

  if (preflight.optionalStoredOperatorConfidenceColumn.error) {
    console.log(
      `[catalog-discovery-confidence] debug operator_confidence_column_error=${preflight.optionalStoredOperatorConfidenceColumn.error}`,
    );
  }

  if (preflight.informationSchemaError) {
    console.log(
      `[catalog-discovery-confidence] debug information_schema_error=${preflight.informationSchemaError}`,
    );
  }

  if (preflight.missingColumns) {
    console.log(
      `[catalog-discovery-confidence] debug missing_columns=${
        preflight.missingColumns.join(',') || 'none'
      }`,
    );
  }

  console.log(
    `[catalog-discovery-confidence] debug status_counts=${JSON.stringify(
      preflight.statusCounts,
    )}`,
  );

  if (Object.keys(preflight.statusCountErrors).length > 0) {
    console.log(
      `[catalog-discovery-confidence] debug status_count_errors=${JSON.stringify(
        preflight.statusCountErrors,
      )}`,
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const debug = hasFlag({ argv, flag: '--debug' });

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to recompute discovery confidence.',
    );
  }

  console.log(
    `[catalog-discovery-confidence] start statuses=new,failed limit=${
      getFlagValue({ argv, flag: '--limit' }) ?? '500'
    } debug=${debug}`,
  );

  if (debug) {
    await logDebugPreflight();
  }

  const result = await recomputeCatalogDiscoveryCandidateConfidence({
    limit: getLimit(argv) ?? 500,
  });

  console.log(
    `[catalog-discovery-confidence] end processed=${result.processedCount} modified=${result.modifiedCount} skipped=${result.skippedCount} high=${result.highCount} medium=${result.mediumCount} low=${result.lowCount} duration_ms=${
      Date.now() - startedAt
    }`,
  );
}

main().catch((error) => {
  console.error('[catalog-discovery-confidence] failed');

  if (error instanceof Error) {
    console.error(`[catalog-discovery-confidence] error=${error.message}`);
    if (error.stack) {
      console.error(`[catalog-discovery-confidence] stack=${error.stack}`);
    }
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
