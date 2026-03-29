import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  type CatalogSnapshot,
  type CatalogSyncManifest,
  renderCatalogSnapshotModule,
  renderCatalogSyncManifestModule,
} from '@lego-platform/catalog/util';

const GENERATED_SNAPSHOT_PATH =
  'libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts';
const GENERATED_MANIFEST_PATH =
  'libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts';

export interface CatalogGeneratedArtifactPaths {
  manifestPath: string;
  snapshotPath: string;
}

export interface CatalogGeneratedArtifactCheckResult {
  isClean: boolean;
  manifestPath: string;
  snapshotPath: string;
  stalePaths: string[];
}

export interface ExistingCatalogGeneratedArtifacts {
  catalogSnapshot: CatalogSnapshot;
  catalogSyncManifest: CatalogSyncManifest;
}

export function getCatalogGeneratedArtifactPaths(
  workspaceRoot: string,
): CatalogGeneratedArtifactPaths {
  return {
    snapshotPath: resolve(workspaceRoot, GENERATED_SNAPSHOT_PATH),
    manifestPath: resolve(workspaceRoot, GENERATED_MANIFEST_PATH),
  };
}

async function readArtifactFile(
  artifactPath: string,
): Promise<string | undefined> {
  try {
    return await readFile(artifactPath, 'utf8');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return undefined;
    }

    throw error;
  }
}

function parseGeneratedArtifactPayload<T>({
  artifactPath,
  exportName,
  moduleSource,
}: {
  artifactPath: string;
  exportName: 'catalogSnapshot' | 'catalogSyncManifest';
  moduleSource: string;
}): T {
  const match = moduleSource.match(
    new RegExp(`export const ${exportName}: [^=]+ = ([\\s\\S]+);\\s*$`),
  );

  if (!match?.[1]) {
    throw new Error(
      `Unable to parse generated catalog artifact payload from ${artifactPath}.`,
    );
  }

  return JSON.parse(match[1]) as T;
}

export async function readCatalogGeneratedArtifacts({
  workspaceRoot,
}: {
  workspaceRoot: string;
}): Promise<ExistingCatalogGeneratedArtifacts | undefined> {
  const { manifestPath, snapshotPath } =
    getCatalogGeneratedArtifactPaths(workspaceRoot);
  const [currentSnapshotModule, currentManifestModule] = await Promise.all([
    readArtifactFile(snapshotPath),
    readArtifactFile(manifestPath),
  ]);

  if (!currentSnapshotModule || !currentManifestModule) {
    return undefined;
  }

  return {
    catalogSnapshot: parseGeneratedArtifactPayload<CatalogSnapshot>({
      artifactPath: snapshotPath,
      exportName: 'catalogSnapshot',
      moduleSource: currentSnapshotModule,
    }),
    catalogSyncManifest: parseGeneratedArtifactPayload<CatalogSyncManifest>({
      artifactPath: manifestPath,
      exportName: 'catalogSyncManifest',
      moduleSource: currentManifestModule,
    }),
  };
}

export async function checkCatalogGeneratedArtifacts({
  catalogSnapshot,
  catalogSyncManifest,
  workspaceRoot,
}: {
  catalogSnapshot: CatalogSnapshot;
  catalogSyncManifest: CatalogSyncManifest;
  workspaceRoot: string;
}): Promise<CatalogGeneratedArtifactCheckResult> {
  const { manifestPath, snapshotPath } =
    getCatalogGeneratedArtifactPaths(workspaceRoot);
  const nextSnapshotModule = renderCatalogSnapshotModule(catalogSnapshot);
  const nextManifestModule =
    renderCatalogSyncManifestModule(catalogSyncManifest);
  const [currentSnapshotModule, currentManifestModule] = await Promise.all([
    readArtifactFile(snapshotPath),
    readArtifactFile(manifestPath),
  ]);
  const stalePaths: string[] = [];

  if (currentSnapshotModule !== nextSnapshotModule) {
    stalePaths.push(snapshotPath);
  }

  if (currentManifestModule !== nextManifestModule) {
    stalePaths.push(manifestPath);
  }

  return {
    isClean: stalePaths.length === 0,
    manifestPath,
    snapshotPath,
    stalePaths,
  };
}

export async function writeCatalogGeneratedArtifacts({
  catalogSnapshot,
  catalogSyncManifest,
  workspaceRoot,
}: {
  catalogSnapshot: CatalogSnapshot;
  catalogSyncManifest: CatalogSyncManifest;
  workspaceRoot: string;
}): Promise<CatalogGeneratedArtifactCheckResult> {
  const artifactCheck = await checkCatalogGeneratedArtifacts({
    catalogSnapshot,
    catalogSyncManifest,
    workspaceRoot,
  });
  const nextSnapshotModule = renderCatalogSnapshotModule(catalogSnapshot);
  const nextManifestModule =
    renderCatalogSyncManifestModule(catalogSyncManifest);

  await mkdir(dirname(artifactCheck.snapshotPath), { recursive: true });

  if (artifactCheck.stalePaths.includes(artifactCheck.snapshotPath)) {
    await writeFile(artifactCheck.snapshotPath, nextSnapshotModule, 'utf8');
  }

  if (artifactCheck.stalePaths.includes(artifactCheck.manifestPath)) {
    await writeFile(artifactCheck.manifestPath, nextManifestModule, 'utf8');
  }

  return artifactCheck;
}
