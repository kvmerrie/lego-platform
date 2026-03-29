import { getCanonicalCatalogSetId } from '@lego-platform/catalog/util';

export const curatedCatalogSyncSetNumbers = [
  '10316-1',
  '21348-1',
  '76269-1',
  '10305-1',
  '21338-1',
  '10320-1',
  '21335-1',
  '10333-1',
  '10332-1',
  '10315-1',
  '21333-1',
  '21342-1',
] as const;

export const curatedHomepageFeaturedSetNumbers = [
  '10316-1',
  '21348-1',
  '76269-1',
] as const;

export function getCuratedHomepageFeaturedSetIds(): string[] {
  return curatedHomepageFeaturedSetNumbers.map(getCanonicalCatalogSetId);
}
