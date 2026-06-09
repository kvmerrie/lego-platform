import {
  CATALOG_SET_IMAGES_BUCKET,
  copyCatalogSetImageMetadata,
  rewriteCatalogSetImagePublicUrls,
  syncCatalogSetImages,
} from '@lego-platform/catalog/data-access-server';
import {
  getMissingProductionSupabaseEnvKeys,
  getMissingStagingSupabaseEnvKeys,
  getMissingServerSupabaseEnvKeys,
  getProductionSupabaseConfig,
  getServerSupabaseConfig,
  getStagingSupabaseConfig,
  hasProductionSupabaseConfig,
  hasServerSupabaseConfig,
  hasStagingSupabaseConfig,
} from '@lego-platform/shared/config';
import { createSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

type MetadataTarget = 'production' | 'staging';
type CopyMetadataMode = 'production-to-staging';

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

export function parseMetadataTarget(argv: readonly string[]): MetadataTarget {
  const rawValue = getFlagValue({
    argv,
    flag: '--metadata-target',
  });

  if (!rawValue) {
    return 'staging';
  }

  if (rawValue === 'staging' || rawValue === 'production') {
    return rawValue;
  }

  throw new Error('Use --metadata-target=staging|production.');
}

export function parseCopyMetadataMode(
  argv: readonly string[],
): CopyMetadataMode | undefined {
  const rawValue = getFlagValue({
    argv,
    flag: '--copy-metadata',
  });

  if (!rawValue) {
    return undefined;
  }

  if (rawValue === 'production-to-staging') {
    return rawValue;
  }

  throw new Error('Use --copy-metadata production-to-staging.');
}

export function parseRefreshThumbnails(argv: readonly string[]): boolean {
  return hasBooleanFlag({
    argv,
    flag: '--refresh-thumbnails',
  });
}

export function parseRefreshSocial(argv: readonly string[]): boolean {
  return hasBooleanFlag({
    argv,
    flag: '--refresh-social',
  });
}

export function parseRefreshCard(argv: readonly string[]): boolean {
  return hasBooleanFlag({
    argv,
    flag: '--refresh-card',
  });
}

export function parseRefreshImageMetadata(argv: readonly string[]): boolean {
  return hasBooleanFlag({
    argv,
    flag: '--refresh-image-metadata',
  });
}

export function parseDebugDedupe(argv: readonly string[]): boolean {
  return hasBooleanFlag({
    argv,
    flag: '--debug-dedupe',
  });
}

export function parseRewritePublicUrls(argv: readonly string[]): boolean {
  return hasBooleanFlag({
    argv,
    flag: '--rewrite-public-urls',
  });
}

export function parseUploadRetries(
  argv: readonly string[],
): number | undefined {
  const rawValue = getFlagValue({
    argv,
    flag: '--upload-retries',
  });

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error('Use --upload-retries <non-negative-integer>.');
  }

  return parsedValue;
}

