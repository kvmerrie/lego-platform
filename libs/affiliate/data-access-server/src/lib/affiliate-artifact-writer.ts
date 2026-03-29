import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  type AffiliateOfferSnapshot,
  type AffiliateSyncManifest,
  renderAffiliateOfferSnapshotsModule,
  renderAffiliateSyncManifestModule,
} from '@lego-platform/affiliate/util';

const GENERATED_OFFERS_PATH =
  'libs/affiliate/data-access/src/lib/affiliate-offers.generated.ts';
const GENERATED_MANIFEST_PATH =
  'libs/affiliate/data-access/src/lib/affiliate-sync-manifest.generated.ts';

export interface AffiliateGeneratedArtifactPaths {
  manifestPath: string;
  offersPath: string;
}

export interface AffiliateGeneratedArtifactCheckResult
  extends AffiliateGeneratedArtifactPaths {
  isClean: boolean;
  stalePaths: string[];
}

export function getAffiliateGeneratedArtifactPaths(
  workspaceRoot: string,
): AffiliateGeneratedArtifactPaths {
  return {
    offersPath: resolve(workspaceRoot, GENERATED_OFFERS_PATH),
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

export async function checkAffiliateGeneratedArtifacts({
  affiliateOfferSnapshots,
  affiliateSyncManifest,
  workspaceRoot,
}: {
  affiliateOfferSnapshots: readonly AffiliateOfferSnapshot[];
  affiliateSyncManifest: AffiliateSyncManifest;
  workspaceRoot: string;
}): Promise<AffiliateGeneratedArtifactCheckResult> {
  const { manifestPath, offersPath } =
    getAffiliateGeneratedArtifactPaths(workspaceRoot);
  const nextOffersModule =
    renderAffiliateOfferSnapshotsModule(affiliateOfferSnapshots);
  const nextManifestModule =
    renderAffiliateSyncManifestModule(affiliateSyncManifest);
  const [currentOffersModule, currentManifestModule] = await Promise.all([
    readArtifactFile(offersPath),
    readArtifactFile(manifestPath),
  ]);
  const stalePaths: string[] = [];

  if (currentOffersModule !== nextOffersModule) {
    stalePaths.push(offersPath);
  }

  if (currentManifestModule !== nextManifestModule) {
    stalePaths.push(manifestPath);
  }

  return {
    isClean: stalePaths.length === 0,
    offersPath,
    manifestPath,
    stalePaths,
  };
}

export async function writeAffiliateGeneratedArtifacts({
  affiliateOfferSnapshots,
  affiliateSyncManifest,
  workspaceRoot,
}: {
  affiliateOfferSnapshots: readonly AffiliateOfferSnapshot[];
  affiliateSyncManifest: AffiliateSyncManifest;
  workspaceRoot: string;
}): Promise<AffiliateGeneratedArtifactCheckResult> {
  const artifactCheck = await checkAffiliateGeneratedArtifacts({
    affiliateOfferSnapshots,
    affiliateSyncManifest,
    workspaceRoot,
  });

  await mkdir(dirname(artifactCheck.offersPath), { recursive: true });

  if (artifactCheck.stalePaths.includes(artifactCheck.offersPath)) {
    await writeFile(
      artifactCheck.offersPath,
      renderAffiliateOfferSnapshotsModule(affiliateOfferSnapshots),
      'utf8',
    );
  }

  if (artifactCheck.stalePaths.includes(artifactCheck.manifestPath)) {
    await writeFile(
      artifactCheck.manifestPath,
      renderAffiliateSyncManifestModule(affiliateSyncManifest),
      'utf8',
    );
  }

  return artifactCheck;
}
