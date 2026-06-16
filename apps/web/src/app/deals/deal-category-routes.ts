import type { CatalogDealPageSortKey } from '@lego-platform/catalog/data-access-web';
import {
  buildDealCategoryPath,
  buildWebPath,
  publicDealCategoryRouteConfigs,
  publicDealPathnames,
  webPathnames,
} from '@lego-platform/shared/config';

export { buildDealCategoryPath };

export interface DealCategoryRouteConfig {
  categorySlug: string;
  sortKey: CatalogDealPageSortKey;
}

export const dealCategoryRouteConfigs =
  publicDealCategoryRouteConfigs as readonly DealCategoryRouteConfig[];

const categoryRouteConfigBySlug = new Map<string, DealCategoryRouteConfig>(
  dealCategoryRouteConfigs.map((config) => [config.categorySlug, config]),
);

const categoryRouteConfigBySortKey = new Map<
  CatalogDealPageSortKey,
  DealCategoryRouteConfig
>(dealCategoryRouteConfigs.map((config) => [config.sortKey, config]));

export const dealCategorySitemapPaths = publicDealPathnames;

export function getCanonicalDealSortKey(
  sortKey: CatalogDealPageSortKey,
): CatalogDealPageSortKey {
  if (sortKey === 'discount-desc') {
    return 'largest-discount';
  }

  if (sortKey === 'best-price-per-brick') {
    return 'price-per-brick';
  }

  return sortKey;
}

export function getDealCategorySlugForSortKey(
  sortKey: CatalogDealPageSortKey,
): string | undefined {
  return categoryRouteConfigBySortKey.get(getCanonicalDealSortKey(sortKey))
    ?.categorySlug;
}

export function getDealSortKeyForCategorySlug(
  categorySlug: string,
): CatalogDealPageSortKey | undefined {
  return categoryRouteConfigBySlug.get(categorySlug)?.sortKey;
}

export function buildDealSortPath(sortKey: CatalogDealPageSortKey): string {
  const canonicalSortKey = getCanonicalDealSortKey(sortKey);

  if (canonicalSortKey === 'recommended') {
    return buildWebPath(webPathnames.deals);
  }

  const categorySlug = getDealCategorySlugForSortKey(canonicalSortKey);

  return categorySlug
    ? buildDealCategoryPath(categorySlug)
    : buildWebPath(webPathnames.deals);
}
