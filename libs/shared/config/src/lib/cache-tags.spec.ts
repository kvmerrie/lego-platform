import { describe, expect, test } from 'vitest';
import {
  buildCatalogSetDetailCacheTags,
  buildCatalogSetDetailRevalidationTarget,
  buildCatalogSetRevalidationTags,
  buildMerchantRevalidationTags,
  buildNewsRevalidationTags,
  buildPublicBrowseCollectionCacheTags,
  buildPublicBrowseThemeCacheTags,
  buildThemeRevalidationTags,
  cacheTags,
  isValidCacheTag,
  normalizeCacheTag,
  normalizeCacheTags,
} from './cache-tags';

describe('cache tags', () => {
  test('builds stable domain cache tags', () => {
    expect(cacheTags.catalog()).toBe('catalog');
    expect(cacheTags.sets()).toBe('sets');
    expect(cacheTags.set('Rivendell 10316')).toBe('set:rivendell-10316');
    expect(cacheTags.collections()).toBe('collections');
    expect(cacheTags.collection('LEGO sets onder €50')).toBe(
      'collection:lego-sets-onder-50',
    );
    expect(cacheTags.theme('Harry Potter')).toBe('theme:harry-potter');
    expect(cacheTags.merchantProducts('Coolblue')).toBe(
      'merchant-products:coolblue',
    );
    expect(cacheTags.pricesForMerchant('MediaMarkt')).toBe('prices:mediamarkt');
    expect(cacheTags.deals()).toBe('deals');
  });

  test('normalizes and deduplicates tags', () => {
    expect(
      normalizeCacheTags(['set:Rivendell 10316', 'set:rivendell-10316', '']),
    ).toEqual(['set:rivendell-10316']);
    expect(normalizeCacheTag('../bad tag')).toBe('bad-tag');
    expect(isValidCacheTag('set:rivendell-10316')).toBe(true);
    expect(isValidCacheTag('/sets/rivendell-10316')).toBe(false);
  });

  test('builds merchant cronjob revalidation tags without global paths', () => {
    expect(
      buildMerchantRevalidationTags({
        merchantSlug: 'coolblue',
        setNumbersOrSlugs: ['10316-1', '76439-1'],
      }),
    ).toEqual([
      'merchant:coolblue',
      'merchant-products:coolblue',
      'prices:coolblue',
      'set:10316-1',
      'set:76439-1',
    ]);
  });

  test('keeps global price revalidation as fallback when changed sets are unknown', () => {
    expect(
      buildMerchantRevalidationTags({
        merchantSlug: 'coolblue',
      }),
    ).toEqual([
      'merchant:coolblue',
      'merchant-products:coolblue',
      'prices',
      'prices:coolblue',
    ]);
  });

  test('builds catalog mutation tags for affected surfaces only', () => {
    expect(
      buildCatalogSetDetailCacheTags({
        setId: '10316',
        slug: 'lord-of-the-rings-rivendell-10316',
      }),
    ).toEqual(['sets', 'set:10316', 'set:lord-of-the-rings-rivendell-10316']);
    expect(
      buildCatalogSetDetailRevalidationTarget({
        path: '/sets/lord-of-the-rings-rivendell-10316',
        setId: '10316',
        slug: 'lord-of-the-rings-rivendell-10316',
      }),
    ).toEqual({
      path: '/sets/lord-of-the-rings-rivendell-10316',
      tags: ['sets', 'set:10316', 'set:lord-of-the-rings-rivendell-10316'],
    });
    expect(
      buildCatalogSetRevalidationTags({
        affectsHomepage: true,
        affectsSearchIndex: true,
        affectsSitemap: true,
        setNumberOrSlug: '10316-1',
        setSlug: 'lord-of-the-rings-rivendell-10316',
        themeSlug: 'icons',
      }),
    ).toEqual([
      'sets',
      'set:10316-1',
      'set:lord-of-the-rings-rivendell-10316',
      'theme:icons',
      'homepage',
      'sitemap',
      'search-index',
    ]);
    expect(
      buildCatalogSetRevalidationTags({
        setNumberOrSlug: 'sagrada-familia-21065',
      }),
    ).toEqual(['sets', 'set:21065', 'set:sagrada-familia-21065']);
  });

  test('builds shared public browse cache tags', () => {
    expect(
      buildPublicBrowseThemeCacheTags({
        themeSlug: 'star-wars',
      }),
    ).toEqual(['catalog', 'sets', 'themes', 'theme:star-wars', 'prices']);
    expect(
      buildPublicBrowseCollectionCacheTags({
        collectionSlug: 'lego-sets-onder-100-euro',
      }),
    ).toEqual([
      'catalog',
      'sets',
      'collections',
      'collection:lego-sets-onder-100-euro',
      'prices',
      'deals',
    ]);
    expect(
      buildPublicBrowseCollectionCacheTags({
        collectionSlug: 'nieuwe-lego-sets',
      }),
    ).toEqual([
      'catalog',
      'sets',
      'collections',
      'collection:nieuwe-lego-sets',
    ]);
  });

  test('builds theme and news mutation tags', () => {
    expect(
      buildThemeRevalidationTags({
        affectsHomepage: true,
        themeSlug: 'star-wars',
      }),
    ).toEqual(['themes', 'theme:star-wars', 'homepage']);
    expect(
      buildNewsRevalidationTags({
        affectsSitemap: true,
        articleSlug: 'star-wars-day-2026',
      }),
    ).toEqual(['news', 'news:star-wars-day-2026', 'sitemap']);
  });
});
