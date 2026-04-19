import { describe, expect, test, vi } from 'vitest';
import { listCatalogSetCardsByIdsForBrowser } from './catalog-effective-data-access-browser';

describe('catalog effective data access browser', () => {
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
});
