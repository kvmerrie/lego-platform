import {
  listCanonicalCatalogSets,
  upsertCatalogSetSourceMetadata,
  type CatalogSetSourceMetadataInput,
} from '@lego-platform/catalog/data-access-server';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';

const BRICKSET_API_BASE_URL = 'https://brickset.com/api/v3.asmx';
const BRICKSET_SOURCE = 'brickset';
const BRICKSET_LOCALE = 'en-US';
const BRICKSET_MATCH_CONFIDENCE = 'exact_set_number';
const BRICKSET_METADATA_POLICY = 'metadata_only_pending_rights_review';
const BRICKSET_DEFAULT_BATCH_SIZE = 100;

interface BricksetApiSetImage {
  imageURL?: string;
  thumbnailURL?: string;
}

interface BricksetApiMarketData {
  dateFirstAvailable?: string;
  dateLastAvailable?: string;
  retailPrice?: number;
}

interface BricksetApiSet {
  LEGOCom?: Record<string, BricksetApiMarketData | undefined>;
  additionalImageCount?: number;
  ageRange?: {
    max?: number;
    min?: number;
  };
  availability?: string;
  barcode?: {
    EAN?: string;
    UPC?: string;
  };
  bricksetURL?: string;
  category?: string;
  dimensions?: Record<string, number | undefined>;
  exitDate?: string;
  extendedData?: {
    description?: string;
    tags?: string[];
  };
  image?: BricksetApiSetImage;
  lastUpdated?: string;
  launchDate?: string;
  modelDimensions?: Record<string, number | undefined>;
  name?: string;
  number?: string;
  numberVariant?: number;
  pieces?: number;
  released?: boolean;
  setID?: number;
  subtheme?: string;
  theme?: string;
  themeGroup?: string;
  year?: number;
}

interface BricksetApiGetSetsResponse {
  matches?: number;
  message?: string;
  sets?: BricksetApiSet[];
  status: 'error' | 'success';
}

interface BricksetApiAdditionalImageResponse {
  additionalImages?: BricksetApiSetImage[];
  matches?: number;
  message?: string;
  status: 'error' | 'success';
}

export interface BricksetEnrichmentImageReference {
  attributionRequired: boolean;
  imageUrl: string;
  rightsPolicy: 'metadata_only_pending_rights_review';
  sourceField: 'additionalImages' | 'image.imageURL';
  sourceUrl?: string;
  thumbnailUrl?: string;
  type: 'additional' | 'primary';
}

export interface BricksetEnrichmentMetadataJson
  extends Readonly<Record<string, unknown>> {
  availability?: string;
  bricksetSetId: number;
  bricksetUrl?: string;
  category?: string;
  dateFirstAvailable?: string;
  dimensions?: Record<string, number>;
  ean?: string;
  exitDate?: string;
  imageRights: {
    attributionText: string;
    officialLegoImagesRequireFairPlayCompliance: boolean;
    policy: 'metadata_only_pending_rights_review';
    renderPublicly: false;
  };
  images: BricksetEnrichmentImageReference[];
  lastUpdated?: string;
  launchDate?: string;
  modelDimensions?: Record<string, number>;
  sourceSeen: true;
  subtheme?: string;
  tags?: string[];
  theme?: string;
  themeGroup?: string;
}

export interface BricksetEnrichmentRecord {
  catalogSetId: string;
  catalogSetName: string;
  metadataJson: BricksetEnrichmentMetadataJson;
  setNumber: string;
}

export interface BricksetEnrichmentSyncOptions {
  batchSize?: number;
  bricksetApiKey?: string;
  dryRun?: boolean;
  fetchFn?: typeof fetch;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  maxSets?: number;
  setNumbers?: readonly string[];
  upsertCatalogSetSourceMetadataFn?: typeof upsertCatalogSetSourceMetadata;
}

export interface BricksetEnrichmentSyncResult {
  additionalImageMatches: number;
  dryRun: boolean;
  fetchedSetCount: number;
  imageReferenceCount: number;
  matchedCatalogSetCount: number;
  metadataRecords: readonly BricksetEnrichmentRecord[];
  skippedMissingSetNumberCount: number;
  sourceMetadataUpsertedCount: number;
  unmatchedCatalogSets: readonly {
    name: string;
    setId: string;
    setNumber?: string;
  }[];
}

function normalizeBricksetDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function normalizeBricksetNumber(setNumber: string | undefined): string {
  return (setNumber ?? '').trim().toUpperCase();
}

function normalizeBricksetDimensionMap(
  value: Record<string, number | undefined> | undefined,
): Record<string, number> | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  );

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function firstDefinedDate(
  values: readonly (string | undefined)[],
): string | undefined {
  return values
    .map(normalizeBricksetDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
}

function resolveBricksetDateFirstAvailable(
  set: BricksetApiSet,
): string | undefined {
  const marketDates = Object.values(set.LEGOCom ?? {}).map(
    (market) => market?.dateFirstAvailable,
  );

  return firstDefinedDate(marketDates);
}

function toBricksetReturnedSetNumber(set: BricksetApiSet): string | undefined {
  if (!set.number || typeof set.numberVariant !== 'number') {
    return undefined;
  }

  return `${set.number}-${set.numberVariant}`;
}

async function postBricksetApi<TResponse>({
  apiKey,
  body,
  fetchFn,
  method,
}: {
  apiKey: string;
  body: Record<string, string>;
  fetchFn: typeof fetch;
  method: string;
}): Promise<TResponse> {
  const response = await fetchFn(`${BRICKSET_API_BASE_URL}/${method}`, {
    body: new URLSearchParams({
      apiKey,
      ...body,
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(
      `Brickset API ${method} failed with HTTP ${response.status}.`,
    );
  }

  return (await response.json()) as TResponse;
}

async function fetchBricksetSets({
  apiKey,
  fetchFn,
  setNumbers,
}: {
  apiKey: string;
  fetchFn: typeof fetch;
  setNumbers: readonly string[];
}): Promise<BricksetApiSet[]> {
  if (!setNumbers.length) {
    return [];
  }

  const response = await postBricksetApi<BricksetApiGetSetsResponse>({
    apiKey,
    body: {
      params: JSON.stringify({
        extendedData: 1,
        pageSize: 500,
        setNumber: setNumbers.join(','),
      }),
      userHash: '',
    },
    fetchFn,
    method: 'getSets',
  });

  if (response.status !== 'success') {
    throw new Error(
      `Brickset getSets failed: ${response.message ?? 'unknown error'}.`,
    );
  }

  return response.sets ?? [];
}

async function fetchBricksetAdditionalImages({
  apiKey,
  fetchFn,
  setId,
}: {
  apiKey: string;
  fetchFn: typeof fetch;
  setId: number;
}): Promise<BricksetApiSetImage[]> {
  const response = await postBricksetApi<BricksetApiAdditionalImageResponse>({
    apiKey,
    body: {
      setID: String(setId),
    },
    fetchFn,
    method: 'getAdditionalImages',
  });

  if (response.status !== 'success') {
    throw new Error(
      `Brickset getAdditionalImages failed: ${response.message ?? 'unknown error'}.`,
    );
  }

  return response.additionalImages ?? [];
}

function selectCatalogSetsForBricksetEnrichment({
  catalogSets,
  maxSets,
  setNumbers,
}: {
  catalogSets: readonly CatalogCanonicalSet[];
  maxSets?: number;
  setNumbers?: readonly string[];
}): CatalogCanonicalSet[] {
  const normalizedRequestedSetNumbers = new Set(
    (setNumbers ?? []).map(normalizeBricksetNumber).filter(Boolean),
  );

  const selectedCatalogSets = catalogSets.filter((catalogSet) => {
    if (!catalogSet.sourceSetNumber) {
      return false;
    }

    if (!normalizedRequestedSetNumbers.size) {
      return true;
    }

    return normalizedRequestedSetNumbers.has(
      normalizeBricksetNumber(catalogSet.sourceSetNumber),
    );
  });

  return typeof maxSets === 'number'
    ? selectedCatalogSets.slice(0, maxSets)
    : selectedCatalogSets;
}

function buildBricksetImageReferences({
  additionalImages,
  primaryImage,
  sourceUrl,
}: {
  additionalImages: readonly BricksetApiSetImage[];
  primaryImage?: BricksetApiSetImage;
  sourceUrl?: string;
}): BricksetEnrichmentImageReference[] {
  const imageReferences: BricksetEnrichmentImageReference[] = [];
  const seenImageUrls = new Set<string>();

  if (primaryImage?.imageURL) {
    seenImageUrls.add(primaryImage.imageURL);
    imageReferences.push({
      attributionRequired: false,
      imageUrl: primaryImage.imageURL,
      rightsPolicy: BRICKSET_METADATA_POLICY,
      sourceField: 'image.imageURL',
      sourceUrl,
      thumbnailUrl: primaryImage.thumbnailURL,
      type: 'primary',
    });
  }

  for (const image of additionalImages) {
    if (!image.imageURL || seenImageUrls.has(image.imageURL)) {
      continue;
    }

    seenImageUrls.add(image.imageURL);
    imageReferences.push({
      attributionRequired: true,
      imageUrl: image.imageURL,
      rightsPolicy: BRICKSET_METADATA_POLICY,
      sourceField: 'additionalImages',
      sourceUrl,
      thumbnailUrl: image.thumbnailURL,
      type: 'additional',
    });
  }

  return imageReferences;
}

function buildBricksetMetadataJson({
  additionalImages,
  set,
}: {
  additionalImages: readonly BricksetApiSetImage[];
  set: BricksetApiSet;
}): BricksetEnrichmentMetadataJson | undefined {
  if (typeof set.setID !== 'number') {
    return undefined;
  }

  const tags = (set.extendedData?.tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean);
  const metadataJson: BricksetEnrichmentMetadataJson = {
    bricksetSetId: set.setID,
    imageRights: {
      attributionText: 'Image(s) courtesy of Brickset.com',
      officialLegoImagesRequireFairPlayCompliance: true,
      policy: BRICKSET_METADATA_POLICY,
      renderPublicly: false,
    },
    images: buildBricksetImageReferences({
      additionalImages,
      primaryImage: set.image,
      sourceUrl: set.bricksetURL,
    }),
    sourceSeen: true,
    ...(set.availability ? { availability: set.availability } : {}),
    ...(set.bricksetURL ? { bricksetUrl: set.bricksetURL } : {}),
    ...(set.category ? { category: set.category } : {}),
    ...(normalizeBricksetDate(set.exitDate)
      ? { exitDate: normalizeBricksetDate(set.exitDate) }
      : {}),
    ...(resolveBricksetDateFirstAvailable(set)
      ? { dateFirstAvailable: resolveBricksetDateFirstAvailable(set) }
      : {}),
    ...(normalizeBricksetDate(set.launchDate)
      ? { launchDate: normalizeBricksetDate(set.launchDate) }
      : {}),
    ...(normalizeBricksetDate(set.lastUpdated)
      ? { lastUpdated: normalizeBricksetDate(set.lastUpdated) }
      : {}),
    ...(normalizeBricksetDimensionMap(set.dimensions)
      ? { dimensions: normalizeBricksetDimensionMap(set.dimensions) }
      : {}),
    ...(normalizeBricksetDimensionMap(set.modelDimensions)
      ? { modelDimensions: normalizeBricksetDimensionMap(set.modelDimensions) }
      : {}),
    ...(set.barcode?.EAN ? { ean: set.barcode.EAN } : {}),
    ...(set.subtheme ? { subtheme: set.subtheme } : {}),
    ...(tags.length ? { tags } : {}),
    ...(set.theme ? { theme: set.theme } : {}),
    ...(set.themeGroup ? { themeGroup: set.themeGroup } : {}),
  };

  return metadataJson;
}

function toCatalogSetSourceMetadataInput({
  now,
  record,
}: {
  now: Date;
  record: BricksetEnrichmentRecord;
}): CatalogSetSourceMetadataInput {
  return {
    catalogSetId: record.catalogSetId,
    lastSeenAt: now.toISOString(),
    locale: BRICKSET_LOCALE,
    matchConfidence: BRICKSET_MATCH_CONFIDENCE,
    metadataJson: record.metadataJson,
    policy: BRICKSET_METADATA_POLICY,
    setNumber: record.catalogSetId,
    source: BRICKSET_SOURCE,
  };
}

export async function syncBricksetEnrichmentMetadata({
  batchSize = BRICKSET_DEFAULT_BATCH_SIZE,
  bricksetApiKey = process.env.BRICKSET_API_KEY,
  dryRun = true,
  fetchFn = fetch,
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  maxSets,
  setNumbers,
  upsertCatalogSetSourceMetadataFn = upsertCatalogSetSourceMetadata,
}: BricksetEnrichmentSyncOptions = {}): Promise<BricksetEnrichmentSyncResult> {
  if (!bricksetApiKey?.trim()) {
    throw new Error('Brickset enrichment sync requires BRICKSET_API_KEY.');
  }

  const allCatalogSets = await listCanonicalCatalogSetsFn();
  const catalogSets = selectCatalogSetsForBricksetEnrichment({
    catalogSets: allCatalogSets,
    maxSets,
    setNumbers,
  });
  const catalogSetBySourceSetNumber = new Map(
    catalogSets.flatMap((catalogSet) =>
      catalogSet.sourceSetNumber
        ? [[normalizeBricksetNumber(catalogSet.sourceSetNumber), catalogSet]]
        : [],
    ),
  );
  const metadataRecords: BricksetEnrichmentRecord[] = [];
  let fetchedSetCount = 0;
  let additionalImageMatches = 0;

  for (let index = 0; index < catalogSets.length; index += batchSize) {
    const catalogSetChunk = catalogSets.slice(index, index + batchSize);
    const bricksetSets = await fetchBricksetSets({
      apiKey: bricksetApiKey,
      fetchFn,
      setNumbers: catalogSetChunk.flatMap((catalogSet) =>
        catalogSet.sourceSetNumber ? [catalogSet.sourceSetNumber] : [],
      ),
    });

    fetchedSetCount += bricksetSets.length;

    for (const bricksetSet of bricksetSets) {
      const returnedSetNumber = normalizeBricksetNumber(
        toBricksetReturnedSetNumber(bricksetSet),
      );
      const catalogSet = catalogSetBySourceSetNumber.get(returnedSetNumber);

      if (!catalogSet || typeof bricksetSet.setID !== 'number') {
        continue;
      }

      const additionalImages = await fetchBricksetAdditionalImages({
        apiKey: bricksetApiKey,
        fetchFn,
        setId: bricksetSet.setID,
      });
      const metadataJson = buildBricksetMetadataJson({
        additionalImages,
        set: bricksetSet,
      });

      if (!metadataJson) {
        continue;
      }

      additionalImageMatches += additionalImages.length;
      metadataRecords.push({
        catalogSetId: catalogSet.setId,
        catalogSetName: catalogSet.name,
        metadataJson,
        setNumber: catalogSet.sourceSetNumber ?? catalogSet.setId,
      });
    }
  }

  const matchedCatalogSetIds = new Set(
    metadataRecords.map((record) => record.catalogSetId),
  );
  const now = new Date();
  const sourceMetadataUpsertedCount = dryRun
    ? 0
    : await upsertCatalogSetSourceMetadataFn({
        inputs: metadataRecords.map((record) =>
          toCatalogSetSourceMetadataInput({
            now,
            record,
          }),
        ),
      });

  return {
    additionalImageMatches,
    dryRun,
    fetchedSetCount,
    imageReferenceCount: metadataRecords.reduce(
      (sum, record) => sum + record.metadataJson.images.length,
      0,
    ),
    matchedCatalogSetCount: metadataRecords.length,
    metadataRecords,
    skippedMissingSetNumberCount: allCatalogSets.filter(
      (catalogSet) => !catalogSet.sourceSetNumber,
    ).length,
    sourceMetadataUpsertedCount,
    unmatchedCatalogSets: catalogSets
      .filter((catalogSet) => !matchedCatalogSetIds.has(catalogSet.setId))
      .map((catalogSet) => ({
        name: catalogSet.name,
        setId: catalogSet.setId,
        setNumber: catalogSet.sourceSetNumber,
      })),
  };
}
