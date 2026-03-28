import { getCanonicalCatalogSetId } from '@lego-platform/catalog/util';

export const curatedCatalogSyncSetNumbers = [
  '10316-1',
  '21348-1',
  '76269-1',
  '10305-1',
  '21338-1',
] as const;

export const curatedHomepageFeaturedSetNumbers = [
  '10316-1',
  '21348-1',
  '76269-1',
] as const;

export function getCuratedHomepageFeaturedSetIds(): string[] {
  return curatedHomepageFeaturedSetNumbers.map(getCanonicalCatalogSetId);
}
