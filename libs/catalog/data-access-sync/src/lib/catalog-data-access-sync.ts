import {
  type CatalogSetOverlay,
  type CatalogSetRecord,
  type CatalogSnapshot,
  type CatalogSyncManifest,
  createCatalogSetRecord,
  getCatalogProductSlug,
  getCanonicalCatalogSetId,
} from '@lego-platform/catalog/util';
import { catalogSetOverlays } from '@lego-platform/catalog/data-access';
import {
  curatedCatalogSyncSetNumbers,
  getCuratedHomepageFeaturedSetIds,
} from './catalog-sync-curation';
import {
  createRebrickableClient,
  type RebrickableClient,
} from './rebrickable-client';
import {
  checkCatalogGeneratedArtifacts,
  type CatalogGeneratedArtifactCheckResult,
  readCatalogGeneratedArtifacts,
  writeCatalogGeneratedArtifacts,
} from './catalog-artifact-writer';

interface ValidatedRebrickableSet {
  imageUrl?: string;
  name: string;
  numParts: number;
  setNumber: string;
  themeId: number;
  year: number;
}

interface ValidatedRebrickableTheme {
  id: number;
  name: string;
}

export interface CatalogSyncArtifacts {
  catalogSnapshot: CatalogSnapshot;
  catalogSyncManifest: CatalogSyncManifest;
}

export interface CatalogSyncRunResult extends CatalogSyncArtifacts {
  artifactCheck: CatalogGeneratedArtifactCheckResult;
  mode: 'check' | 'write';
}

export interface BuildCatalogSyncArtifactsOptions {
  curatedSetNumbers?: readonly string[];
  now?: Date;
  rebrickableClient: RebrickableClient;
}

export interface RunCatalogSyncOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  mode?: 'check' | 'write';
  now?: Date;
  workspaceRoot: string;
}

function haveCatalogArtifactsChanged({
  currentCatalogSnapshot,
  currentCatalogSyncManifest,
  nextCatalogSnapshot,
  nextCatalogSyncManifest,
}: {
  currentCatalogSnapshot: CatalogSnapshot;
  currentCatalogSyncManifest: CatalogSyncManifest;
  nextCatalogSnapshot: CatalogSnapshot;
  nextCatalogSyncManifest: CatalogSyncManifest;
}): boolean {
  return (
    JSON.stringify({
      source: currentCatalogSnapshot.source,
      setRecords: currentCatalogSnapshot.setRecords,
    }) !==
      JSON.stringify({
        source: nextCatalogSnapshot.source,
        setRecords: nextCatalogSnapshot.setRecords,
      }) ||
    JSON.stringify({
      source: currentCatalogSyncManifest.source,
      recordCount: currentCatalogSyncManifest.recordCount,
      homepageFeaturedSetIds: currentCatalogSyncManifest.homepageFeaturedSetIds,
      notes: currentCatalogSyncManifest.notes,
    }) !==
      JSON.stringify({
        source: nextCatalogSyncManifest.source,
        recordCount: nextCatalogSyncManifest.recordCount,
        homepageFeaturedSetIds: nextCatalogSyncManifest.homepageFeaturedSetIds,
        notes: nextCatalogSyncManifest.notes,
      })
  );
}

function withCatalogGeneratedAt({
  artifacts,
  generatedAt,
}: {
  artifacts: CatalogSyncArtifacts;
  generatedAt: string;
}): CatalogSyncArtifacts {
  return {
    catalogSnapshot: {
      ...artifacts.catalogSnapshot,
      generatedAt,
    },
    catalogSyncManifest: {
      ...artifacts.catalogSyncManifest,
      generatedAt,
    },
  };
}

