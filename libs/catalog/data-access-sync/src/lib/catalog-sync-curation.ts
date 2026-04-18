import { getCanonicalCatalogSetId } from '@lego-platform/catalog/util';

// Transitional local scope only:
// this file no longer defines canonical catalog set identity.
// It only decides which canonical sets are still emitted into the generated
// snapshot during the migration period, plus which ids stay featured on the
// homepage manifest.

export const catalogSnapshotScopeSetNumbers = [
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
  '10318-1',
  '10331-1',
  '10341-1',
  '21349-1',
  '10300-1',
  '10294-1',
  '21061-1',
  '31208-1',
  '76419-1',
  '43222-1',
  '75313-1',
  '21345-1',
  '10326-1',
  '10323-1',
  '10306-1',
  '10280-1',
  '10311-1',
  '21327-1',
  '21343-1',
  '42115-1',
  '42143-1',
  '71411-1',
  '71741-1',
  '76218-1',
  '76956-1',
  '75331-1',
  '76417-1',
  '76178-1',
  '75367-1',
  '21350-1',
  '10317-1',
  '76437-1',
  '75355-1',
  '75397-1',
  '76429-1',
  '76435-1',
  '76294-1',
  '10335-1',
  '10327-1',
  '42171-1',
  '42172-1',
  '10328-1',
  '75398-1',
  '76453-1',
  '76313-1',
  '10354-1',
  '42177-1',
  '10342-1',
] as const;

export const homepageFeaturedSnapshotSetNumbers = [
  '10316-1',
  '10333-1',
  '21333-1',
] as const;

export function getHomepageFeaturedSnapshotSetIds(): string[] {
  return homepageFeaturedSnapshotSetNumbers.map(getCanonicalCatalogSetId);
}

// Backward-compatible aliases for existing callers during the migration.
export const curatedCatalogSyncSetNumbers = catalogSnapshotScopeSetNumbers;
export const curatedHomepageFeaturedSetNumbers =
  homepageFeaturedSnapshotSetNumbers;
export const getCuratedHomepageFeaturedSetIds =
  getHomepageFeaturedSnapshotSetIds;
