import { describe, expect, it } from 'vitest';

const trustPageModules = [
  {
    canonicalPath: '/contact',
    loader: () => import('./contact/page'),
    title: 'Contact met Brickhunt',
  },
  {
    canonicalPath: '/privacy',
    loader: () => import('./privacy/page'),
    title: 'Privacybeleid',
  },
  {
    canonicalPath: '/cookiebeleid',
    loader: () => import('./cookiebeleid/page'),
    title: 'Cookiebeleid',
  },
  {
    canonicalPath: '/affiliate-disclosure',
    loader: () => import('./affiliate-disclosure/page'),
    title: 'Affiliate disclosure',
  },
] as const;

describe('trust and legal pages', () => {
  it('exposes indexable metadata with canonical Brickhunt URLs', async () => {
    for (const trustPageModule of trustPageModules) {
      const routeModule = await trustPageModule.loader();

      expect(routeModule.metadata.title).toBe(trustPageModule.title);
      expect(routeModule.metadata.alternates?.canonical).toBe(
        `https://www.brickhunt.nl${trustPageModule.canonicalPath}`,
      );
      expect(routeModule.metadata.robots).toBeUndefined();
    }
  });
});
