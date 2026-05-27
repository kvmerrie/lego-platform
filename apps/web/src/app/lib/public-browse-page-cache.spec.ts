import { beforeEach, describe, expect, it, vi } from 'vitest';

const publicBrowsePageCacheMocks = vi.hoisted(() => ({
  unstableCache: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: publicBrowsePageCacheMocks.unstableCache,
}));

describe('public browse page cache helper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    publicBrowsePageCacheMocks.unstableCache.mockImplementation(
      (load: () => unknown) => load,
    );
  });

  it('builds one stable key pattern for public browse pages', async () => {
    const {
      buildPublicBrowsePageCacheKeyParts,
      getCachedPublicBrowsePageData,
      toPublicBrowsePagePriceMinorRecord,
    } = await import('./public-browse-page-cache');

    expect(
      buildPublicBrowsePageCacheKeyParts({
        pageType: 'collection',
        params: ['sort', 'price-asc', 'limit', 40, 'offset', 0],
        slug: 'lego-sets-onder-100-euro',
      }),
    ).toEqual([
      'public-browse-page',
      'collection',
      'lego-sets-onder-100-euro',
      'sort',
      'price-asc',
      'limit',
      '40',
      'offset',
      '0',
    ]);

    await getCachedPublicBrowsePageData({
      load: async () => ({
        setCards: [],
        totalSetCount: 0,
      }),
      pageType: 'theme',
      params: ['limit', 40, 'offset', 0],
      revalidateSeconds: 21_600,
      slug: 'star-wars',
      tags: ['theme:star-wars'],
    });

    expect(publicBrowsePageCacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      [
        'public-browse-page',
        'theme',
        'star-wars',
        'limit',
        '40',
        'offset',
        '0',
      ],
      {
        revalidate: 21_600,
        tags: ['theme:star-wars'],
      },
    );

    expect(
      toPublicBrowsePagePriceMinorRecord(
        new Map([
          ['10307', 62999],
          ['10280', 3999],
        ]),
      ),
    ).toEqual({
      '10280': 3999,
      '10307': 62999,
    });
  });

  it('supports event-driven cache entries without a time TTL', async () => {
    const { getCachedPublicBrowsePageData } = await import(
      './public-browse-page-cache'
    );

    await getCachedPublicBrowsePageData({
      load: async () => ({
        setCards: [],
        totalSetCount: 0,
      }),
      pageType: 'collection',
      revalidateSeconds: false,
      slug: 'lego-sets-onder-100-euro',
      tags: ['collections', 'collection:lego-sets-onder-100-euro'],
    });

    expect(publicBrowsePageCacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['public-browse-page', 'collection', 'lego-sets-onder-100-euro'],
      {
        revalidate: false,
        tags: ['collections', 'collection:lego-sets-onder-100-euro'],
      },
    );
  });
});
