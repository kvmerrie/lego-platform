import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  type PricePanelSnapshot,
  type PricingObservation,
  type PricingSyncManifest,
  renderPricePanelSnapshotsModule,
  renderPricingObservationsModule,
  renderPricingSyncManifestModule,
} from '@lego-platform/pricing/util';

const GENERATED_OBSERVATIONS_PATH =
  'libs/pricing/data-access/src/lib/pricing-observations.generated.ts';
const GENERATED_PANEL_SNAPSHOTS_PATH =
  'libs/pricing/data-access/src/lib/price-panel-snapshots.generated.ts';
const GENERATED_MANIFEST_PATH =
  'libs/pricing/data-access/src/lib/pricing-sync-manifest.generated.ts';

export interface PricingGeneratedArtifactPaths {
  manifestPath: string;
  observationsPath: string;
  panelSnapshotsPath: string;
}

export interface PricingGeneratedArtifactCheckResult
  extends PricingGeneratedArtifactPaths {
  isClean: boolean;
  stalePaths: string[];
}

export function getPricingGeneratedArtifactPaths(
  workspaceRoot: string,
): PricingGeneratedArtifactPaths {
  return {
    observationsPath: resolve(workspaceRoot, GENERATED_OBSERVATIONS_PATH),
    panelSnapshotsPath: resolve(workspaceRoot, GENERATED_PANEL_SNAPSHOTS_PATH),
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

export async function checkPricingGeneratedArtifacts({
  pricePanelSnapshots,
  pricingObservations,
  pricingSyncManifest,
  workspaceRoot,
}: {
  pricePanelSnapshots: readonly PricePanelSnapshot[];
  pricingObservations: readonly PricingObservation[];
  pricingSyncManifest: PricingSyncManifest;
  workspaceRoot: string;
}): Promise<PricingGeneratedArtifactCheckResult> {
  const { manifestPath, observationsPath, panelSnapshotsPath } =
    getPricingGeneratedArtifactPaths(workspaceRoot);
  const nextObservationsModule =
    renderPricingObservationsModule(pricingObservations);
  const nextPanelSnapshotsModule =
    renderPricePanelSnapshotsModule(pricePanelSnapshots);
  const nextManifestModule =
    renderPricingSyncManifestModule(pricingSyncManifest);
  const [
    currentObservationsModule,
    currentPanelSnapshotsModule,
    currentManifestModule,
  ] = await Promise.all([
    readArtifactFile(observationsPath),
    readArtifactFile(panelSnapshotsPath),
    readArtifactFile(manifestPath),
  ]);
  const stalePaths: string[] = [];

  if (currentObservationsModule !== nextObservationsModule) {
    stalePaths.push(observationsPath);
  }

  if (currentPanelSnapshotsModule !== nextPanelSnapshotsModule) {
    stalePaths.push(panelSnapshotsPath);
  }

  if (currentManifestModule !== nextManifestModule) {
    stalePaths.push(manifestPath);
  }

  return {
    isClean: stalePaths.length === 0,
    observationsPath,
    panelSnapshotsPath,
    manifestPath,
    stalePaths,
  };
}

export async function writePricingGeneratedArtifacts({
  pricePanelSnapshots,
  pricingObservations,
  pricingSyncManifest,
  workspaceRoot,
}: {
  pricePanelSnapshots: readonly PricePanelSnapshot[];
  pricingObservations: readonly PricingObservation[];
  pricingSyncManifest: PricingSyncManifest;
  workspaceRoot: string;
}): Promise<PricingGeneratedArtifactCheckResult> {
  const artifactCheck = await checkPricingGeneratedArtifacts({
    pricePanelSnapshots,
    pricingObservations,
    pricingSyncManifest,
    workspaceRoot,
  });

  await mkdir(dirname(artifactCheck.observationsPath), { recursive: true });

  if (artifactCheck.stalePaths.includes(artifactCheck.observationsPath)) {
    await writeFile(
      artifactCheck.observationsPath,
      renderPricingObservationsModule(pricingObservations),
      'utf8',
    );
  }

  if (artifactCheck.stalePaths.includes(artifactCheck.panelSnapshotsPath)) {
    await writeFile(
      artifactCheck.panelSnapshotsPath,
      renderPricePanelSnapshotsModule(pricePanelSnapshots),
      'utf8',
    );
  }

  if (artifactCheck.stalePaths.includes(artifactCheck.manifestPath)) {
    await writeFile(
      artifactCheck.manifestPath,
      renderPricingSyncManifestModule(pricingSyncManifest),
      'utf8',
    );
  }

  return artifactCheck;
}
