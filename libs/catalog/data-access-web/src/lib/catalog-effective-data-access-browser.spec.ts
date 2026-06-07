import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiPaths } from '@lego-platform/shared/config';
import {
  buildSupabaseAuthorizationHeaders,
  notifyBrowserAccountDataChanged,
} from '@lego-platform/shared/data-access-auth';
import {
  addUserThemeFavoriteForBrowser,
  listCatalogSetCardsByIdsForBrowser,
  listUserThemeFavoritesForBrowser,
  removeUserThemeFavoriteForBrowser,
} from './catalog-effective-data-access-browser';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  buildSupabaseAuthorizationHeaders: vi.fn(),
  notifyBrowserAccountDataChanged: vi.fn(),
}));

describe('catalog effective data access browser', () => {
  beforeEach(() => {
    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers({
        authorization: 'Bearer valid-token',
      }),
    );
    vi.mocked(notifyBrowserAccountDataChanged).mockClear();
  });

  test('prefers api-backed canonical card identity when available', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            availability: 'Eerste winkels worden nu gekoppeld',
            collectorAngle:
              'Nieuw in Brickhunt. Rivendell (Supabase) staat klaar voor de eerste prijscheck.',
            id: '10316',
            imageUrl:
              'https://cdn.rebrickable.com/media/sets/10316-1/override.jpg',
            name: 'Rivendell (Supabase)',
            pieces: 6167,
            releaseYear: 2023,
            slug: 'lord-of-the-rings-rivendell-10316',
            tagline:
              'We bouwen nu de eerste prijsvergelijking op voor deze Icons-set.',
            theme: 'Icons',
          },
        ]),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    const result = await listCatalogSetCardsByIdsForBrowser({
      canonicalIds: ['10316'],
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject([
      {
        id: '10316',
        imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/override.jpg',
        name: 'Rivendell (Supabase)',
        slug: 'lord-of-the-rings-rivendell-10316',
        theme: 'Icons',
      },
    ]);
  });

  test('returns no cards when the canonical api fetch fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network offline'));

    const result = await listCatalogSetCardsByIdsForBrowser({
      canonicalIds: ['21061'],
      fetchImpl: fetchMock,
    });

    expect(result).toEqual([]);
  });

  test('preserves requested order for api-backed rows and skips missing cards', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            availability: 'Eerste winkels worden nu gekoppeld',
            collectorAngle:
              'Nieuw in Brickhunt. Rivendell (Supabase) staat klaar voor de eerste prijscheck.',
            id: '10316',
            imageUrl:
              'https://cdn.rebrickable.com/media/sets/10316-1/override.jpg',
            name: 'Rivendell (Supabase)',
            pieces: 6167,
            releaseYear: 2023,
            slug: 'lord-of-the-rings-rivendell-10316',
            tagline:
              'We bouwen nu de eerste prijsvergelijking op voor deze Icons-set.',
            theme: 'Icons',
          },
        ]),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );
    const result = await listCatalogSetCardsByIdsForBrowser({
      canonicalIds: ['21061', '10316', '21061'],
      fetchImpl: fetchMock,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '10316',
    ]);
    expect(result[0]).toMatchObject({
      id: '10316',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/override.jpg',
      name: 'Rivendell (Supabase)',
    });
  });

  test('returns anonymous favorite theme payload when the api returns 401', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Authentication required.' }), {
        headers: {
          'content-type': 'application/json',
        },
        status: 401,
      }),
    );

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toEqual({
      isAuthenticated: false,
      themeIds: [],
      themes: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(apiPaths.themeFavorites, {
      cache: 'no-store',
      headers: expect.any(Headers),
      signal: expect.any(AbortSignal),
    });
  });

  test('returns empty favorite theme payload when the api returns 403', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden.' }), {
        headers: {
          'content-type': 'application/json',
        },
        status: 403,
      }),
    );

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toEqual({
      isAuthenticated: false,
      themeIds: [],
      themes: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns empty favorite theme payload when the api fetch fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('api offline'));

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toEqual({
      isAuthenticated: false,
      themeIds: [],
      themes: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns empty favorite theme payload for malformed json', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not-json', {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toEqual({
      isAuthenticated: false,
      themeIds: [],
      themes: [],
    });
  });

  test('returns authenticated empty favorite theme payload for malformed theme items', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          themeIds: ['theme:minecraft'],
          themes: [
            {
              favoritedAt: '2026-06-06T18:00:00.000Z',
              themeSnapshot: {
                slug: 'minecraft',
              },
            },
          ],
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toEqual({
      isAuthenticated: true,
      themeIds: [],
      themes: [],
    });
  });

  test('maps a minecraft favorite with missing optional card fields', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          themeIds: ['theme:minecraft'],
          themes: [
            {
              favoritedAt: '2026-06-07T06:12:50.83928+00:00',
              themeSnapshot: {
                id: 'theme:minecraft',
                name: 'Minecraft®',
                slug: 'minecraft',
              },
            },
          ],
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toMatchObject({
      isAuthenticated: true,
      themeIds: ['theme:minecraft'],
      themes: [
        {
          favoritedAt: '2026-06-07T06:12:50.83928+00:00',
          themeSnapshot: {
            id: 'theme:minecraft',
            momentum: 'Bekijk welke Minecraft®-sets de moeite waard zijn.',
            name: 'Minecraft®',
            setCount: 0,
            signatureSet: 'Minecraft®',
            slug: 'minecraft',
          },
        },
      ],
    });
  });

  test('skips malformed favorite items while preserving valid favorites', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          themeIds: ['theme:minecraft', 'theme:broken'],
          themes: [
            {
              favoritedAt: '2026-06-07T06:12:50.83928+00:00',
              themeSnapshot: {
                id: 'theme:minecraft',
                name: 'Minecraft®',
                setCount: 35,
                slug: 'minecraft',
              },
            },
            {
              favoritedAt: '2026-06-07T06:12:50.83928+00:00',
              themeSnapshot: {
                id: 'theme:broken',
              },
            },
          ],
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toMatchObject({
      isAuthenticated: true,
      themeIds: ['theme:minecraft'],
      themes: [
        {
          themeSnapshot: {
            id: 'theme:minecraft',
            slug: 'minecraft',
          },
        },
      ],
    });
  });

  test('lists favorite themes for the personal homepage rail', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          themeIds: ['theme-icons'],
          themes: [
            {
              favoritedAt: '2026-06-06T18:00:00.000Z',
              themeSnapshot: {
                id: 'theme-icons',
                name: 'Icons',
                slug: 'icons',
                setCount: 38,
                momentum:
                  'Displaymodellen die gebouwd zijn om te blijven staan.',
                signatureSet: 'Icons',
              },
            },
          ],
        }),
        {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        },
      ),
    );

    await expect(
      listUserThemeFavoritesForBrowser({ fetchImpl: fetchMock }),
    ).resolves.toMatchObject({
      isAuthenticated: true,
      themeIds: ['theme-icons'],
      themes: [
        {
          favoritedAt: '2026-06-06T18:00:00.000Z',
          themeSnapshot: {
            id: 'theme-icons',
            name: 'Icons',
            slug: 'icons',
          },
        },
      ],
    });
  });

  test('adds and removes favorite themes with authenticated browser headers', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            isFavorited: true,
            themeId: 'theme-icons',
          }),
          {
            headers: {
              'content-type': 'application/json',
            },
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            isFavorited: false,
            themeId: 'theme-icons',
          }),
          {
            headers: {
              'content-type': 'application/json',
            },
            status: 200,
          },
        ),
      );

    await expect(
      addUserThemeFavoriteForBrowser({
        fetchImpl: fetchMock,
        themeId: ' theme-icons ',
      }),
    ).resolves.toEqual({
      isFavorited: true,
      themeId: 'theme-icons',
    });
    await expect(
      removeUserThemeFavoriteForBrowser({
        fetchImpl: fetchMock,
        themeId: 'theme-icons',
      }),
    ).resolves.toEqual({
      isFavorited: false,
      themeId: 'theme-icons',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${apiPaths.themeFavorites}/theme-icons`,
      {
        headers: expect.any(Headers),
        method: 'PUT',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${apiPaths.themeFavorites}/theme-icons`,
      {
        headers: expect.any(Headers),
        method: 'DELETE',
      },
    );
    expect(notifyBrowserAccountDataChanged).toHaveBeenCalledTimes(2);
  });
});
