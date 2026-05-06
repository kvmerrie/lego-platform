import { describe, expect, it } from 'vitest';

const utilityRouteModules = [
  import('./search/page'),
  import('./account/page'),
  import('./account/collection/page'),
  import('./account/wishlist/page'),
  import('./volgt/page'),
  import('./auth/callback/page'),
] as const;

describe('utility route metadata', () => {
  it('marks non-public utility routes noindex,nofollow without canonical or OG URL', async () => {
    const modules = await Promise.all(utilityRouteModules);

    for (const routeModule of modules) {
      expect(routeModule.metadata.robots).toEqual({
        follow: false,
        index: false,
      });
      expect(routeModule.metadata.alternates?.canonical).toBeUndefined();
      expect(routeModule.metadata.openGraph?.url).toBeUndefined();
    }
  });
});
