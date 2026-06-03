import type { CatalogDealPageSortKey } from '@lego-platform/catalog/data-access-web';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';

export interface DealCategoryRouteConfig {
  categorySlug: string;
  sortKey: CatalogDealPageSortKey;
}

export const dealCategoryRouteConfigs = [
  {
    categorySlug: 'grootste-kortingen',
    sortKey: 'largest-discount',
  },
  {
    categorySlug: 'prijs-per-steen',
    sortKey: 'price-per-brick',
  },
  {
    categorySlug: 'onder-50',
    sortKey: 'under-50',
  },
  {
    categorySlug: 'nieuwe-deals',
    sortKey: 'new-deals',
  },
  {
    categorySlug: 'onder-20',
    sortKey: 'under-20',
  },
  {
    categorySlug: 'premium',
    sortKey: 'premium-deals',
  },
] as const satisfies readonly DealCategoryRouteConfig[];

const categoryRouteConfigBySlug = new Map<string, DealCategoryRouteConfig>(
  dealCategoryRouteConfigs.map((config) => [config.categorySlug, config]),
);

const categoryRouteConfigBySortKey = new Map<
  CatalogDealPageSortKey,
  DealCategoryRouteConfig
>(dealCategoryRouteConfigs.map((config) => [config.sortKey, config]));

export const dealCategorySitemapPaths = [
  buildWebPath(webPathnames.deals),
  ...dealCategoryRouteConfigs.map((config) =>
    buildDealCategoryPath(config.categorySlug),
  ),
] as const;

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

export function buildDealCategoryPath(categorySlug: string): string {
  return `${buildWebPath(webPathnames.deals)}/${categorySlug}`;
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
