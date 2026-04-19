import {
  buildCatalogCleanBootstrapPayload,
  importCatalogCleanBootstrapPayload,
  readCatalogCleanBootstrapPayload,
  verifyCatalogCleanBootstrapImport,
  writeCatalogCleanBootstrapPayload,
} from '@lego-platform/catalog/data-access-sync';
import { hasServerSupabaseConfig } from '@lego-platform/shared/config';

type CatalogBootstrapMode = 'export' | 'import' | 'verify';

function getFlagValue({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string {
  const flagIndex = argv.findIndex((argument) => argument === flag);
  const equalsStyleFlag = argv.find((argument) =>
    argument.startsWith(`${flag}=`),
  );

  if (equalsStyleFlag) {
    return equalsStyleFlag.slice(flag.length + 1).trim();
  }

  if (flagIndex >= 0) {
    return argv[flagIndex + 1]?.trim() ?? '';
  }

  return '';
}

function resolveMode(argv: readonly string[]): CatalogBootstrapMode {
  const modes = (
    [
      ['export', getFlagValue({ argv, flag: '--export' })],
      ['import', getFlagValue({ argv, flag: '--import' })],
      ['verify', getFlagValue({ argv, flag: '--verify' })],
    ] as const
  ).filter(([, value]) => Boolean(value));

  if (modes.length !== 1) {
    throw new Error(
      'Use exactly one of --export <output-path>, --import <input-path>, or --verify <input-path>.',
    );
  }

  return modes[0][0];
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = resolveMode(argv);

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for catalog bootstrap export/import/verify.',
    );
  }

  const startedAt = Date.now();

  if (mode === 'export') {
    const outputPath = getFlagValue({
      argv,
      flag: '--export',
    });

    console.log('[catalog-bootstrap] start mode=export');

    const payload = await buildCatalogCleanBootstrapPayload();
    const resolvedOutputPath = await writeCatalogCleanBootstrapPayload({
      outputPath,
      payload,
    });

    console.log(
      `[catalog-bootstrap] end mode=export status=written catalog_sets=${payload.catalog.sets.length} source_themes=${payload.catalog.sourceThemes.length} themes=${payload.catalog.themes.length} merchants=${payload.commerce.merchants.length} offer_seeds=${payload.commerce.offerSeeds.length} output_path=${resolvedOutputPath} duration_ms=${Date.now() - startedAt}`,
    );

    return;
  }

  const inputPath = getFlagValue({
    argv,
    flag: mode === 'import' ? '--import' : '--verify',
  });
  const payload = await readCatalogCleanBootstrapPayload({
    inputPath,
  });

  if (mode === 'import') {
    console.log(
      `[catalog-bootstrap] start mode=import input_path=${inputPath}`,
    );

    const summary = await importCatalogCleanBootstrapPayload({
      payload,
    });

    for (const step of summary.steps) {
      console.log(
        `[catalog-bootstrap] step mode=import table=${step.table} input_count=${step.inputCount} inserted_count=${step.insertedCount} updated_count=${step.updatedCount}`,
      );
    }

    console.log(
      `[catalog-bootstrap] end mode=import status=upserted input_path=${inputPath} duration_ms=${Date.now() - startedAt}`,
    );

    return;
  }

  console.log(`[catalog-bootstrap] start mode=verify input_path=${inputPath}`);

  const summary = await verifyCatalogCleanBootstrapImport({
    payload,
  });

  for (const step of summary.steps) {
    console.log(
      `[catalog-bootstrap] step mode=verify table=${step.table} expected_count=${step.expectedCount} matched_count=${step.matchedCount} missing_count=${step.missingKeys.length}`,
    );
  }

  if (!summary.isComplete) {
    const missingSummary = summary.steps
      .filter((step) => step.missingKeys.length > 0)
      .map(
        (step) =>
          `${step.table}: ${step.missingKeys.slice(0, 5).join(', ')}${step.missingKeys.length > 5 ? ', ...' : ''}`,
      )
      .join(' | ');

    throw new Error(
      `Bootstrap payload verification failed. Missing target rows: ${missingSummary}`,
    );
  }

  console.log(
    `[catalog-bootstrap] end mode=verify status=complete input_path=${inputPath} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const argv = process.argv.slice(2);
  const exportPath = getFlagValue({
    argv,
    flag: '--export',
  });
  const importPath = getFlagValue({
    argv,
    flag: '--import',
  });
  const mode: CatalogBootstrapMode = exportPath
    ? 'export'
    : importPath
      ? 'import'
      : 'verify';

  console.error(`[catalog-bootstrap] failed mode=${mode}`);

  if (error instanceof Error) {
    console.error(`[catalog-bootstrap] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
