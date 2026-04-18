import { describe, expect, test, vi } from 'vitest';
import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import {
  createCatalogOverlaySet,
  getCanonicalCatalogSetById,
  getCanonicalCatalogSetBySlug,
  getCatalogSetBySlugWithOverlay,
  listCanonicalCatalogSets,
  listCatalogSetSummariesWithOverlay,
  searchCatalogMissingSets,
} from './catalog-data-access-server';

function createCatalogOverlayRow(
  overrides: Partial<{
    created_at: string;
    image_url: string | null;
    name: string;
    piece_count: number;
    release_year: number;
    set_id: string;
    slug: string;
    source: string;
    source_set_number: string;
    status: string;
    theme: string;
    updated_at: string;
  }> = {},
) {
  return {
    created_at: '2026-04-17T08:00:00.000Z',
    image_url: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
    name: 'Great Deku Tree 2-in-1',
    piece_count: 2500,
    release_year: 2024,
    set_id: '77092',
    slug: 'great-deku-tree-2-in-1-77092',
    source: 'rebrickable',
    source_set_number: '77092-1',
    status: 'active',
    theme: 'The Legend of Zelda',
    updated_at: '2026-04-17T08:00:00.000Z',
    ...overrides,
  };
}

function createCatalogOverlaySupabaseClient({
  insertResult,
  overlayRows = [],
}: {
  insertResult?: {
    data: Record<string, unknown> | null;
    error: { code?: string; details?: string; message?: string } | null;
  };
  overlayRows?: Record<string, unknown>[];
} = {}) {
  const order = vi.fn().mockResolvedValue({
    data: overlayRows,
    error: null,
  });
  const eq = vi.fn(() => ({
    order,
  }));
  const select = vi.fn(() => ({
    eq,
    order,
  }));
  const insertSingle = vi.fn().mockResolvedValue(
    insertResult ?? {
      data: createCatalogOverlayRow(),
      error: null,
    },
  );
  const insertSelect = vi.fn(() => ({
    single: insertSingle,
  }));
  const insert = vi.fn(() => ({
    select: insertSelect,
  }));
  const from = vi.fn(() => ({
    insert,
    select,
  }));

  return {
    insert,
    insertSingle,
    order,
    supabaseClient: { from } as never,
  };
}

