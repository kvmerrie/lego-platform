import { describe, expect, it } from 'vitest';
import {
  getCatalogCollectionLandingPageConfig,
  listIndexableCatalogCollectionLandingPageConfigs,
  listCatalogCollectionLandingPageConfigs,
  normalizeCatalogCollectionLandingPageSortKey,
} from './collection-landing-pages';

describe('collection landing page configs', () => {
  it('keeps first SEO landing pages declarative and routable', () => {
    const configs = listCatalogCollectionLandingPageConfigs();

    expect(configs.map((config) => config.slug)).toEqual([
      'lego-sets-onder-50-euro',
      'lego-sets-onder-100-euro',
      'nieuwe-lego-sets',
      'lego-voor-volwassenen',
      'lego-star-wars-sets',
      'retiring-lego-sets',
    ]);
    expect(
      configs.every((config) => config.canonicalPath === `/${config.slug}`),
    ).toBe(true);
    expect(
      configs.every((config) => config.h1 && config.metaTitle && config.intro),
    ).toBe(true);
    expect(configs.every((config) => config.visual?.backgroundColor)).toBe(
      true,
    );
  });

  it('uses stable discovery colors that match the theme visual palette', () => {
    expect(
      getCatalogCollectionLandingPageConfig('nieuwe-lego-sets')?.visual,
    ).toEqual({
      backgroundColor: '#5573b5',
      textColor: '#ffffff',
    });
    expect(
      getCatalogCollectionLandingPageConfig('lego-sets-onder-50-euro')?.visual,
    ).toEqual({
      backgroundColor: '#e0b84f',
      textColor: '#171a22',
    });
    expect(
      getCatalogCollectionLandingPageConfig('retiring-lego-sets')?.visual,
    ).toEqual({
      backgroundColor: '#d85a50',
      textColor: '#ffffff',
    });
  });

  it('keeps pure theme duplicates out of the indexable collection set', () => {
    const indexableConfigs = listIndexableCatalogCollectionLandingPageConfigs();
    const starWarsConfig = getCatalogCollectionLandingPageConfig(
      'lego-star-wars-sets',
    );

    expect(indexableConfigs.map((config) => config.slug)).toEqual([
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
