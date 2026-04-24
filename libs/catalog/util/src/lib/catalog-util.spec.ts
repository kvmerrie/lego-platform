import { describe, expect, test } from 'vitest';
import {
  buildCatalogThemeSlug,
  buildCatalogSetSlug,
  createCatalogSetRecord,
  getCatalogThemeDisplayName,
  getCatalogThemeDefinition,
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
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
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
      'Star Wars',
    );
    expect(getCatalogThemeDisplayName('Modular Buildings')).toBe('Icons');
    expect(getCatalogThemeDisplayName('LEGO Exclusive')).toBe('Other');
  });

  test('returns curated theme visuals for recognizable theme surfaces', () => {
    expect(getCatalogThemeVisual('Star Wars')).toEqual({
      backgroundColor: '#5573b5',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75367-1/127838.jpg',
      textColor: '#ffffff',
    });
    expect(getCatalogThemeVisual('Architecture')).toEqual({
      backgroundColor: '#6f8594',
      textColor: '#ffffff',
    });
    expect(getCatalogThemeVisual('Modular Buildings')).toEqual({
      backgroundColor: '#f0c63b',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
      textColor: '#171a22',
    });
    expect(getCatalogThemeVisual('Ultimate Collector Series')).toEqual({
      backgroundColor: '#5573b5',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75367-1/127838.jpg',
      textColor: '#ffffff',
    });
    expect(getCatalogThemeDefinition('Ultimate Collector Series')).toEqual({
      name: 'Star Wars',
      slug: 'star-wars',
      visual: {
        backgroundColor: '#5573b5',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75367-1/127838.jpg',
        textColor: '#ffffff',
      },
    });
    expect(getCatalogThemeDefinition('Super Heroes Marvel')).toEqual({
      name: 'Marvel',
      slug: 'marvel',
      visual: {
        backgroundColor: '#cf554c',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg',
        textColor: '#ffffff',
      },
    });
    expect(getCatalogThemeVisual('Speed Champions')).toEqual({
      backgroundColor: '#3c5f96',
      textColor: '#ffffff',
    });
    expect(getCatalogThemeVisual('DC')).toEqual({
      backgroundColor: '#345d9d',
      textColor: '#ffffff',
    });
    expect(getCatalogThemeVisual('City')).toEqual({
      backgroundColor: '#2f7fc0',
      textColor: '#ffffff',
    });
    expect(getCatalogThemeVisual('The Legend of Zelda')).toEqual({
      backgroundColor: '#4d8b72',
      textColor: '#ffffff',
    });
    expect(getCatalogThemeVisual('Wednesday')).toEqual({
      backgroundColor: '#5d6170',
      textColor: '#ffffff',
    });
    expect(
      [
        'Brickheadz',
        'BrickLink Designer Program',
        'Classic',
        'Creator',
        'Dreamzzz',
        'Duplo',
        'Friends',
        'Minecraft',
        'Nike',
        'Pokémon',
        'Seasonal',
      ].every((themeName) => Boolean(getCatalogThemeVisual(themeName))),
    ).toBe(true);
    expect(getCatalogThemeSurfaceTone('Star Wars')).toBe('dark');
    expect(getCatalogThemeSurfaceTone('Icons')).toBe('light');
    expect(getCatalogThemeSurfaceTone('Speed Champions')).toBe('dark');
    expect(getCatalogThemeMutedTextColor('#ffffff')).toBe('#f4f7fb');
    expect(getCatalogThemeMutedTextColor('#171a22')).toBe('#425066');
    expect(getCatalogThemeVisual('Unknown Theme')).toBeUndefined();
  });

  test('resolves primary themes and secondary labels from external subthemes', () => {
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
          type: 'detail',
          url: 'https://images.example/rivendell-council.jpg',
        },
      ],
      primaryImage: 'https://images.example/rivendell-main.jpg',
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
