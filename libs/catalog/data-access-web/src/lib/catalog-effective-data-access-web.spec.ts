import {
  getCatalogThemePageBySlug,
  listHomepageThemeDirectoryItems,
  listHomepageThemeSpotlightItems,
  listCatalogThemePageSlugs,
} from '@lego-platform/catalog/data-access';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import { describe, expect, test } from 'vitest';

import {
  getCatalogThemePageBySlugWithOverlay,
  listHomepageThemeDirectoryItemsWithOverlay,
  listHomepageThemeSpotlightItemsWithOverlay,
  listCatalogSearchMatchesWithOverlay,
  listCatalogSearchSuggestionOverlaySetCards,
  listCatalogSetSlugsWithOverlay,
  listCatalogThemeDirectoryItemsWithOverlay,
  listCatalogThemePageSlugsWithOverlay,
  listDiscoverBrowseThemeGroupsWithOverlay,
} from './catalog-effective-data-access-web';

function createOverlaySet(
  overrides: Partial<{
    createdAt: string;
    imageUrl?: string;
    name: string;
    pieces: number;
    releaseYear: number;
    setId: string;
    slug: string;
    source: 'rebrickable';
    sourceSetNumber: string;
    status: 'active' | 'inactive';
    theme: string;
    updatedAt: string;
  }> = {},
) {
  return {
    createdAt: '2026-04-17T08:00:00.000Z',
    imageUrl: 'https://cdn.rebrickable.com/media/sets/72037-1/1000.jpg',
    name: 'Mario Kart - Mario & Standard Kart',
    pieces: 1972,
    releaseYear: 2025,
    setId: '72037',
    slug: 'mario-kart-mario-standard-kart-72037',
    source: 'rebrickable' as const,
    sourceSetNumber: '72037-1',
    status: 'active' as const,
    theme: 'Super Mario',
    updatedAt: '2026-04-17T08:00:00.000Z',
    ...overrides,
  };
}

