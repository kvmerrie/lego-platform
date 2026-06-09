import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildPublicCatalogRevalidationPaths,
  buildPublicCatalogRevalidationTags,
  revalidatePublicCatalogPaths,
  revalidatePublicCatalogPriceChanges,
  revalidatePublicWeb,
} from './public-web-revalidation-server';

describe('public web revalidation server', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  test('logs compact outbound revalidation metrics and warns for broad tags', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
    process.env.WEB_BASE_URL = 'https://staging.brickhunt.nl';
    process.env.DEBUG_REVALIDATION = 'true';
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ revalidated: true }), {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );

    await revalidatePublicWeb({
      fetchImpl,
      paths: Array.from({ length: 14 }, (_, index) => `/sets/set-${index}`),
      reason: 'observability_test',
      tags: ['homepage', 'homepage', 'set:10316'],
    });

    expect(infoSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] set detail targets',
      expect.objectContaining({
        reason: 'observability_test',
        setDetailTargetCount: 14,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] request diagnostics',
      expect.objectContaining({
        broad_tag_count: 1,
        event: 'public_web_revalidation_request',
        path_count: 14,
        path_sample_omitted_count: 2,
        reason: 'observability_test',
        skipped: false,
        source: 'generic',
        tag_count: 2,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] success',
      expect.objectContaining({
        event: 'public_web_revalidation_succeeded',
        path_count: 14,
        reason: 'observability_test',
        source: 'generic',
        status: 200,
        tag_count: 2,
        target_host: 'staging.brickhunt.nl',
        target_pathname: '/api/revalidate',
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] response diagnostics',
      expect.objectContaining({
        event: 'public_web_revalidation_response',
        path_count: 14,
        reason: 'observability_test',
        source: 'generic',
        status: 200,
        tag_count: 2,
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] broad tags requested',
      {
        broadTags: ['homepage'],
        reason: 'observability_test',
        source: 'generic',
      },
    );
  });

  test('builds catalog tags for targeted cache revalidation', () => {
    expect(
      buildPublicCatalogRevalidationTags({
        targets: [
          {
            setId: '10316',
            slug: 'rivendell-10316',
            theme: 'Icons',
          },
        ],
      }),
    ).toEqual([
      'homepage',
      'prices',
      'catalog',
      'sets',
      'themes',
      'deals',
      'set:10316',
      'set:rivendell-10316',
      'theme:icons',
    ]);
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
      '/deals',
      '/sets/rivendell-10316',
      '/themes/icons',
      '/sets/land-rover-classic-defender-90-10317',
    ]);
  });

  test('adds explicit collection paths and tags to catalog revalidation requests', () => {
    expect(
      buildPublicCatalogRevalidationPaths({
        additionalPaths: ['/lego-sets-onder-50-euro'],
        includeDeals: false,
        includeHome: false,
        includeThemeDirectory: false,
        targets: [],
      }),
    ).toEqual(['/lego-sets-onder-50-euro']);
    expect(
      buildPublicCatalogRevalidationTags({
        additionalTags: ['collections', 'collection:lego-sets-onder-50-euro'],
        includeDeals: false,
        includeHome: false,
        includeThemeDirectory: false,
        targets: [],
      }),
    ).toEqual([
      'prices',
      'catalog',
      'sets',
      'collections',
      'collection:lego-sets-onder-50-euro',
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
      pathCount: 5,
      paths: [
        '/',
        '/themes',
        '/deals',
        '/sets/rivendell-10316',
        '/themes/icons',
      ],
      skipped: true,
      tagCount: 9,
      tags: [
        'homepage',
        'prices',
        'catalog',
        'sets',
        'themes',
        'deals',
        'set:10316',
        'set:rivendell-10316',
        'theme:icons',
      ],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('skips outbound revalidation when no origin is configured outside production', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
    delete process.env.WEB_BASE_URL;
    delete process.env.BRICKHUNT_DEPLOY_ENV;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'test';
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await revalidatePublicWeb({
      fetchImpl,
      paths: ['/'],
      reason: 'missing_origin_test',
      tags: ['homepage'],
    });

    expect(result).toMatchObject({
      attempted: false,
      skipped: true,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] skipped',
      expect.objectContaining({
        attempted: false,
        pathCount: 1,
        reason: 'missing_origin_test',
        skipReason: 'missing_WEB_BASE_URL',
        source: 'generic',
        tagCount: 1,
      }),
    );
  });

  test('fails clearly when the configured origin URL is invalid', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
    process.env.WEB_BASE_URL = 'not a valid url';
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      revalidatePublicWeb({
        fetchImpl,
        paths: ['/'],
        reason: 'invalid_origin_test',
        tags: ['homepage'],
      }),
    ).rejects.toThrow('Invalid public web revalidation origin');

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] fetch failed',
      expect.objectContaining({
        error_message: 'Invalid public web revalidation origin: WEB_BASE_URL.',
        event: 'public_web_revalidation_fetch_failed',
        reason: 'invalid_origin_test',
        target_pathname: '/api/revalidate',
      }),
    );
  });

  test('logs actionable diagnostics when fetch throws', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    const cause = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    const fetchError = new TypeError('fetch failed');
    (fetchError as Error & { cause?: unknown }).cause = cause;
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(fetchError);

    await expect(
      revalidatePublicWeb({
        fetchImpl,
        paths: ['/'],
        reason: 'fetch_failure_test',
        tags: ['homepage'],
      }),
    ).rejects.toThrow('fetch failed');

    expect(errorSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] fetch failed',
      expect.objectContaining({
        error_cause_code: 'ECONNREFUSED',
        error_cause_message: 'connect ECONNREFUSED',
        error_message: 'fetch failed',
        error_name: 'TypeError',
        event: 'public_web_revalidation_fetch_failed',
        reason: 'fetch_failure_test',
        target_host: 'www.brickhunt.nl',
        target_pathname: '/api/revalidate',
      }),
    );
  });

  test('logs response status and body excerpt when the endpoint rejects the request', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
    process.env.WEB_BASE_URL = 'https://www.brickhunt.nl';
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Invalid revalidation secret.', {
        status: 401,
      }),
    );

    await expect(
      revalidatePublicWeb({
        fetchImpl,
        paths: ['/'],
        reason: 'unauthorized_test',
        tags: ['homepage'],
      }),
    ).rejects.toThrow('Public web revalidation failed with status 401.');

    expect(errorSpy).toHaveBeenCalledWith(
      '[public-web-revalidation] http failed',
      expect.objectContaining({
        event: 'public_web_revalidation_http_failed',
        reason: 'unauthorized_test',
        response_body_excerpt: 'Invalid revalidation secret.',
        status: 401,
        target_host: 'www.brickhunt.nl',
        target_pathname: '/api/revalidate',
      }),
    );
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
          paths: [
            '/',
            '/themes',
            '/deals',
            '/sets/rivendell-10316',
            '/themes/icons',
          ],
          reason: 'commerce_sync',
          tags: [
            'homepage',
            'prices',
            'catalog',
            'sets',
            'themes',
            'deals',
            'set:10316',
            'set:rivendell-10316',
            'theme:icons',
          ],
        }),
      }),
    );
    expect(result).toEqual({
      attempted: true,
      pathCount: 5,
      paths: [
        '/',
        '/themes',
        '/deals',
        '/sets/rivendell-10316',
        '/themes/icons',
      ],
      skipped: false,
      tagCount: 9,
      tags: [
        'homepage',
        'prices',
        'catalog',
        'sets',
        'themes',
        'deals',
        'set:10316',
        'set:rivendell-10316',
        'theme:icons',
      ],
    });
  });

  test('batches price-change set path revalidation within public web limits', async () => {
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
    const changedSetIds = Array.from({ length: 30 }, (_, index) =>
      String(10_000 + index),
    );
    const changedSetSlugs = changedSetIds.map((setId) => `set-${setId}`);

    const result = await revalidatePublicCatalogPriceChanges({
      changedSetIds,
      changedSetSlugs,
      fetchImpl,
      reason: 'feed_sync_test',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstRequest = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { paths: string[]; tags: string[] };
    const secondRequest = JSON.parse(
      (fetchImpl.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as { paths: string[]; tags: string[] };

    expect(firstRequest.paths).toHaveLength(25);
    expect(secondRequest.paths).toHaveLength(7);
    expect(firstRequest.tags).toContain('prices');
    expect(firstRequest.tags).toContain('catalog');
    expect(firstRequest.tags).not.toContain('collections');
    expect(firstRequest.tags).not.toContain('themes');
    expect(result).toMatchObject({
      attempted: true,
      pathCount: 32,
      skipped: false,
      tagCount: 65,
    });
  });

  test('uses broad price tags and caps explicit set paths for large feed runs', async () => {
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
    const changedSetIds = Array.from({ length: 150 }, (_, index) =>
      String(20_000 + index),
    );
    const changedSetSlugs = changedSetIds.map((setId) => `set-${setId}`);

    const result = await revalidatePublicCatalogPriceChanges({
      changedSetIds,
      changedSetSlugs,
      fetchImpl,
      reason: 'large_feed_sync_test',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { paths: string[]; tags: string[] };

    expect(request.paths).toHaveLength(25);
    expect(request.paths).toEqual([
      '/',
      '/deals',
      ...changedSetSlugs.slice(0, 23).map((slug) => `/sets/${slug}`),
    ]);
    expect(request.tags).toEqual([
      'homepage',
      'deals',
      'prices',
      'catalog',
      'sets',
    ]);
    expect(result).toMatchObject({
      attempted: true,
      pathCount: 25,
      skipped: false,
      tagCount: 5,
    });
  });
});
