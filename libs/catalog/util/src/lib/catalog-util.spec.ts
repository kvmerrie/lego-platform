import { describe, expect, test } from 'vitest';
import {
  buildCatalogThemeBrowseId,
  buildCatalogSetSlug,
  createCatalogSetRecord,
  getCatalogProductSlug,
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

    expect(
      buildCatalogSetSlug('The Lord of the Rings: Barad-dûr', '10333'),
    ).toBe('the-lord-of-the-rings-barad-dur-10333');

    expect(buildCatalogSetSlug('Pokémon: Évoli & Friends!', '12345')).toBe(
      'pokemon-evoli-and-friends-12345',
    );

    expect(buildCatalogSetSlug('Hokusai - The Great Wave', '31208')).toBe(
      'hokusai-the-great-wave-31208',
    );
  });

  test('builds stable discover anchors for theme browsing', () => {
    expect(buildCatalogThemeBrowseId('Star Wars')).toBe('theme-star-wars');
    expect(buildCatalogThemeBrowseId('Harry Potter')).toBe(
      'theme-harry-potter',
    );
  });

  test('prefers product slug overrides when present', () => {
    const catalogSetRecord = createCatalogSetRecord({
      sourceSetNumber: '10316-1',
      name: 'Lord of the Rings: Rivendell',
      theme: 'Icons',
      releaseYear: 2023,
      pieces: 6181,
    });

    expect(
      getCatalogProductSlug({
        catalogSetRecord,
        catalogSetOverlay: {
          productSlug: 'rivendell-10316',
        },
      }),
    ).toBe('rivendell-10316');
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

  test('keeps diacritic-heavy seeded names readable in snapshot slugs', () => {
    expect(
      createCatalogSetRecord({
        sourceSetNumber: '10333-1',
        name: 'The Lord of the Rings: Barad-dûr',
        theme: 'Icons',
        releaseYear: 2024,
        pieces: 5478,
      }),
    ).toEqual({
      canonicalId: '10333',
      sourceSetNumber: '10333-1',
      slug: 'the-lord-of-the-rings-barad-dur-10333',
      name: 'The Lord of the Rings: Barad-dûr',
      theme: 'Icons',
      releaseYear: 2024,
      pieces: 5478,
      imageUrl: undefined,
    });
  });
});
