import { beforeEach, describe, expect, it, vi } from 'vitest';

const publicLandingPageCacheMocks = vi.hoisted(() => ({
  unstableCache: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: publicLandingPageCacheMocks.unstableCache,
}));

describe('public landing page cache helper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    publicLandingPageCacheMocks.unstableCache.mockImplementation(
      (load: () => unknown) => load,
    );
  });

  it('builds one stable key pattern for public landing pages', async () => {
    const {
      buildPublicLandingPageCacheKeyParts,
      getCachedPublicLandingPageData,
    } = await import('./public-landing-page-cache');

    expect(
      buildPublicLandingPageCacheKeyParts({
        page: 'homepage',
        params: ['delivery'],
      }),
    ).toEqual(['public-landing-page', 'homepage', 'delivery']);

    await getCachedPublicLandingPageData({
      load: async () => ({ ok: true }),
      page: 'homepage',
      params: ['delivery'],
      revalidateSeconds: 21_600,
      tags: ['homepage', 'catalog', 'sets', 'themes', 'prices', 'deals'],
    });

    expect(publicLandingPageCacheMocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['public-landing-page', 'homepage', 'delivery'],
      {
        revalidate: 21_600,
        tags: ['homepage', 'catalog', 'sets', 'themes', 'prices', 'deals'],
      },
    );
  });
});