describe('catalog effective data access web', () => {
  test('includes active overlay sets in public search matches', async () => {
    const overlaySet = createOverlaySet();

    const results = await listCatalogSearchMatchesWithOverlay({
      limit: 6,
      listCatalogOverlaySetsFn: async () => [overlaySet],
      query: '72037',
    });

    expect(results[0]?.setCard).toMatchObject({
      id: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
      theme: 'Super Mario',
    });
  });

  test('returns only active deduped overlay cards for shell search suggestions', async () => {
    const activeOverlaySet = createOverlaySet();
    const duplicateOverlaySet = createOverlaySet({
      createdAt: '2026-04-17T09:00:00.000Z',
      updatedAt: '2026-04-17T09:00:00.000Z',
    });
    const inactiveOverlaySet = createOverlaySet({
      name: 'Mario Kart - Luigi & Standard Kart',
      setId: '72038',
      slug: 'mario-kart-luigi-standard-kart-72038',
      sourceSetNumber: '72038-1',
      status: 'inactive',
    });

    const result = await listCatalogSearchSuggestionOverlaySetCards({
      listCatalogOverlaySetsFn: async () => [
        activeOverlaySet,
        duplicateOverlaySet,
        inactiveOverlaySet,
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
    });
  });

  test('merges overlay sets into existing theme pages', async () => {
    const snapshotThemePage = getCatalogThemePageBySlug('star-wars');

    expect(snapshotThemePage).toBeDefined();

    const result = await getCatalogThemePageBySlugWithOverlay({
      listCatalogOverlaySetsFn: async () => [
        createOverlaySet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/75399-1/1000.jpg',
          name: 'Rebel U-Wing Starfighter',
          pieces: 594,
          releaseYear: 2026,
          setId: '75399',
          slug: 'rebel-u-wing-starfighter-75399',
          sourceSetNumber: '75399-1',
          theme: 'Star Wars',
        }),
      ],
      slug: 'star-wars',
    });

    expect(result).toBeDefined();
    expect(result?.setCards[0]).toMatchObject({
      id: '75399',
      theme: 'Star Wars',
    });
    expect(result?.themeSnapshot.setCount).toBe(
      (snapshotThemePage?.themeSnapshot.setCount ?? 0) + 1,
    );
  });

  test('creates fallback theme directory and theme page entries for overlay-only themes', async () => {
    const overlaySet = createOverlaySet({
      name: 'Great Deku Tree 2-in-1',
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      sourceSetNumber: '77092-1',
      theme: 'The Legend of Zelda',
    });
    const overlayThemeSlug = buildCatalogThemeSlug(overlaySet.theme);

    const [themeDirectoryItems, themePageSlugs, themePage] = await Promise.all([
      listCatalogThemeDirectoryItemsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
      }),
      listCatalogThemePageSlugsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
      }),
      getCatalogThemePageBySlugWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
        slug: overlayThemeSlug,
      }),
    ]);

    expect(
      themeDirectoryItems.find(
        (themeDirectoryItem) =>
          themeDirectoryItem.themeSnapshot.slug === overlayThemeSlug,
      ),
    ).toMatchObject({
      themeSnapshot: {
        name: 'The Legend of Zelda',
        slug: overlayThemeSlug,
      },
    });
    expect(themePageSlugs).toContain(overlayThemeSlug);
    expect(themePage).toMatchObject({
      themeSnapshot: {
        name: 'The Legend of Zelda',
        slug: overlayThemeSlug,
      },
    });
    expect(themePage?.setCards[0]?.id).toBe('77092');
  });

  test('keeps the homepage theme rail lineup stable while merging overlay coverage into existing themes', async () => {
    const baselineHomepageThemeItems = listHomepageThemeDirectoryItems();
    const result = await listHomepageThemeDirectoryItemsWithOverlay({
      listCatalogOverlaySetsFn: async () => [
        createOverlaySet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10334-1/1000.jpg',
          name: 'Retro Radio',
          pieces: 906,
          releaseYear: 2026,
          setId: '10334',
          slug: 'retro-radio-10334',
          sourceSetNumber: '10334-1',
          theme: 'Icons',
        }),
      ],
    });

    expect(
      result.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    ).toEqual(
      baselineHomepageThemeItems.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    );
    expect(
      result.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Icons',
      )?.themeSnapshot.setCount,
    ).toBe(
      (baselineHomepageThemeItems.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Icons',
      )?.themeSnapshot.setCount ?? 0) + 1,
    );
  });

  test('keeps the homepage theme spotlight stable while merging overlay coverage into spotlight themes', async () => {
    const baselineHomepageThemeSpotlightItems =
      listHomepageThemeSpotlightItems();
    const result = await listHomepageThemeSpotlightItemsWithOverlay({
      listCatalogOverlaySetsFn: async () => [
        createOverlaySet({
          imageUrl: 'https://cdn.rebrickable.com/media/sets/10342-1/1000.jpg',
          name: 'Pretty Pink Flower Bouquet',
          pieces: 749,
          releaseYear: 2026,
          setId: '10342',
          slug: 'pretty-pink-flower-bouquet-10342',
          sourceSetNumber: '10342-1',
          theme: 'Botanicals',
        }),
      ],
    });

    expect(
      result.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    ).toEqual(
      baselineHomepageThemeSpotlightItems.map(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name,
      ),
    );
    expect(
      result.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Botanicals',
      )?.themeSnapshot.setCount,
    ).toBe(
      (baselineHomepageThemeSpotlightItems.find(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name === 'Botanicals',
      )?.themeSnapshot.setCount ?? 0) + 1,
    );
  });

  test('does not auto-promote overlay-only themes into the limited homepage theme rows', async () => {
    const overlayOnlyTheme = createOverlaySet({
      name: 'Great Deku Tree 2-in-1',
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      sourceSetNumber: '77092-1',
      theme: 'The Legend of Zelda',
    });
    const [homepageThemeItems, homepageThemeSpotlightItems] = await Promise.all(
      [
        listHomepageThemeDirectoryItemsWithOverlay({
          listCatalogOverlaySetsFn: async () => [overlayOnlyTheme],
        }),
        listHomepageThemeSpotlightItemsWithOverlay({
          listCatalogOverlaySetsFn: async () => [overlayOnlyTheme],
        }),
      ],
    );

    expect(
      homepageThemeItems.some(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name ===
          'The Legend of Zelda',
      ),
    ).toBe(false);
    expect(
      homepageThemeSpotlightItems.some(
        (catalogThemeDirectoryItem) =>
          catalogThemeDirectoryItem.themeSnapshot.name ===
          'The Legend of Zelda',
      ),
    ).toBe(false);
  });

  test('adds overlay sets to discover browse groups and set slugs', async () => {
    const overlaySet = createOverlaySet({
      imageUrl: 'https://cdn.rebrickable.com/media/sets/75399-1/1000.jpg',
      name: 'Rebel U-Wing Starfighter',
      pieces: 594,
      releaseYear: 2026,
      setId: '75399',
      slug: 'rebel-u-wing-starfighter-75399',
      sourceSetNumber: '75399-1',
      theme: 'Star Wars',
    });
    const baselineThemeSlugs = new Set(listCatalogThemePageSlugs());

    const [setSlugs, discoverThemeGroups] = await Promise.all([
      listCatalogSetSlugsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
      }),
      listDiscoverBrowseThemeGroupsWithOverlay({
        listCatalogOverlaySetsFn: async () => [overlaySet],
        setLimit: 12,
        themeLimit: 12,
      }),
    ]);

    expect(setSlugs).toContain('rebel-u-wing-starfighter-75399');
    expect(
      discoverThemeGroups
        .find(
          (catalogThemeGroup) =>
            catalogThemeGroup.slug === buildCatalogThemeSlug('Star Wars'),
        )
        ?.setCards.some((setCard) => setCard.id === '75399'),
    ).toBe(true);
    expect(baselineThemeSlugs.has(buildCatalogThemeSlug('Star Wars'))).toBe(
      true,
    );
  });
});
