import { describe, expect, test } from 'vitest';
import {
  buildCatalogReleaseLabel,
  buildCatalogThemeSlug,
  buildCatalogSetSlug,
  createCatalogSetRecord,
  getCatalogThemeDisplayName,
  getCatalogThemeMutedTextColor,
  getCatalogThemeSurfaceTone,
  getCatalogThemeVisual,
  getCatalogProductSlug,
  getCanonicalCatalogSetId,
  getCatalogPrimaryTheme,
  listCatalogQuickFilterOptions,
  matchesCatalogQuickFilter,
  normalizeCatalogSetImages,
  normalizeCatalogQuickFilterKey,
  resolveCatalogReleaseDatePrecision,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
} from './catalog-util';

describe('catalog snapshot helpers', () => {
  test('extracts canonical ids from source set numbers', () => {
    expect(getCanonicalCatalogSetId('10316-1')).toBe('10316');
    expect(getCanonicalCatalogSetId(' 21348-1 ')).toBe('21348');
    expect(getCanonicalCatalogSetId('LEGO 42177 - 1')).toBe('42177');
    expect(getCanonicalCatalogSetId('42177')).toBe('42177');
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

  test('formats release labels without inventing fake day-level dates', () => {
    expect(
      buildCatalogReleaseLabel({
        now: new Date('2026-04-30T00:00:00.000Z'),
        releaseDate: '2026-05-01',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
      }),
    ).toEqual({
      label: 'Release',
      value: '1 mei 2026',
    });

    expect(
      buildCatalogReleaseLabel({
        now: new Date('2026-04-30T00:00:00.000Z'),
        releaseYear: 2026,
      }),
    ).toEqual({
      label: 'Release',
      value: 'Nieuw in 2026',
    });

    expect(
      buildCatalogReleaseLabel({
        now: new Date('2026-04-30T00:00:00.000Z'),
        releaseYear: 2025,
      }),
    ).toEqual({
      label: 'Release',
      value: 'Uitgebracht in 2025',
    });
  });

  test('keeps explicit release precision when a set already has an exact date', () => {
    const result = createCatalogSetRecord({
      imageUrl: 'https://images.example/21062.jpg',
      name: 'Trevifontein',
      pieces: 1880,
      releaseDate: '2026-05-01',
      releaseDatePrecision: 'day',
      releaseYear: 2026,
      sourceSetNumber: '21062-1',
      theme: 'Architecture',
    });

    expect(result.releaseDate).toBe('2026-05-01');
    expect(result.releaseDatePrecision).toBe('day');
    expect(
      resolveCatalogReleaseDatePrecision({
        releaseDate: result.releaseDate,
        releaseDatePrecision: result.releaseDatePrecision,
        releaseYear: result.releaseYear,
      }),
    ).toBe('day');
  });

  test('builds stable theme slugs for dedicated theme pages', () => {
    expect(buildCatalogThemeSlug('Star Wars')).toBe('star-wars');
    expect(buildCatalogThemeSlug('Harry Potter')).toBe('harry-potter');
    expect(buildCatalogThemeSlug('Ultimate Collector Series')).toBe(
      'star-wars',
    );
    expect(buildCatalogThemeSlug('Modular Buildings')).toBe('icons');
  });

  test('normalizes public theme display names from raw source labels', () => {
    expect(getCatalogThemeDisplayName('Super Heroes Marvel')).toBe('Marvel');
    expect(getCatalogThemeDisplayName('Super Heroes DC')).toBe('DC');
    expect(getCatalogThemeDisplayName('Ultimate Collector Series')).toBe(
      'Star Wars™',
    );
    expect(getCatalogThemeDisplayName('Modular Buildings')).toBe(
      'LEGO® Icons',
    );
    expect(getCatalogThemeDisplayName('LEGO Exclusive')).toBe('Other');
    expect(getCatalogThemeDisplayName('Lord of the Rings')).toBe(
      'Lord of the Rings™',
    );
    expect(getCatalogThemeDisplayName('Skylines')).toBe('Architecture');
    expect(
      getCatalogThemeDisplayName('Icons', {
        name: 'The Lord of the Rings: Barad-dur',
        setId: '10333',
        theme: 'Icons',
      }),
    ).toBe('Lord of the Rings™');
  });

  test('does not provide hardcoded theme presentation fallbacks', () => {
    expect(getCatalogThemeVisual('Star Wars')).toBeUndefined();
    expect(getCatalogThemeVisual('Animal Crossing')).toBeUndefined();
    expect(getCatalogThemeVisual('Unknown Theme')).toBeUndefined();
    expect(getCatalogThemeSurfaceTone('Star Wars')).toBe('light');
    expect(getCatalogThemeMutedTextColor('#ffffff')).toBe('#f4f7fb');
    expect(getCatalogThemeMutedTextColor('#171a22')).toBe('#425066');
  });

  test('resolves primary themes and secondary labels from external subthemes', () => {
    expect(
      resolveCatalogThemeIdentity({
        parentTheme: 'Disney',
        rawTheme: 'Toy Story',
      }),
    ).toEqual({
      primaryTheme: 'Disney',
      secondaryThemes: ['Toy Story'],
    });
    expect(
      resolveCatalogThemeIdentity({
        parentTheme: 'City',
        rawTheme: 'Advent',
      }),
    ).toEqual({
      primaryTheme: 'City',
      secondaryThemes: ['Advent'],
    });
    expect(
      resolveCatalogThemeIdentity({
        parentTheme: 'Licensed',
        rawTheme: 'Lord of the Rings',
      }),
    ).toEqual({
      primaryTheme: 'Lord of the Rings',
      secondaryThemes: [],
    });
    expect(
      resolveCatalogThemeIdentity({
        parentTheme: 'Architecture',
        rawTheme: 'Skylines',
      }),
    ).toEqual({
      primaryTheme: 'Architecture',
      secondaryThemes: ['Skylines'],
    });
    expect(
      resolveCatalogThemeIdentity({
        rawTheme: 'Skylines',
      }),
    ).toEqual({
      primaryTheme: 'Architecture',
      secondaryThemes: ['Skylines'],
    });
    expect(
      resolveCatalogThemeIdentity({
        parentTheme: 'Books',
        rawTheme: 'Activity Books with LEGO Parts',
      }),
    ).toEqual({
      primaryTheme: 'Books',
      secondaryThemes: ['Activity Books with LEGO Parts'],
    });
    expect(
      resolveCatalogThemeIdentity({
        rawTheme: 'Ultimate Collector Series',
      }),
    ).toEqual({
      primaryTheme: 'Star Wars',
      secondaryThemes: ['Ultimate Collector Series'],
    });
    expect(
      resolveCatalogThemeIdentity({
        rawTheme: 'Star Wars > Ultimate Collector Series',
      }),
    ).toEqual({
      primaryTheme: 'Star Wars',
      secondaryThemes: ['Ultimate Collector Series'],
    });
    expect(
      resolveCatalogThemeIdentity({
        rawTheme: 'Modular Buildings',
      }),
    ).toEqual({
      primaryTheme: 'Icons',
      secondaryThemes: ['Modular Buildings'],
    });
    expect(
      resolveCatalogThemeIdentity({
        rawTheme: 'LEGO Exclusive',
      }),
    ).toEqual({
      primaryTheme: 'Other',
      secondaryThemes: ['LEGO Exclusive'],
    });
    expect(
      resolveCatalogThemeIdentity({
        parentTheme: 'Marvel',
        rawTheme: 'Spider-Man',
      }),
    ).toEqual({
      primaryTheme: 'Marvel',
      secondaryThemes: ['Spider-Man'],
    });
    expect(
      resolveCatalogThemeIdentity({
        parentTheme: 'Super Heroes Marvel',
        rawTheme: 'Avengers',
      }),
    ).toEqual({
      primaryTheme: 'Marvel',
      secondaryThemes: ['Avengers'],
    });
    expect(
      resolveCatalogThemeIdentity({
        rawTheme: 'Batman',
      }),
    ).toEqual({
      primaryTheme: 'DC',
      secondaryThemes: ['Batman'],
    });
    expect(
      resolveCatalogThemeIdentity({
        rawTheme: 'LEGO Ideas and CUUSOO',
      }),
    ).toEqual({
      primaryTheme: 'Ideas',
      secondaryThemes: [],
    });
    expect(
      getCatalogPrimaryTheme({
        rawTheme: 'Ninjago',
      }),
    ).toBe('NINJAGO');
  });

  test('normalizes persisted theme joins onto canonical browse themes', () => {
    expect(
      resolveCatalogThemeIdentityFromPersistence({
        primaryThemeName: 'Modular Buildings',
        sourceThemeName: 'Modular Buildings',
      }),
    ).toEqual({
      primaryTheme: 'Icons',
      secondaryThemes: ['Modular Buildings'],
    });
    expect(
      resolveCatalogThemeIdentityFromPersistence({
        primaryThemeName: 'Super Heroes Marvel',
        sourceThemeName: 'Avengers',
      }),
    ).toEqual({
      primaryTheme: 'Marvel',
      secondaryThemes: ['Avengers'],
    });
    expect(
      resolveCatalogThemeIdentityFromPersistence({
        primaryThemeName: 'Super Heroes DC',
        sourceThemeName: 'Batman',
      }),
    ).toEqual({
      primaryTheme: 'DC',
      secondaryThemes: ['Batman'],
    });
    expect(
      resolveCatalogThemeIdentityFromPersistence({
        primaryThemeName: 'LEGO Exclusive',
      }),
    ).toEqual({
      primaryTheme: 'Other',
      secondaryThemes: ['LEGO Exclusive'],
    });
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

  test('normalizes mixed single and multi-image seeds into ordered gallery images', () => {
    expect(
      createCatalogSetRecord({
        sourceSetNumber: '10316-1',
        name: 'Lord of the Rings: Rivendell',
        theme: 'Icons',
        releaseYear: 2023,
        pieces: 6181,
        imageUrl: ' https://images.example/rivendell-main.jpg ',
        images: [
          'https://images.example/rivendell-side.jpg',
          {
            thumbnailUrl: 'https://images.example/rivendell-council-thumb.jpg',
            type: 'detail',
            url: 'https://images.example/rivendell-council.jpg',
          },
        ],
        primaryImage: 'https://images.example/rivendell-main.jpg',
      }),
    ).toEqual({
      canonicalId: '10316',
      sourceSetNumber: '10316-1',
      slug: 'lord-of-the-rings-rivendell-10316',
      name: 'Lord of the Rings: Rivendell',
      theme: 'Icons',
      releaseYear: 2023,
      pieces: 6181,
      imageUrl: 'https://images.example/rivendell-main.jpg',
      images: [
        {
          order: 0,
          type: 'hero',
          url: 'https://images.example/rivendell-main.jpg',
        },
        {
          order: 1,
          url: 'https://images.example/rivendell-side.jpg',
        },
        {
          order: 2,
          thumbnailUrl: 'https://images.example/rivendell-council-thumb.jpg',
          type: 'detail',
          url: 'https://images.example/rivendell-council.jpg',
        },
      ],
      primaryImage: 'https://images.example/rivendell-main.jpg',
    });
  });

  test('normalizes Brickhunt-owned set image URLs to path-only UI sources', () => {
    expect(
      normalizeCatalogSetImages({
        imageUrl:
          'https://www.brickhunt.nl/images/sets/10309/hero.webp?legacy=1',
        images: [
          {
            thumbnailUrl:
              'https://www.brickhunt.nl/images/sets/10309/thumbs/3.webp',
            type: 'detail',
            url: 'https://www.brickhunt.nl/images/sets/10309/gallery/3.webp',
          },
          {
            type: 'detail',
            url: 'https://cdn.rebrickable.com/media/sets/10309-1/1000.jpg',
          },
        ],
        primaryImage:
          'https://ggqystcenwpbrjlkcmnt.supabase.co/storage/v1/object/public/catalog-set-images/sets/10309/hero.webp',
      }),
    ).toEqual({
      imageUrl: '/images/sets/10309/hero.webp',
      images: [
        {
          order: 0,
          type: 'hero',
          url: '/images/sets/10309/hero.webp',
        },
        {
          order: 1,
          thumbnailUrl: '/images/sets/10309/thumbs/3.webp',
          type: 'detail',
          url: '/images/sets/10309/gallery/3.webp',
        },
        {
          order: 2,
          type: 'detail',
          url: 'https://cdn.rebrickable.com/media/sets/10309-1/1000.jpg',
        },
      ],
      primaryImage: '/images/sets/10309/hero.webp',
    });
  });

  test('keeps set image dimensions while normalizing gallery images', () => {
    expect(
      normalizeCatalogSetImages({
        imageUrl: 'https://images.example/roses-main.jpg',
        images: [
          {
            height: 1200,
            order: 1,
            thumbnailUrl: 'https://images.example/roses-detail-thumb.jpg',
            type: 'detail',
            url: 'https://images.example/roses-detail.jpg',
            width: 800,
          },
        ],
        primaryImage: 'https://images.example/roses-main.jpg',
      }),
    ).toEqual({
      imageUrl: 'https://images.example/roses-main.jpg',
      images: [
        {
          order: 0,
          type: 'hero',
          url: 'https://images.example/roses-main.jpg',
        },
        {
          height: 1200,
          order: 1,
          thumbnailUrl: 'https://images.example/roses-detail-thumb.jpg',
          type: 'detail',
          url: 'https://images.example/roses-detail.jpg',
          width: 800,
        },
      ],
      primaryImage: 'https://images.example/roses-main.jpg',
    });
  });

  test('dedupes image URLs and prefers the explicit primary image first', () => {
    expect(
      normalizeCatalogSetImages({
        imageUrl: 'https://images.example/rivendell-hero.jpg',
        images: [
          {
            type: 'detail',
            url: 'https://images.example/rivendell-detail.jpg',
          },
          'https://images.example/rivendell-hero.jpg',
          {
            order: 9,
            type: 'hero',
            url: 'https://images.example/rivendell-hero.jpg',
          },
        ],
        primaryImage: 'https://images.example/rivendell-hero.jpg',
      }),
    ).toEqual({
      imageUrl: 'https://images.example/rivendell-hero.jpg',
      images: [
        {
          order: 0,
          type: 'hero',
          url: 'https://images.example/rivendell-hero.jpg',
        },
        {
          order: 1,
          type: 'detail',
          url: 'https://images.example/rivendell-detail.jpg',
        },
      ],
      primaryImage: 'https://images.example/rivendell-hero.jpg',
    });
  });

  test('normalizes quick-filter keys against the curated filter list', () => {
    expect(listCatalogQuickFilterOptions().map((option) => option.key)).toEqual(
      [
        'all',
        'best-deals',
        'with-minifigures',
        'star-wars',
        'harry-potter',
        'marvel',
        'icons',
      ],
    );
    expect(normalizeCatalogQuickFilterKey('marvel')).toBe('marvel');
    expect(normalizeCatalogQuickFilterKey('not-a-filter')).toBe('all');
    expect(normalizeCatalogQuickFilterKey(undefined)).toBe('all');
  });

  test('matches quick filters using deal, minifigure, and theme signals', () => {
    expect(
      matchesCatalogQuickFilter({
        filter: 'best-deals',
        setCard: {
          id: '76269',
          theme: 'Marvel',
          minifigureCount: 31,
          minifigureHighlights: ['Iron Man'],
        },
        strongDealSetIds: ['76269'],
      }),
    ).toBe(true);

    expect(
      matchesCatalogQuickFilter({
        filter: 'with-minifigures',
        setCard: {
          id: '10316',
          theme: 'Icons',
          minifigureHighlights: ['Elrond'],
        },
      }),
    ).toBe(true);

    expect(
      matchesCatalogQuickFilter({
        filter: 'star-wars',
        setCard: {
          id: '75355',
          theme: 'Star Wars',
        },
      }),
    ).toBe(true);

    expect(
      matchesCatalogQuickFilter({
        filter: 'harry-potter',
        setCard: {
          id: '76269',
          theme: 'Marvel',
        },
      }),
    ).toBe(false);
  });
});
