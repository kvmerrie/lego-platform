import {
  buildSetDetailPath,
  cacheTags,
  productEmailEnvKeys,
  publicWebRevalidationEnvKeys,
} from '@lego-platform/shared/config';

const MAX_REVALIDATION_PATHS = 25;
const MAX_REVALIDATION_TAGS = 100;
const REVALIDATION_BODY_EXCERPT_LIMIT = 500;

export interface CatalogMinifigRevalidationBatch {
  paths: readonly string[];
  reason: string;
  tags: readonly string[];
}

export interface CatalogMinifigRevalidationFailedBatch {
  bodyExcerpt?: string;
  pathCount: number;
  pathSample: readonly string[];
  status?: number;
  tagCount: number;
  tagSample: readonly string[];
}

export interface CatalogMinifigRevalidationResult {
  attempted: boolean;
  batchCount: number;
  failedBatches: readonly CatalogMinifigRevalidationFailedBatch[];
  pathCount: number;
  skipped: boolean;
  tagCount: number;
  warning?: string;
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isValidSetSlug(slug: string | undefined): slug is string {
  if (!slug?.trim()) {
    return false;
  }

  return !/[/?#]/u.test(slug.trim());
}

function chunkBatches(
  entries: readonly { path: string; tags: readonly string[] }[],
  reason: string,
): CatalogMinifigRevalidationBatch[] {
  const batches: CatalogMinifigRevalidationBatch[] = [];
  let currentPaths: string[] = [];
  let currentTags: string[] = [];

  for (const entry of entries) {
    const nextTags = dedupe([...currentTags, ...entry.tags]);
    const wouldExceedPathLimit =
      currentPaths.length + 1 > MAX_REVALIDATION_PATHS;
    const wouldExceedTagLimit = nextTags.length > MAX_REVALIDATION_TAGS;

    if (
      currentPaths.length > 0 &&
      (wouldExceedPathLimit || wouldExceedTagLimit)
    ) {
      batches.push({
        paths: currentPaths,
        reason,
        tags: currentTags,
      });
      currentPaths = [];
      currentTags = [];
    }

    currentPaths.push(entry.path);
    currentTags = dedupe([...currentTags, ...entry.tags]).slice(
      0,
      MAX_REVALIDATION_TAGS,
    );
  }

  if (currentPaths.length > 0 || currentTags.length > 0) {
    batches.push({
      paths: currentPaths,
      reason,
      tags: currentTags,
    });
  }

  return batches;
}

export function buildCatalogMinifigRevalidationBatches({
  changedSetIds,
  changedSetSlugs,
  reason,
}: {
  changedSetIds: readonly string[];
  changedSetSlugs: readonly string[];
  reason: string;
}): CatalogMinifigRevalidationBatch[] {
  const entries = changedSetSlugs.flatMap((slug, index) => {
    if (!isValidSetSlug(slug)) {
      return [];
    }

    const trimmedSlug = slug.trim();
    const setId = changedSetIds[index]?.trim();
    const tags = dedupe([
      ...(setId ? [cacheTags.set(setId)] : []),
      cacheTags.set(trimmedSlug),
    ]);

    return [
      {
        path: buildSetDetailPath(trimmedSlug),
        tags,
      },
    ];
  });

  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [entry.path, entry])).values(),
  );

  return chunkBatches(uniqueEntries, reason);
}

function getResponseBodyExcerpt(body: string): string | undefined {
  const normalizedBody = body.trim();

  return normalizedBody
    ? normalizedBody.slice(0, REVALIDATION_BODY_EXCERPT_LIMIT)
    : undefined;
}

export async function revalidateCatalogMinifigSetPages({
  changedSetIds,
  changedSetSlugs,
  fetchImpl = fetch,
  reason,
  strict = false,
}: {
  changedSetIds: readonly string[];
  changedSetSlugs: readonly string[];
  fetchImpl?: typeof fetch;
  reason: string;
  strict?: boolean;
}): Promise<CatalogMinifigRevalidationResult> {
  const batches = buildCatalogMinifigRevalidationBatches({
    changedSetIds,
    changedSetSlugs,
    reason,
  });
  const pathCount = batches.reduce(
    (count, batch) => count + batch.paths.length,
    0,
  );
  const tagCount = batches.reduce(
    (count, batch) => count + batch.tags.length,
    0,
  );

  const webBaseUrl = process.env[productEmailEnvKeys.webBaseUrl]?.trim();
  const revalidationSecret =
    process.env[publicWebRevalidationEnvKeys.secret]?.trim();

  if (!webBaseUrl || !revalidationSecret || batches.length === 0) {
    return {
      attempted: false,
      batchCount: batches.length,
      failedBatches: [],
      pathCount,
      skipped: true,
      tagCount,
    };
  }

  const targetUrl = new URL('/api/revalidate', webBaseUrl);
  const failedBatches: CatalogMinifigRevalidationFailedBatch[] = [];

  for (const batch of batches) {
    try {
      const response = await fetchImpl(targetUrl.toString(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': revalidationSecret,
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        failedBatches.push({
          bodyExcerpt: getResponseBodyExcerpt(await response.text()),
          pathCount: batch.paths.length,
          pathSample: batch.paths.slice(0, 5),
          status: response.status,
          tagCount: batch.tags.length,
          tagSample: batch.tags.slice(0, 8),
        });
      }
    } catch (error) {
      failedBatches.push({
        bodyExcerpt:
          error instanceof Error ? error.message : 'Unknown fetch failure.',
        pathCount: batch.paths.length,
        pathSample: batch.paths.slice(0, 5),
        tagCount: batch.tags.length,
        tagSample: batch.tags.slice(0, 8),
      });
    }
  }

  if (failedBatches.length > 0) {
    const warning = `Catalog minifig public web revalidation failed for ${failedBatches.length}/${batches.length} batch(es).`;

    if (strict) {
      throw new Error(warning);
    }

    return {
      attempted: true,
      batchCount: batches.length,
      failedBatches,
      pathCount,
      skipped: false,
      tagCount,
      warning,
    };
  }

  return {
    attempted: true,
    batchCount: batches.length,
    failedBatches,
    pathCount,
    skipped: false,
    tagCount,
  };
}
