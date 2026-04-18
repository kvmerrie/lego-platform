import { describe, expect, test, vi } from 'vitest';
import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import {
  backfillCatalogOverlayThemeIdentity,
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
    primary_theme_id?: string | null;
    release_year: number;
    set_id: string;
    slug: string;
    source: string;
    source_theme_id?: string | null;
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

function createSupabaseTableBuilder<Row extends Record<string, unknown>>(
  rows: readonly Row[],
) {
  const filters: Array<
    | {
        type: 'eq';
        column: keyof Row & string;
        value: unknown;
      }
    | {
        type: 'in';
        column: keyof Row & string;
        values: readonly unknown[];
      }
    | {
        type: 'order';
        column: keyof Row & string;
        ascending: boolean;
      }
  > = [];

  const builder = {
    eq(column: keyof Row & string, value: unknown) {
      filters.push({
        column,
        type: 'eq',
        value,
      });

      return builder;
    },
    in(column: keyof Row & string, values: readonly unknown[]) {
      filters.push({
        column,
        type: 'in',
        values,
      });

      return builder;
    },
    order(column: keyof Row & string, options: { ascending: boolean }) {
      filters.push({
        ascending: options.ascending,
        column,
        type: 'order',
      });

      return builder;
    },
    maybeSingle() {
      return builder.then((result) => ({
        data: result.data[0] ?? null,
        error: result.error,
      }));
    },
    select() {
      return builder;
    },
    then<TResult1 = { data: Row[]; error: null }>(
      onFulfilled?:
        | ((value: {
            data: Row[];
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      const filteredRows = filters.reduce<readonly Row[]>(
        (resultRows, filter) => {
          if (filter.type === 'eq') {
            return resultRows.filter(
              (row) => row[filter.column] === filter.value,
            );
          }

          if (filter.type === 'in') {
            return resultRows.filter((row) =>
              filter.values.includes(row[filter.column]),
            );
          }

          const sortedRows = [...resultRows].sort((left, right) => {
            const leftValue = left[filter.column];
            const rightValue = right[filter.column];

            if (leftValue === rightValue) {
              return 0;
            }

            if (leftValue == null) {
              return filter.ascending ? -1 : 1;
            }

            if (rightValue == null) {
              return filter.ascending ? 1 : -1;
            }

            return String(leftValue).localeCompare(String(rightValue));
          });

          return filter.ascending ? sortedRows : sortedRows.reverse();
        },
        rows,
      );

      return Promise.resolve({
        data: [...filteredRows],
        error: null,
      }).then(onFulfilled, onRejected ?? undefined);
    },
  };

  return builder;
}

function createCatalogOverlaySupabaseClient({
  insertResult,
  overlayRows = [],
  primaryThemeRows = [],
  sourceThemeRows = [],
  themeMappingRows = [],
}: {
  insertResult?: {
    data: Record<string, unknown> | null;
    error: { code?: string; details?: string; message?: string } | null;
  };
  overlayRows?: Record<string, unknown>[];
  primaryThemeRows?: Record<string, unknown>[];
  sourceThemeRows?: Record<string, unknown>[];
  themeMappingRows?: Record<string, unknown>[];
} = {}) {
  const sourceThemeUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const primaryThemeUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const themeMappingUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const updateEq = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const update = vi.fn(() => ({
    eq: updateEq,
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
  const from = vi.fn((table: string) => {
    if (table === 'catalog_sets_overlay') {
      const builder = createSupabaseTableBuilder(overlayRows);
      return {
        insert,
        maybeSingle: builder.maybeSingle,
        select: builder.select,
        update,
      };
    }

    if (table === 'catalog_source_themes') {
      const builder = createSupabaseTableBuilder(sourceThemeRows);
      return {
        select: builder.select,
        upsert: sourceThemeUpsert,
      };
    }

    if (table === 'catalog_themes') {
      const builder = createSupabaseTableBuilder(primaryThemeRows);
      return {
        select: builder.select,
        upsert: primaryThemeUpsert,
      };
    }

    if (table === 'catalog_theme_mappings') {
      const builder = createSupabaseTableBuilder(themeMappingRows);
      return {
        select: builder.select,
        upsert: themeMappingUpsert,
      };
    }

    throw new Error(`Unexpected table requested in test: ${table}`);
  });

  return {
    insert,
    insertSingle,
    primaryThemeUpsert,
    sourceThemeUpsert,
    supabaseClient: { from } as never,
    themeMappingUpsert,
    update,
    updateEq,
  };
}

function createRebrickableFetchMock({
  setPayloads,
  themePayloads,
}: {
  setPayloads: Record<string, Record<string, unknown>>;
  themePayloads: Record<string, Record<string, unknown>>;
}) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);

    if (url.includes('/lego/sets/?')) {
      throw new Error(`Unexpected search fetch ${url}`);
    }

    for (const [setNumber, payload] of Object.entries(setPayloads)) {
      if (url.endsWith(`/lego/sets/${setNumber}/`)) {
        return {
          ok: true,
          json: async () => payload,
        } as Response;
      }
    }

    for (const [themeId, payload] of Object.entries(themePayloads)) {
      if (url.endsWith(`/lego/themes/${themeId}/`)) {
        return {
          ok: true,
          json: async () => payload,
        } as Response;
      }
    }

    throw new Error(`Unexpected fetch ${url}`);
  }) as typeof fetch;
}

describe('catalog data access server', () => {
  test('prefers normalized theme joins for UCS-like canonical reads', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          primary_theme_id: 'theme:star-wars',
          set_id: '75192',
          slug: 'millennium-falcon-75192',
          source_theme_id: 'rebrickable:592',
          source_set_number: '75192-1',
          theme: 'Star Wars',
        }),
      ],
      primaryThemeRows: [
        {
          display_name: 'Star Wars',
          id: 'theme:star-wars',
        },
      ],
      sourceThemeRows: [
        {
          id: 'rebrickable:592',
          source_theme_name: 'Ultimate Collector Series',
        },
      ],
      themeMappingRows: [
        {
          primary_theme_id: 'theme:star-wars',
          source_theme_id: 'rebrickable:592',
        },
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '75192',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      primaryTheme: 'Star Wars',
      secondaryLabels: ['Ultimate Collector Series'],
    });
  });

  test('falls back to the legacy theme string when normalized theme ids are absent', async () => {
    const { supabaseClient } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          name: 'Mario Kart - Mario & Standard Kart',
          primary_theme_id: null,
          set_id: '72037',
          slug: 'mario-kart-mario-standard-kart-72037',
          source_theme_id: null,
          source_set_number: '72037-1',
          theme: 'Super Mario',
        }),
      ],
    });

    const canonicalCatalogSet = await getCanonicalCatalogSetById({
      setId: '72037',
      supabaseClient,
    });

    expect(canonicalCatalogSet).toMatchObject({
      primaryTheme: 'Super Mario',
      secondaryLabels: [],
    });
  });

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
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { insert, supabaseClient } = createCatalogOverlaySupabaseClient();
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '77092-1': {
          set_num: '77092-1',
          theme_id: 999,
        },
      },
      themePayloads: {
        '999': {
          id: 999,
          name: 'The Legend of Zelda',
        },
      },
    });

    const result = await createCatalogOverlaySet({
      fetchImpl,
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
        primary_theme_id: 'theme:the-legend-of-zelda',
        source_theme_id: 'rebrickable:999',
        slug: 'great-deku-tree-2-in-1-77092',
        theme: 'The Legend of Zelda',
      }),
    );
  });

  test('normalizes raw external subthemes to the expected primary theme when creating an overlay set', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
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
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '75192-1': {
          set_num: '75192-1',
          theme_id: 592,
        },
      },
      themePayloads: {
        '592': {
          id: 592,
          name: 'Ultimate Collector Series',
          parent_id: 158,
        },
        '158': {
          id: 158,
          name: 'Star Wars',
        },
      },
    });

    const result = await createCatalogOverlaySet({
      fetchImpl,
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
        primary_theme_id: 'theme:star-wars',
        source_theme_id: 'rebrickable:592',
        theme: 'Star Wars',
      }),
    );
  });

  test('backfills a UCS-like source theme to Star Wars while keeping the legacy theme column intact', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const {
      primaryThemeUpsert,
      sourceThemeUpsert,
      supabaseClient,
      themeMappingUpsert,
      update,
      updateEq,
    } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          set_id: '75192',
          slug: 'millennium-falcon-75192',
          source_set_number: '75192-1',
          theme: 'Star Wars',
        }),
      ],
    });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '75192-1': {
          set_num: '75192-1',
          theme_id: 592,
        },
      },
      themePayloads: {
        '592': {
          id: 592,
          name: 'Ultimate Collector Series',
          parent_id: 158,
        },
        '158': {
          id: 158,
          name: 'Star Wars',
        },
      },
    });

    const result = await backfillCatalogOverlayThemeIdentity({
      fetchImpl,
      supabaseClient,
    });

    expect(result).toEqual({
      processedCount: 1,
      skippedCount: 0,
      updatedCount: 1,
    });
    expect(sourceThemeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rebrickable:592',
        parent_source_theme_id: 'rebrickable:158',
        source_system: 'rebrickable',
        source_theme_name: 'Ultimate Collector Series',
      }),
      {
        onConflict: 'id',
      },
    );
    expect(primaryThemeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Star Wars',
        id: 'theme:star-wars',
        slug: 'star-wars',
      }),
      {
        onConflict: 'id',
      },
    );
    expect(themeMappingUpsert).toHaveBeenCalledWith(
      {
        primary_theme_id: 'theme:star-wars',
        source_theme_id: 'rebrickable:592',
      },
      {
        onConflict: 'source_theme_id',
      },
    );
    expect(update).toHaveBeenCalledWith({
      primary_theme_id: 'theme:star-wars',
      source_theme_id: 'rebrickable:592',
    });
    expect(updateEq).toHaveBeenCalledWith('set_id', '75192');
  });

  test('backfills direct source themes without changing the legacy theme string', async () => {
    process.env.REBRICKABLE_API_KEY = 'test-key';
    const { supabaseClient, update } = createCatalogOverlaySupabaseClient({
      overlayRows: [
        createCatalogOverlayRow({
          set_id: '72037',
          slug: 'mario-kart-mario-standard-kart-72037',
          source_set_number: '72037-1',
          theme: 'Super Mario',
        }),
      ],
    });
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '72037-1': {
          set_num: '72037-1',
          theme_id: 696,
        },
      },
      themePayloads: {
        '696': {
          id: 696,
          name: 'Super Mario',
        },
      },
    });

    await backfillCatalogOverlayThemeIdentity({
      fetchImpl,
      supabaseClient,
    });

    expect(update).toHaveBeenCalledWith({
      primary_theme_id: 'theme:super-mario',
      source_theme_id: 'rebrickable:696',
    });
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        theme: expect.anything(),
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
    process.env.REBRICKABLE_API_KEY = 'test-key';
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
    const fetchImpl = createRebrickableFetchMock({
      setPayloads: {
        '77092-1': {
          set_num: '77092-1',
          theme_id: 999,
        },
      },
      themePayloads: {
        '999': {
          id: 999,
          name: 'The Legend of Zelda',
        },
      },
    });

    await expect(
      createCatalogOverlaySet({
        fetchImpl,
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
