import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { syncBricksetEnrichmentMetadata } from '@lego-platform/api/data-access-server';

function getFlagValue({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string {
  const equalsStyleFlag = argv.find((argument) =>
    argument.startsWith(`${flag}=`),
  );

  if (equalsStyleFlag) {
    return equalsStyleFlag.slice(flag.length + 1).trim();
  }

  const flagIndex = argv.findIndex((argument) => argument === flag);

  return flagIndex >= 0 ? (argv[flagIndex + 1]?.trim() ?? '') : '';
}

function hasBooleanFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

function parseOptionalPositiveIntegerFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): number | undefined {
  const rawValue = getFlagValue({
    argv,
    flag,
  });

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Use ${flag} <positive-integer>.`);
  }

  return parsedValue;
}

function parseOptionalStringFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string | undefined {
  const rawValue = getFlagValue({
    argv,
    flag,
  });

  return rawValue ? rawValue : undefined;
}

function parseOptionalCsvFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string[] | undefined {
  const rawValue = getFlagValue({
    argv,
    flag,
  });

  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length ? values : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const write = hasBooleanFlag({
    argv,
    flag: '--write',
  });
  const maxSets = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--max-sets',
  });
  const batchSize = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--batch-size',
  });
  const reportPath = parseOptionalStringFlag({
    argv,
    flag: '--report-path',
  });
  const setNumbers = parseOptionalCsvFlag({
    argv,
    flag: '--set-numbers',
  });

  console.log(
    `[brickset-enrichment-sync] start source=brickset mode=${write ? 'write' : 'dry-run'} max_sets=${maxSets ?? 0} batch_size=${batchSize ?? 0} set_numbers=${setNumbers?.join(',') ?? 'none'} report_path=${JSON.stringify(reportPath ?? '')}`,
  );

  const result = await syncBricksetEnrichmentMetadata({
    batchSize,
    dryRun: !write,
    maxSets,
    setNumbers,
  });

  console.log(
    `[brickset-enrichment-sync] summary dry_run=${result.dryRun} fetched_sets=${result.fetchedSetCount} matched_catalog_sets=${result.matchedCatalogSetCount} unmatched_catalog_sets=${result.unmatchedCatalogSets.length} additional_image_matches=${result.additionalImageMatches} image_references=${result.imageReferenceCount} source_metadata_upserted=${result.sourceMetadataUpsertedCount}`,
  );

  console.log(
    JSON.stringify(
      {
        coverage: {
          additionalImageMatches: result.additionalImageMatches,
          fetchedSetCount: result.fetchedSetCount,
          imageReferenceCount: result.imageReferenceCount,
          matchedCatalogSetCount: result.matchedCatalogSetCount,
          sourceMetadataUpsertedCount: result.sourceMetadataUpsertedCount,
          unmatchedCatalogSetCount: result.unmatchedCatalogSets.length,
        },
        samples: result.metadataRecords.slice(0, 5).map((record) => ({
          bricksetSetId: record.metadataJson.bricksetSetId,
          catalogSetId: record.catalogSetId,
          catalogSetName: record.catalogSetName,
          dateFirstAvailable: record.metadataJson.dateFirstAvailable,
          ean: record.metadataJson.ean,
          exitDate: record.metadataJson.exitDate,
          imageReferenceCount: record.metadataJson.images.length,
          launchDate: record.metadataJson.launchDate,
          setNumber: record.setNumber,
          subtheme: record.metadataJson.subtheme,
          theme: record.metadataJson.theme,
        })),
        unmatchedCatalogSets: result.unmatchedCatalogSets.slice(0, 25),
      },
      null,
      2,
    ),
  );

  if (reportPath) {
    await mkdir(dirname(reportPath), {
      recursive: true,
    });
    await writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(
      `[brickset-enrichment-sync] report_written path=${JSON.stringify(reportPath)}`,
    );
  }

  console.log(
    `[brickset-enrichment-sync] end status=${write ? 'metadata-upserted' : 'dry-run'} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error: unknown) => {
  console.error('[brickset-enrichment-sync] failed', error);
  process.exitCode = 1;
});
