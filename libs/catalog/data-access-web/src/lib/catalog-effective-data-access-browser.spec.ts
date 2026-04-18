import { describe, expect, test, vi } from 'vitest';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
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

  test('falls back to snapshot card identity when api fetch fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network offline'));

    const result = await listCatalogSetCardsByIdsForBrowser({
      canonicalIds: ['21061'],
      fetchImpl: fetchMock,
    });

    expect(result).toEqual(listCatalogSetCardsByIds(['21061']));
  });

  test('preserves requested order while falling back for missing api rows', async () => {
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
    const baselineNotreDame = listCatalogSetCardsByIds(['21061'])[0];

    const result = await listCatalogSetCardsByIdsForBrowser({
      canonicalIds: ['21061', '10316', '21061'],
      fetchImpl: fetchMock,
    });

    expect(result.map((catalogSetCard) => catalogSetCard.id)).toEqual([
      '21061',
      '10316',
      '21061',
    ]);
    expect(result[1]).toMatchObject({
      id: '10316',
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/override.jpg',
      name: 'Rivendell (Supabase)',
    });
    expect(result[0]).toEqual(baselineNotreDame);
    expect(result[2]).toEqual(baselineNotreDame);
  });
});
