import {
  CatalogSetSummary,
  CatalogThemeSnapshot,
  sortCatalogSetSummaries,
} from '@lego-platform/catalog/util';
import { catalogSetDetails, catalogThemeSnapshots } from './catalog-mock-data';

const HOMEPAGE_SET_LIMIT = 3;

function toCatalogSetSummary(catalogSetDetail: (typeof catalogSetDetails)[number]): CatalogSetSummary {
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

export function listHomepageSets(): CatalogSetSummary[] {
  return sortCatalogSetSummaries(
    catalogSetDetails.map(toCatalogSetSummary),
  ).slice(0, HOMEPAGE_SET_LIMIT);
}

export function listCatalogSetSlugs(): string[] {
  return catalogSetDetails.map((catalogSetDetail) => catalogSetDetail.slug);
}

export function getCatalogSetBySlug(slug: string) {
  return catalogSetDetails.find(
    (catalogSetDetail) => catalogSetDetail.slug === slug,
  );
}

export function listCatalogThemes(): CatalogThemeSnapshot[] {
  return [...catalogThemeSnapshots];
}
