import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildPublicCatalogRevalidationPaths,
  revalidatePublicCatalogPaths,
} from './public-web-revalidation-server';

describe('public web revalidation server', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  test('builds explicit set and theme paths for catalog targets', () => {
    expect(
      buildPublicCatalogRevalidationPaths({
        targets: [
          {
            setId: '10316',
            slug: 'rivendell-10316',
            theme: 'Icons',
          },
          {
            setId: '10317',
            slug: 'land-rover-classic-defender-90-10317',
            theme: 'Icons',
          },
        ],
      }),
    ).toEqual([
      '/',
      '/themes',
      '/sets/rivendell-10316',
      '/themes/icons',
      '/sets/land-rover-classic-defender-90-10317',
    ]);
  });

  test('skips outbound revalidation when no secret is configured', async () => {
    delete process.env.WEB_REVALIDATE_SECRET;
    process.env.WEB_BASE_URL = 'https://staging.brickhunt.nl';
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await revalidatePublicCatalogPaths({
      fetchImpl,
      targets: [
        {
          setId: '10316',
          slug: 'rivendell-10316',
          theme: 'Icons',
        },
      ],
    });

    expect(result).toEqual({
      attempted: false,
      pathCount: 4,
      paths: ['/', '/themes', '/sets/rivendell-10316', '/themes/icons'],
      skipped: true,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('posts path-based revalidation requests to the public web app when configured', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
    process.env.WEB_BASE_URL = 'https://staging.brickhunt.nl';
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ revalidated: true }), {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );

    const result = await revalidatePublicCatalogPaths({
      fetchImpl,
      reason: 'commerce_sync',
      targets: [
        {
          setId: '10316',
          slug: 'rivendell-10316',
          theme: 'Icons',
        },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://staging.brickhunt.nl/api/revalidate',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'revalidate-secret',
        },
        body: JSON.stringify({
          paths: ['/', '/themes', '/sets/rivendell-10316', '/themes/icons'],
          reason: 'commerce_sync',
        }),
      }),
    );
    expect(result).toEqual({
      attempted: true,
      pathCount: 4,
      paths: ['/', '/themes', '/sets/rivendell-10316', '/themes/icons'],
      skipped: false,
    });
  });
});