async function stabilizeCatalogGeneratedAt({
  catalogSnapshot,
  catalogSyncManifest,
  workspaceRoot,
}: {
  catalogSnapshot: CatalogSnapshot;
  catalogSyncManifest: CatalogSyncManifest;
  workspaceRoot: string;
}): Promise<CatalogSyncArtifacts> {
  const artifacts = {
    catalogSnapshot,
    catalogSyncManifest,
  };
  const currentArtifacts = await readCatalogGeneratedArtifacts({
    workspaceRoot,
  });

  if (!currentArtifacts) {
    return artifacts;
  }

  if (
    currentArtifacts.catalogSnapshot.generatedAt !==
    currentArtifacts.catalogSyncManifest.generatedAt
  ) {
    return artifacts;
  }

  if (
    haveCatalogArtifactsChanged({
      currentCatalogSnapshot: currentArtifacts.catalogSnapshot,
      currentCatalogSyncManifest: currentArtifacts.catalogSyncManifest,
      nextCatalogSnapshot: artifacts.catalogSnapshot,
      nextCatalogSyncManifest: artifacts.catalogSyncManifest,
    })
  ) {
    return artifacts;
  }

  return withCatalogGeneratedAt({
    artifacts,
    generatedAt: currentArtifacts.catalogSnapshot.generatedAt,
  });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function validateRebrickableSetPayload(
  payload: unknown,
  expectedSetNumber: string,
): ValidatedRebrickableSet {
  if (!isObjectRecord(payload)) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: expected an object.`,
    );
  }

  const {
    name,
    num_parts: numParts,
    set_img_url: setImgUrl,
    set_num: setNumber,
    theme_id: themeId,
    year,
  } = payload;

  if (typeof setNumber !== 'string' || setNumber.trim() !== expectedSetNumber) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: set_num is missing or mismatched.`,
    );
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: name is required.`,
    );
  }

  if (!isInteger(year) || year < 1940) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: year must be a valid integer.`,
    );
  }

  if (!isInteger(numParts) || numParts <= 0) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: num_parts must be a positive integer.`,
    );
  }

  if (!isInteger(themeId) || themeId <= 0) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: theme_id must be a positive integer.`,
    );
  }

  if (
    setImgUrl !== undefined &&
    setImgUrl !== null &&
    typeof setImgUrl !== 'string'
  ) {
    throw new Error(
      `Invalid Rebrickable set payload for ${expectedSetNumber}: set_img_url must be a string when present.`,
    );
  }

  return {
    setNumber,
    name: name.trim(),
    year,
    numParts,
    themeId,
    imageUrl:
      typeof setImgUrl === 'string' && setImgUrl.trim()
        ? setImgUrl.trim()
        : undefined,
  };
}

function validateRebrickableThemePayload(
  payload: unknown,
  expectedThemeId: number,
): ValidatedRebrickableTheme {
  if (!isObjectRecord(payload)) {
    throw new Error(
      `Invalid Rebrickable theme payload for ${expectedThemeId}: expected an object.`,
    );
  }

  const { id, name } = payload;

  if (!isInteger(id) || id !== expectedThemeId) {
    throw new Error(
      `Invalid Rebrickable theme payload for ${expectedThemeId}: id is missing or mismatched.`,
    );
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(
      `Invalid Rebrickable theme payload for ${expectedThemeId}: name is required.`,
    );
  }

  return {
    id,
    name: name.trim(),
  };
}

function mapRebrickableSetToCatalogSetRecord({
  rebrickableSet,
  themeName,
}: {
  rebrickableSet: ValidatedRebrickableSet;
  themeName: string;
}): CatalogSetRecord {
  return createCatalogSetRecord({
    sourceSetNumber: rebrickableSet.setNumber,
    name: rebrickableSet.name,
    theme: themeName,
    releaseYear: rebrickableSet.year,
    pieces: rebrickableSet.numParts,
    imageUrl: rebrickableSet.imageUrl,
  });
}

