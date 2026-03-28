import {
  type CatalogSetRecord,
  type CatalogSnapshot,
  type CatalogSyncManifest,
  createCatalogSetRecord,
  getCanonicalCatalogSetId,
} from '@lego-platform/catalog/util';
import {
  curatedCatalogSyncSetNumbers,
  getCuratedHomepageFeaturedSetIds,
} from './catalog-sync-curation';
import {
  createRebrickableClient,
  type RebrickableClient,
} from './rebrickable-client';
import { writeCatalogGeneratedArtifacts } from './catalog-artifact-writer';

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

export interface BuildCatalogSyncArtifactsOptions {
  curatedSetNumbers?: readonly string[];
  now?: Date;
  rebrickableClient: RebrickableClient;
}

export interface RunCatalogSyncOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
  workspaceRoot: string;
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

  return {
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
}

export async function runCatalogSync({
  apiKey,
  baseUrl,
  fetchImpl,
  now,
  workspaceRoot,
}: RunCatalogSyncOptions): Promise<CatalogSyncArtifacts> {
  const rebrickableClient = createRebrickableClient({
    apiKey,
    baseUrl,
    fetchImpl,
  });
  const artifacts = await buildCatalogSyncArtifacts({
    now,
    rebrickableClient,
  });

  await writeCatalogGeneratedArtifacts({
    catalogSnapshot: artifacts.catalogSnapshot,
    catalogSyncManifest: artifacts.catalogSyncManifest,
    workspaceRoot,
  });

  return artifacts;
}

export function toHomepageFeaturedSetIds(
  sourceSetNumbers: readonly string[],
): string[] {
  return sourceSetNumbers.map(getCanonicalCatalogSetId);
}
