import {
  type CatalogSetSeed,
  type CatalogSnapshot,
  createCatalogSetRecord,
} from '@lego-platform/catalog/util';

const seededCatalogSetSnapshot: readonly CatalogSetSeed[] = [
  {
    sourceSetNumber: '10316-1',
    name: 'Rivendell',
    theme: 'Icons',
    releaseYear: 2023,
    pieces: 6167,
  },
  {
    sourceSetNumber: '21348-1',
    name: "Dungeons & Dragons: Red Dragon's Tale",
    theme: 'Ideas',
    releaseYear: 2024,
    pieces: 3745,
  },
  {
    sourceSetNumber: '76269-1',
    name: 'Avengers Tower',
    theme: 'Marvel',
    releaseYear: 2023,
    pieces: 5201,
  },
];

export const catalogSnapshot: CatalogSnapshot = {
  source: 'seeded-catalog-snapshot',
  generatedAt: '2026-03-28T00:00:00.000Z',
  setRecords: seededCatalogSetSnapshot.map(createCatalogSetRecord),
};
