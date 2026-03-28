import {
  CatalogSetDetail,
  CatalogSetOverlay,
  CatalogSetRecord,
  CatalogSetSummary,
  CatalogThemeSnapshot,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import { catalogSetOverlays, catalogThemeOverlays } from './catalog-overlays';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

const HOMEPAGE_SET_LIMIT = 3;

const catalogSetOverlayById = new Map(
  catalogSetOverlays.map((catalogSetOverlay) => [
    catalogSetOverlay.canonicalId,
    catalogSetOverlay,
  ]),
);
const catalogSetRecordById = new Map(
  catalogSnapshot.setRecords.map((catalogSetRecord) => [
    catalogSetRecord.canonicalId,
    catalogSetRecord,
  ]),
);
const catalogSetRecordBySlug = new Map(
  catalogSnapshot.setRecords.map((catalogSetRecord) => [
    catalogSetRecord.slug,
    catalogSetRecord,
  ]),
);

function toCatalogSetSummary(catalogSetDetail: CatalogSetDetail): CatalogSetSummary {
  return {
    id: catalogSetDetail.id,
    slug: catalogSetDetail.slug,
    name: catalogSetDetail.name,
    theme: catalogSetDetail.theme,
    releaseYear: catalogSetDetail.releaseYear,
    pieces: catalogSetDetail.pieces,
    priceRange: catalogSetDetail.priceRange,
    collectorAngle: catalogSetDetail.collectorAngle,
  };
}

function requireCatalogSetOverlay(
  catalogSetRecord: CatalogSetRecord,
): CatalogSetOverlay {
  const catalogSetOverlay = catalogSetOverlayById.get(catalogSetRecord.canonicalId);

  if (!catalogSetOverlay) {
    throw new Error(
      `Missing collector overlay for catalog set ${catalogSetRecord.canonicalId}.`,
    );
  }

  return catalogSetOverlay;
}

function toCatalogSetDetail(catalogSetRecord: CatalogSetRecord): CatalogSetDetail {
  const catalogSetOverlay = requireCatalogSetOverlay(catalogSetRecord);

  return {
    id: catalogSetRecord.canonicalId,
    slug: catalogSetRecord.slug,
    name: catalogSetRecord.name,
    theme: catalogSetRecord.theme,
    releaseYear: catalogSetRecord.releaseYear,
    pieces: catalogSetRecord.pieces,
    priceRange: catalogSetOverlay.priceRange,
    collectorAngle: catalogSetOverlay.collectorAngle,
    tagline: catalogSetOverlay.tagline,
    availability: catalogSetOverlay.availability,
    collectorHighlights: [...catalogSetOverlay.collectorHighlights],
  };
}

function getCatalogSetDetailById(canonicalId: string): CatalogSetDetail {
  const catalogSetRecord = catalogSetRecordById.get(canonicalId);

  if (!catalogSetRecord) {
    throw new Error(
      `Missing catalog snapshot record for curated set ${canonicalId}.`,
    );
  }

  return toCatalogSetDetail(catalogSetRecord);
}

export function listCatalogSetSummaries(): CatalogSetSummary[] {
  return sortCatalogSetSummaries(
    catalogSnapshot.setRecords.map((catalogSetRecord) =>
      toCatalogSetSummary(toCatalogSetDetail(catalogSetRecord)),
    ),
  );
}

export function listHomepageSets(): CatalogSetSummary[] {
  return sortCatalogSetSummaries(
    catalogSyncManifest.homepageFeaturedSetIds
      .slice(0, HOMEPAGE_SET_LIMIT)
      .map((canonicalId) => toCatalogSetSummary(getCatalogSetDetailById(canonicalId))),
  ).slice(0, HOMEPAGE_SET_LIMIT);
}

export function listCatalogSetSlugs(): string[] {
  return catalogSnapshot.setRecords.map((catalogSetRecord) => catalogSetRecord.slug);
}

export function getCatalogSetBySlug(slug: string) {
  const catalogSetRecord = catalogSetRecordBySlug.get(slug);

  return catalogSetRecord ? toCatalogSetDetail(catalogSetRecord) : undefined;
}

export function listCatalogThemes(): CatalogThemeSnapshot[] {
  return catalogThemeOverlays.map((catalogThemeOverlay) => ({
    name: catalogThemeOverlay.name,
    setCount: catalogThemeOverlay.setCount,
    momentum: catalogThemeOverlay.momentum,
    signatureSet: catalogThemeOverlay.signatureSet,
  }));
}