export function validateCatalogSyncArtifacts({
  catalogSnapshot,
  catalogSyncManifest,
  catalogSetOverlays: configuredCatalogSetOverlays = catalogSetOverlays,
}: CatalogSyncArtifacts & {
  catalogSetOverlays?: readonly CatalogSetOverlay[];
}): void {
  if (catalogSnapshot.setRecords.length === 0) {
    throw new Error('Catalog sync produced no set records.');
  }

  if (catalogSyncManifest.recordCount !== catalogSnapshot.setRecords.length) {
    throw new Error(
      'Catalog sync manifest recordCount does not match the snapshot record count.',
    );
  }

  const canonicalIds = new Set<string>();
  const productSlugs = new Set<string>();
  const sourceSetNumbers = new Set<string>();
  const slugs = new Set<string>();
  const catalogSetOverlayById = new Map(
    configuredCatalogSetOverlays.map((catalogSetOverlay) => [
      catalogSetOverlay.canonicalId,
      catalogSetOverlay,
    ]),
  );

  for (const catalogSetRecord of catalogSnapshot.setRecords) {
    const catalogSetOverlay = catalogSetOverlayById.get(
      catalogSetRecord.canonicalId,
    );

    if (!catalogSetOverlay) {
      throw new Error(
        `Missing product overlay for synced catalog set ${catalogSetRecord.canonicalId}.`,
      );
    }

    if (canonicalIds.has(catalogSetRecord.canonicalId)) {
      throw new Error(
        `Catalog sync produced a duplicate canonicalId: ${catalogSetRecord.canonicalId}.`,
      );
    }

    if (sourceSetNumbers.has(catalogSetRecord.sourceSetNumber)) {
      throw new Error(
        `Catalog sync produced a duplicate sourceSetNumber: ${catalogSetRecord.sourceSetNumber}.`,
      );
    }

    if (slugs.has(catalogSetRecord.slug)) {
      throw new Error(
        `Catalog sync produced a duplicate slug: ${catalogSetRecord.slug}.`,
      );
    }

    canonicalIds.add(catalogSetRecord.canonicalId);
    sourceSetNumbers.add(catalogSetRecord.sourceSetNumber);
    slugs.add(catalogSetRecord.slug);

    const productSlug = getCatalogProductSlug({
      catalogSetRecord,
      catalogSetOverlay,
    });

    if (productSlugs.has(productSlug)) {
      throw new Error(
        `Catalog sync produced a duplicate product slug: ${productSlug}.`,
      );
    }

    productSlugs.add(productSlug);
  }

  for (const homepageFeaturedSetId of catalogSyncManifest.homepageFeaturedSetIds) {
    if (!canonicalIds.has(homepageFeaturedSetId)) {
      throw new Error(
        `Homepage featured set ${homepageFeaturedSetId} is missing from the generated catalog snapshot.`,
      );
    }
  }
}

export async function buildCatalogSyncArtifacts({
  curatedSetNumbers = curatedCatalogSyncSetNumbers,
  now = new Date(),
  rebrickableClient,
}: BuildCatalogSyncArtifactsOptions): Promise<CatalogSyncArtifacts> {
  const themeNameById = new Map<number, string>();
  const setRecords: CatalogSetRecord[] = [];

  for (const curatedSetNumber of curatedSetNumbers) {
    const validatedSet = validateRebrickableSetPayload(
      await rebrickableClient.getSet(curatedSetNumber),
      curatedSetNumber,
    );

    let themeName = themeNameById.get(validatedSet.themeId);

    if (!themeName) {
      const validatedTheme = validateRebrickableThemePayload(
        await rebrickableClient.getTheme(validatedSet.themeId),
        validatedSet.themeId,
      );

      themeName = validatedTheme.name;
      themeNameById.set(validatedTheme.id, validatedTheme.name);
    }

    setRecords.push(
      mapRebrickableSetToCatalogSetRecord({
        rebrickableSet: validatedSet,
        themeName,
      }),
    );
  }

  const generatedAt = now.toISOString();

  const artifacts = {
    catalogSnapshot: {
      source: 'rebrickable-api-v3',
      generatedAt,
      setRecords,
    },
    catalogSyncManifest: {
      source: 'rebrickable-api-v3',
      generatedAt,
      recordCount: setRecords.length,
      homepageFeaturedSetIds: getCuratedHomepageFeaturedSetIds(),
      notes:
        'Generated from the curated Rebrickable sync scope. Collector-facing overlays remain local.',
    },
  };

  validateCatalogSyncArtifacts(artifacts);

  return artifacts;
}

export async function runCatalogSync({
  apiKey,
  baseUrl,
  fetchImpl,
  mode = 'write',
  now,
  workspaceRoot,
}: RunCatalogSyncOptions): Promise<CatalogSyncRunResult> {
  const rebrickableClient = createRebrickableClient({
    apiKey,
    baseUrl,
    fetchImpl,
  });
  const nextArtifacts = await buildCatalogSyncArtifacts({
    now,
    rebrickableClient,
  });
  const artifacts = await stabilizeCatalogGeneratedAt({
    ...nextArtifacts,
    workspaceRoot,
  });
  const artifactCheck =
    mode === 'check'
      ? await checkCatalogGeneratedArtifacts({
          catalogSnapshot: artifacts.catalogSnapshot,
          catalogSyncManifest: artifacts.catalogSyncManifest,
          workspaceRoot,
        })
      : await writeCatalogGeneratedArtifacts({
          catalogSnapshot: artifacts.catalogSnapshot,
          catalogSyncManifest: artifacts.catalogSyncManifest,
          workspaceRoot,
        });

  return {
    ...artifacts,
    artifactCheck,
    mode,
  };
}

export function toHomepageFeaturedSetIds(
  sourceSetNumbers: readonly string[],
): string[] {
  return sourceSetNumbers.map(getCanonicalCatalogSetId);
}
