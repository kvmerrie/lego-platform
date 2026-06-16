import { describe, expect, it } from 'vitest';
import {
  catalogDiscoveryVisualVariants,
  getCatalogCollectionLandingPageConfig,
  listIndexableCatalogCollectionLandingPageConfigs,
  listCatalogCollectionLandingPageConfigs,
  normalizeCatalogCollectionLandingPageSortKey,
} from './collection-landing-pages';

describe('collection landing page configs', () => {
  it('keeps first SEO landing pages declarative and routable', () => {
    const configs = listCatalogCollectionLandingPageConfigs();

    expect(configs.map((config) => config.slug)).toEqual([
      'sets',
      'lego-sets-onder-50-euro',
      'lego-sets-onder-100-euro',
      'nieuwe-lego-sets',
      'lego-voor-volwassenen',
      'lego-star-wars-sets',
      'retiring-lego-sets',
    ]);
    expect(
      configs.every(
        (config) =>
          config.canonicalPath === `/${config.slug}` ||
          config.canonicalPath === '/laatste-kans-lego-sets',
      ),
    ).toBe(true);
    expect(
      configs.every((config) => config.h1 && config.metaTitle && config.intro),
    ).toBe(true);
    expect(configs.every((config) => config.visual === undefined)).toBe(true);
    expect(getCatalogCollectionLandingPageConfig('lego-minifiguren')).toBe(
      undefined,
    );
    expect(
      getCatalogCollectionLandingPageConfig('collectible-minifigures'),
    ).toBe(undefined);
    expect(
      getCatalogCollectionLandingPageConfig('laatste-kans-lego-sets'),
    ).toMatchObject({
      canonicalPath: '/laatste-kans-lego-sets',
      h1: 'Laatste Kans LEGO Sets',
      metaDescription:
        'Deze LEGO sets gaan binnenkort uit productie. Vergelijk prijzen van verschillende winkels en koop jouw favoriete set voordat deze definitief verdwijnt.',
      metaTitle:
        'Laatste Kans LEGO Sets | Binnenkort uit productie | Brickhunt',
      slug: 'retiring-lego-sets',
    });
    expect(getCatalogCollectionLandingPageConfig('sets')).toMatchObject({
      canonicalPath: '/sets',
      h1: 'Alle LEGO sets',
      metaTitle: 'Alle LEGO sets | Brickhunt',
      slug: 'sets',
    });
  });

  it('keeps discovery colors dedicated to homepage tiles instead of collection heroes', () => {
    expect(
      getCatalogCollectionLandingPageConfig('nieuwe-lego-sets')?.visual,
    ).toBeUndefined();
    expect(
      getCatalogCollectionLandingPageConfig('lego-sets-onder-50-euro')?.visual,
    ).toBeUndefined();
    expect(
      getCatalogCollectionLandingPageConfig('retiring-lego-sets')?.visual,
    ).toBeUndefined();
  });

  it('uses vibrant dedicated discovery colors that do not reuse theme associations', () => {
    expect(catalogDiscoveryVisualVariants.newReleases).toEqual({
      backgroundColor: '#3aaee8',
    });
    expect(catalogDiscoveryVisualVariants.adultCollectors).toEqual({
      backgroundColor: '#08636f',
    });
    expect(catalogDiscoveryVisualVariants.under50).toEqual({
      backgroundColor: '#35b765',
    });
    expect(catalogDiscoveryVisualVariants.retiringSoon).toEqual({
      backgroundColor: '#f28c28',
    });
    expect(catalogDiscoveryVisualVariants.deals).toEqual({
      backgroundColor: '#00a99d',
    });
    expect(catalogDiscoveryVisualVariants.popularThemes).toEqual({
      backgroundColor: '#8758d8',
    });
    expect(Object.values(catalogDiscoveryVisualVariants)).not.toContainEqual({
      backgroundColor: '#5573b5',
    });
    expect(Object.values(catalogDiscoveryVisualVariants)).not.toContainEqual({
      backgroundColor: '#6bbf59',
    });
  });

  it('keeps pure theme duplicates out of the indexable collection set', () => {
    const indexableConfigs = listIndexableCatalogCollectionLandingPageConfigs();
    const starWarsConfig = getCatalogCollectionLandingPageConfig(
      'lego-star-wars-sets',
    );

    expect(indexableConfigs.map((config) => config.slug)).toEqual([
      'sets',
      'lego-sets-onder-50-euro',
      'lego-sets-onder-100-euro',
      'nieuwe-lego-sets',
      'lego-voor-volwassenen',
      'retiring-lego-sets',
    ]);
    expect(starWarsConfig?.redirectPath).toBe('/themes/star-wars');
  });

  it('normalizes unsupported sort values to the page default', () => {
    const config = getCatalogCollectionLandingPageConfig(
      'lego-sets-onder-50-euro',
    );

    if (!config) {
      throw new Error('Missing test config.');
    }

    expect(
      normalizeCatalogCollectionLandingPageSortKey({
        config,
        value: 'newest',
      }),
    ).toBe('newest');
    expect(
      normalizeCatalogCollectionLandingPageSortKey({
        config,
        value: 'discount',
      }),
    ).toBe('price-asc');
  });
});