function describeSupabaseRef(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

function assertProductionStorageConfig() {
  if (!hasProductionSupabaseConfig()) {
    throw new Error(
      `Production Supabase config is required for canonical storage. Missing: ${getMissingProductionSupabaseEnvKeys().join(', ')}`,
    );
  }
}

function createMetadataSupabaseClient(target: MetadataTarget) {
  if (target === 'production') {
    if (!hasProductionSupabaseConfig()) {
      throw new Error(
        `Production Supabase metadata target is not configured. Missing: ${getMissingProductionSupabaseEnvKeys().join(', ')}`,
      );
    }

    return createSupabaseAdminClient(getProductionSupabaseConfig());
  }

  if (hasStagingSupabaseConfig()) {
    return createSupabaseAdminClient(getStagingSupabaseConfig());
  }

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      `Staging metadata target is not configured. Missing staging keys: ${getMissingStagingSupabaseEnvKeys().join(', ')}. Missing server keys: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  return createSupabaseAdminClient(getServerSupabaseConfig());
}

function readMetadataTargetUrl(target: MetadataTarget): string {
  if (target === 'production') {
    return getProductionSupabaseConfig().url;
  }

  if (hasStagingSupabaseConfig()) {
    return getStagingSupabaseConfig().url;
  }

  return getServerSupabaseConfig().url;
}

function createProductionStorageSupabaseClient() {
  assertProductionStorageConfig();

  return createSupabaseAdminClient(getProductionSupabaseConfig());
}

export function assertUnambiguousTargets({
  metadataTarget,
  metadataTargetUrl,
  storageTargetUrl,
}: {
  metadataTarget: MetadataTarget;
  metadataTargetUrl: string;
  storageTargetUrl: string;
}) {
  if (metadataTarget === 'staging' && metadataTargetUrl === storageTargetUrl) {
    throw new Error(
      'Refusing to use the same Supabase URL for staging metadata and production storage. Check SUPABASE_URL_STAGING/SUPABASE_URL_PRODUCTION.',
    );
  }
}

export async function main(argv = process.argv.slice(2)) {
  const startedAt = Date.now();
  const write = hasBooleanFlag({
    argv,
    flag: '--write',
  });
  const debugDedupe = parseDebugDedupe(argv);
  const explicitDryRun = hasBooleanFlag({
    argv,
    flag: '--dry-run',
  });

  if (write && explicitDryRun) {
    throw new Error('Use either --write or --dry-run, not both.');
  }

  if (write && debugDedupe) {
    throw new Error('--debug-dedupe is dry-run only.');
  }

  const limit = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--limit',
  });
  const concurrency = parseOptionalPositiveIntegerFlag({
    argv,
    flag: '--concurrency',
  });
  const setIds = parseOptionalCsvFlag({
    argv,
    flag: '--set-ids',
  });
  const missingOnly = hasBooleanFlag({
    argv,
    flag: '--missing-only',
  });
  const refreshFailed = hasBooleanFlag({
    argv,
    flag: '--refresh-failed',
  });
  const refreshImageMetadata = parseRefreshImageMetadata(argv);
  const refreshCard = parseRefreshCard(argv);
  const refreshSocial = parseRefreshSocial(argv);
  const refreshThumbnails = parseRefreshThumbnails(argv);
  const metadataTarget = parseMetadataTarget(argv);
  const copyMetadata = parseCopyMetadataMode(argv);
  const rewritePublicUrls = parseRewritePublicUrls(argv);
  const uploadRetryCount = parseUploadRetries(argv);
  const mode = write ? 'write' : 'dry-run';

  if (copyMetadata && rewritePublicUrls) {
    throw new Error('Use either --copy-metadata or --rewrite-public-urls.');
  }

  if (!rewritePublicUrls) {
    assertProductionStorageConfig();
  }

  const metadataTargetUrl = readMetadataTargetUrl(metadataTarget);
  const storageTargetUrl = rewritePublicUrls
    ? 'none'
    : getProductionSupabaseConfig().url;

  if (!rewritePublicUrls) {
    assertUnambiguousTargets({
      metadataTarget,
      metadataTargetUrl,
      storageTargetUrl,
    });
  }

  console.log(
    `[catalog-set-image-sync] start mode=${mode} metadata_target=${metadataTarget} metadata_url=${describeSupabaseRef(metadataTargetUrl)} storage_url=${rewritePublicUrls ? 'none' : describeSupabaseRef(storageTargetUrl)} bucket=${CATALOG_SET_IMAGES_BUCKET} limit=${limit ?? 0} set_ids=${setIds?.join(',') ?? 'none'} missing_only=${missingOnly} refresh_failed=${refreshFailed} refresh_image_metadata=${refreshImageMetadata} refresh_card=${refreshCard} refresh_social=${refreshSocial} refresh_thumbnails=${refreshThumbnails} debug_dedupe=${debugDedupe} concurrency=${concurrency ?? 0} upload_retries=${uploadRetryCount ?? 0} copy_metadata=${copyMetadata ?? 'none'} rewrite_public_urls=${rewritePublicUrls}`,
  );

  if (rewritePublicUrls) {
    const rewriteResult = await rewriteCatalogSetImagePublicUrls({
      dryRun: !write,
      setIds,
      supabaseClient: createMetadataSupabaseClient(metadataTarget),
    });

    console.log(
      `[catalog-set-image-sync] public-url-rewrite target=${metadataTarget} dry_run=${rewriteResult.dryRun} read_rows=${rewriteResult.readCount} rewritten_rows=${rewriteResult.rewrittenCount} skipped_rows=${rewriteResult.skippedCount} set_ids=${rewriteResult.setIds?.join(',') ?? 'all'}`,
    );
    console.log(JSON.stringify(rewriteResult, null, 2));
    console.log(
      `[catalog-set-image-sync] end status=${write ? 'public-urls-rewritten' : 'dry-run'} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  if (copyMetadata) {
    if (metadataTarget !== 'staging') {
      throw new Error(
        '--copy-metadata production-to-staging requires --metadata-target=staging or the default staging target.',
      );
    }

    const copyResult = await copyCatalogSetImageMetadata({
      dryRun: !write,
      setIds,
      sourceSupabaseClient: createProductionStorageSupabaseClient(),
      targetSupabaseClient: createMetadataSupabaseClient('staging'),
    });

    console.log(
      `[catalog-set-image-sync] metadata-copy source=production target=staging dry_run=${copyResult.dryRun} read_rows=${copyResult.readCount} copied_rows=${copyResult.copiedCount} skipped_rows=${copyResult.skippedCount} set_ids=${copyResult.setIds?.join(',') ?? 'all'}`,
    );
    console.log(JSON.stringify(copyResult, null, 2));
    console.log(
      `[catalog-set-image-sync] end status=${write ? 'metadata-copied' : 'dry-run'} duration_ms=${Date.now() - startedAt}`,
    );
    return;
  }

  const result = await syncCatalogSetImages({
    concurrency,
    debugDedupe,
    dryRun: !write,
    limit,
    metadataSupabaseClient: createMetadataSupabaseClient(metadataTarget),
    missingOnly,
    refreshImageMetadata,
    refreshFailed,
    refreshCard,
    refreshSocial,
    refreshThumbnails,
    setIds,
    storageSupabaseClient: createProductionStorageSupabaseClient(),
    uploadRetryCount,
  });

  console.log(
    `[catalog-set-image-sync] summary dry_run=${result.dryRun} selected_sets=${result.selectedSetCount} processed_sets=${result.processedSetCount} skipped_sets=${result.skippedSetCount} failed_sets=${result.failedSetCount} duplicate_sources=${result.duplicateSourceCount} exact_duplicates=${result.exactDuplicateCount} perceptual_duplicates=${result.perceptualDuplicateCount} failed_sources=${result.failedSourceCount} failed_variants=${result.failedVariantCount} orphan_thumbnail_rows=${result.orphanThumbnailRowCount} estimated_upload_bytes=${result.estimatedUploadBytes} uploaded_bytes=${result.uploadedBytes}`,
  );
  if (result.failedSourceSamples.length) {
    console.log(
      `[catalog-set-image-sync] failed_source_samples ${JSON.stringify(result.failedSourceSamples)}`,
    );
  }
  if (result.failedVariantSamples.length) {
    console.log(
      `[catalog-set-image-sync] failed_variant_samples ${JSON.stringify(result.failedVariantSamples)}`,
    );
  }
  if (result.dryRun && result.orphanThumbnailRows.length) {
    console.log(
      `[catalog-set-image-sync] orphan_thumbnail_rows ${JSON.stringify(result.orphanThumbnailRows)}`,
    );
  }
  console.log(
    `[catalog-set-image-sync] footprint avg_card_bytes=${result.footprintReport.byType.card.averageBytes} avg_hero_bytes=${result.footprintReport.byType.hero.averageBytes} avg_gallery_bytes=${result.footprintReport.byType.gallery.averageBytes} avg_social_bytes=${result.footprintReport.byType.social.averageBytes} avg_thumbnail_bytes=${result.footprintReport.byType.thumbnail.averageBytes} avg_bytes_per_set=${result.footprintReport.averageBytesPerSet} storage_gb_100=${result.footprintReport.projections.sets100.storageGb} storage_gb_1000=${result.footprintReport.projections.sets1000.storageGb} storage_gb_current_catalog=${result.footprintReport.projections.currentCatalog.storageGb} current_catalog_sets=${result.footprintReport.currentCatalogSetCount}`,
  );
  for (const audit of result.dedupeAudits) {
    console.log(
      `[catalog-set-image-sync] visible_gallery_order set_id=${audit.setId} ${audit.visibleGalleryOrder
        .map(
          (image, index) =>
            `${index + 1}:${image.slot}:${image.role}:${image.filename}`,
        )
        .join(' | ')}`,
    );
  }
  console.log(
    JSON.stringify(
      {
        bucket: result.bucket,
        dedupeAudits: result.dedupeAudits,
        debugDedupe: result.debugDedupe,
        dryRun: result.dryRun,
        estimatedStorageFootprintBytes: result.estimatedUploadBytes,
        footprintReport: result.footprintReport,
        duplicateGroups: result.duplicateGroups,
        heroSimilaritySuppressedCount: result.heroSimilaritySuppressedCount,
        orphanThumbnailRowCount: result.orphanThumbnailRowCount,
        orphanThumbnailRows: result.orphanThumbnailRows,
        roleCounts: result.roleCounts,
        samples: result.results.slice(0, 5).map((sample) => {
          const summary = {
            ...sample,
          };
          delete summary.dedupeAudit;

          return summary;
        }),
        suppressedImages: result.suppressedImages,
        uploadedBytes: result.uploadedBytes,
      },
      null,
      2,
    ),
  );
  console.log(
    `[catalog-set-image-sync] end status=${write ? 'uploaded' : 'dry-run'} duration_ms=${Date.now() - startedAt}`,
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('[catalog-set-image-sync] failed', error);
    process.exitCode = 1;
  });
}
