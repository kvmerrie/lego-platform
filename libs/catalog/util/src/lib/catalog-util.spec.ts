import { describe, expect, test } from 'vitest';
import {
  buildCatalogSetSlug,
  createCatalogSetRecord,
  getCanonicalCatalogSetId,
} from './catalog-util';

describe('catalog snapshot helpers', () => {
  test('extracts canonical ids from source set numbers', () => {
    expect(getCanonicalCatalogSetId('10316-1')).toBe('10316');
    expect(getCanonicalCatalogSetId(' 21348-1 ')).toBe('21348');
  });

  test('builds stable slugs from product names and canonical ids', () => {
    expect(
      buildCatalogSetSlug("Dungeons & Dragons: Red Dragon's Tale", '21348'),
    ).toBe('dungeons-and-dragons-red-dragons-tale-21348');
  });

  test('normalizes seeded records into snapshot-ready catalog records', () => {
    expect(
      createCatalogSetRecord({
        sourceSetNumber: ' 76269-1 ',
        name: 'Avengers Tower',
        theme: ' Marvel ',
        releaseYear: 2023,
        pieces: 5201,
      }),
    ).toEqual({
      canonicalId: '76269',
      sourceSetNumber: '76269-1',
      slug: 'avengers-tower-76269',
      name: 'Avengers Tower',
      theme: 'Marvel',
      releaseYear: 2023,
      pieces: 5201,
      imageUrl: undefined,
    });
  });
});