describe('catalog data access server', () => {
  test('prefers a Supabase-backed canonical catalog set over snapshot fallback', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Rivendell (Supabase)',
          set_id: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
          source_set_number: '10316-1',
          theme: 'Icons',
        }),
      ],
    });

    const canonicalCatalogSets = await listCanonicalCatalogSets({
      supabaseClient,
    });
    const rivendellCatalogSet = canonicalCatalogSets.find(
      (canonicalCatalogSet) => canonicalCatalogSet.setId === '10316',
    );

    expect(rivendellCatalogSet).toMatchObject({
      name: 'Rivendell (Supabase)',
      setId: '10316',
      slug: 'lord-of-the-rings-rivendell-10316',
      source: 'rebrickable',
      sourceSetNumber: '10316-1',
    });
    expect(
      canonicalCatalogSets.filter(
        (canonicalCatalogSet) => canonicalCatalogSet.setId === '10316',
      ),
    ).toHaveLength(1);
  });

  test('falls back to the generated snapshot when no Supabase canonical set exists', async () => {
    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '21061',
      supabaseClient: createCatalogOverlaySupabaseClient({
        overlayRows: [],
      }).supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      name: 'Notre-Dame de Paris',
      primaryTheme: 'Architecture',
      setId: '21061',
      slug: 'notre-dame-de-paris-21061',
      source: 'snapshot',
    });
  });

  test('keeps slug lookups stable through the canonical catalog layer', async () => {
    const canonicalCatalogSet = await getCanonicalCatalogSetBySlug({
      slug: 'great-deku-tree-2-in-1-77092',
      supabaseClient: createCatalogOverlaySupabaseClient({
        overlayRows: [createCatalogOverlayRow()],
      }).supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      name: 'Great Deku Tree 2-in-1',
      primaryTheme: 'The Legend of Zelda',
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      source: 'rebrickable',
    });
  });

  test('merges active overlay sets into the admin catalog set list', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          created_at: '2026-04-17T08:00:00.000Z',
          image_url: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          piece_count: 2500,
          release_year: 2024,
          set_id: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          source_set_number: '77092-1',
          status: 'active',
          theme: 'The Legend of Zelda',
          updated_at: '2026-04-17T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));

    const summaries = await listCatalogSetSummariesWithOverlay({
      supabaseClient: { from } as never,
    });

    expect(summaries.some((summary) => summary.id === '77092')).toBe(true);
    expect(
      summaries.find((summary) => summary.id === '77092')?.collectorAngle,
    ).toContain('Brickhunt');
  });

  test('filters out sets that already exist when searching Rebrickable', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                set_num: '10316-1',
                name: 'The Lord of the Rings: Rivendell',
                year: 2023,
                num_parts: 6167,
                theme_id: 171,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/10316-1/132394.jpg',
              },
              {
                set_num: '77092-1',
                name: 'Great Deku Tree 2-in-1',
                year: 2024,
                num_parts: 2500,
                theme_id: 999,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/171/')) {
        return {
          ok: true,
          json: async () => ({
            id: 171,
            name: 'Icons',
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/999/')) {
        return {
          ok: true,
          json: async () => ({
            id: 999,
            name: 'The Legend of Zelda',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await searchCatalogMissingSets({
      fetchImpl,
      query: 'deku',
      supabaseClient: { from } as never,
    });

    expect(results).toEqual([
      expect.objectContaining({
        setId: '77092',
        theme: 'The Legend of Zelda',
      }),
    ]);
  });

  test('filters out sets that already exist in Supabase-backed catalog identity when searching Rebrickable', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [createCatalogOverlayRow()],
    });
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                set_num: '77092-1',
                name: 'Great Deku Tree 2-in-1',
                year: 2024,
                num_parts: 2500,
                theme_id: 999,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/999/')) {
        return {
          ok: true,
          json: async () => ({
            id: 999,
            name: 'The Legend of Zelda',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const results = await searchCatalogMissingSets({
      fetchImpl,
      query: 'deku',
      supabaseClient,
    });

    expect(results).toEqual([]);
  });

  test('uses the parent theme as the primary theme for search results', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';

    const order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eq = vi.fn(() => ({
      order,
    }));
    const select = vi.fn(() => ({
      eq,
      order,
    }));
    const from = vi.fn(() => ({
      select,
    }));
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/lego/sets/?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                set_num: '75192-1',
                name: 'Millennium Falcon',
                year: 2017,
                num_parts: 7541,
                theme_id: 592,
                set_img_url:
                  'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
              },
            ],
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/592/')) {
        return {
          ok: true,
          json: async () => ({
            id: 592,
            name: 'Ultimate Collector Series',
            parent_id: 158,
          }),
        } as Response;
      }

      if (url.endsWith('/lego/themes/158/')) {
        return {
          ok: true,
          json: async () => ({
            id: 158,
            name: 'Star Wars',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const [result] = await searchCatalogMissingSets({
      fetchImpl,
      query: 'millennium falcon',
      supabaseClient: { from } as never,
    });

    expect(result).toMatchObject({
      setId: '75192',
      theme: 'Star Wars',
    });
  });

  test('creates an overlay record with normalized set data', async () => {
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient();

    const result = await createCatalogOverlaySet({
      input: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
        name: 'Great Deku Tree 2-in-1',
        pieces: 2500,
        releaseYear: 2024,
        setId: '77092',
        slug: 'wrong-slug-will-be-normalized',
        source: 'rebrickable',
        sourceSetNumber: '77092-1',
        theme: 'The Legend of Zelda',
      },
      supabaseClient,
    });

    expect(result.slug).toBe('great-deku-tree-2-in-1-77092');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'great-deku-tree-2-in-1-77092',
      }),
    );
  });

  test('normalizes raw external subthemes to the expected primary theme when creating an overlay set', async () => {
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient({
      insertResult: {
        data: createCatalogOverlayRow({
          image_url: 'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
          name: 'Millennium Falcon',
          piece_count: 7541,
          release_year: 2017,
          set_id: '75192',
          slug: 'millennium-falcon-75192',
          source_set_number: '75192-1',
          theme: 'Star Wars',
        }),
        error: null,
      },
    });

    const result = await createCatalogOverlaySet({
      input: {
        imageUrl: 'https://cdn.rebrickable.com/media/sets/75192-1/1000.jpg',
        name: 'Millennium Falcon',
        pieces: 7541,
        releaseYear: 2017,
        setId: '75192',
        slug: 'millennium-falcon-75192',
        source: 'rebrickable',
        sourceSetNumber: '75192-1',
        theme: 'Ultimate Collector Series',
      },
      supabaseClient,
    });

    expect(result.theme).toBe('Star Wars');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'Star Wars',
      }),
    );
  });

  test('rejects adding a set when the set_id already exists in the generated snapshot', async () => {
    const snapshotSet =
      listCatalogSetSummaries().find(
        (catalogSetSummary) => catalogSetSummary.id === '10316',
      ) ?? listCatalogSetSummaries()[0];
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient();

    await expect(
      createCatalogOverlaySet({
        input: {
          imageUrl: snapshotSet.imageUrl,
          name: snapshotSet.name,
          pieces: snapshotSet.pieces,
          releaseYear: snapshotSet.releaseYear,
          setId: snapshotSet.id,
          slug: snapshotSet.slug,
          source: 'rebrickable',
          sourceSetNumber: `${snapshotSet.id}-1`,
          theme: snapshotSet.theme,
        },
        supabaseClient,
      }),
    ).rejects.toThrow(
      new RegExp(`Set ${snapshotSet.id} staat al in de Brickhunt-catalogus`),
    );

    expect(insert).not.toHaveBeenCalled();
  });

  test('rejects adding a set when the set_id already exists in the catalog overlay', async () => {
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [createCatalogOverlayRow()],
    });

    await expect(
      createCatalogOverlaySet({
        input: {
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          theme: 'The Legend of Zelda',
        },
        supabaseClient,
      }),
    ).rejects.toThrow(/catalog-overlay/);

    expect(insert).not.toHaveBeenCalled();
  });

  test('rejects adding a set when the generated slug already exists in the overlay', async () => {
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Andere Deku Tree',
          set_id: '88000',
          source_set_number: '88000-1',
          slug: 'great-deku-tree-2-in-1-77092',
        }),
      ],
    });

    await expect(
      createCatalogOverlaySet({
        input: {
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          theme: 'The Legend of Zelda',
        },
        supabaseClient,
      }),
    ).rejects.toThrow(
      /slug "great-deku-tree-2-in-1-77092" al gebruikt wordt door Andere Deku Tree \(88000\)/,
    );

    expect(insert).not.toHaveBeenCalled();
  });

  test('translates database slug conflicts into an operator-friendly error message', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      insertResult: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "catalog_sets_overlay_slug_key"',
        },
      },
    });

    await expect(
      createCatalogOverlaySet({
        input: {
          imageUrl: 'https://cdn.rebrickable.com/media/sets/77092-1/1000.jpg',
          name: 'Great Deku Tree 2-in-1',
          pieces: 2500,
          releaseYear: 2024,
          setId: '77092',
          slug: 'great-deku-tree-2-in-1-77092',
          source: 'rebrickable',
          sourceSetNumber: '77092-1',
          theme: 'The Legend of Zelda',
        },
        supabaseClient,
      }),
    ).rejects.toThrow(
      /slug "great-deku-tree-2-in-1-77092" al in Brickhunt gebruikt wordt/,
    );
  });

  test('resolves an active overlay set by slug for the public set page', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          slug: 'great-deku-tree-2-in-1-77092',
        }),
      ],
    });

    const result = await getCatalogSetBySlugWithOverlay({
      slug: 'great-deku-tree-2-in-1-77092',
      supabaseClient,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: '77092',
        tagline: expect.stringContaining('prijsvergelijking'),
      }),
    );
  });
});
