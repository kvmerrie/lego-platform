import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import {
  buildCatalogCleanBootstrapPayload,
  importCatalogCleanBootstrapPayload,
  verifyCatalogCleanBootstrapImport,
  writeCatalogCleanBootstrapPayload,
} from './catalog-clean-bootstrap';

type MockSupabaseClient = Pick<SupabaseClient, 'from'>;

function createResolvedQuery<TData>(data: readonly TData[]) {
  return {
    data,
    error: null,
  };
}

function createQueryBuilder<TData>(data: readonly TData[]) {
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
    select: vi.fn(() => queryBuilder),
    then: vi.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(createResolvedQuery(data)).then(resolve),
    ),
  };

  return queryBuilder;
}

function createMutableSupabaseClient(
  initialTables: Record<string, readonly Record<string, unknown>[]>,
) {
  const tables = new Map(
    Object.entries(initialTables).map(([table, rows]) => [
      table,
      rows.map((row) => ({ ...row })),
    ]),
  );
  const operationLog: string[] = [];

  function getRows(table: string) {
    const rows = tables.get(table);

    if (rows) {
      return rows;
    }

    const emptyRows: Record<string, unknown>[] = [];
    tables.set(table, emptyRows);
    return emptyRows;
  }

  const supabaseClient = {
    from(table: string) {
      const selectedColumns: string[] = [];
      const eqFilters: Array<{ column: string; value: unknown }> = [];

      const queryBuilder = {
        eq(column: string, value: unknown) {
          eqFilters.push({
            column,
            value,
          });

          return queryBuilder;
        },
        order() {
          return queryBuilder;
        },
        select(columns: string) {
          selectedColumns.splice(
            0,
            selectedColumns.length,
            ...columns.split(',').map((column) => column.trim()),
          );

          return queryBuilder;
        },
        then(resolve: (value: unknown) => unknown) {
          let rows = [...getRows(table)];

          for (const filter of eqFilters) {
            rows = rows.filter((row) => row[filter.column] === filter.value);
          }

          if (selectedColumns.length > 0) {
            rows = rows.map((row) =>
              selectedColumns.reduce<Record<string, unknown>>(
                (projection, column) => {
                  projection[column] = row[column];
                  return projection;
                },
                {},
              ),
            );
          }

          return Promise.resolve({
            data: rows,
            error: null,
          }).then(resolve);
        },
        upsert(
          rows: readonly Record<string, unknown>[],
          options?: { onConflict?: string },
        ) {
          operationLog.push(`upsert:${table}`);

          const conflictColumns = (options?.onConflict ?? 'id')
            .split(',')
            .map((column) => column.trim())
            .filter(Boolean);
          const existingRows = getRows(table);

          for (const row of rows) {
            const existingIndex = existingRows.findIndex((existingRow) =>
              conflictColumns.every(
                (column) => existingRow[column] === row[column],
              ),
            );

            if (existingIndex >= 0) {
              existingRows[existingIndex] = {
                ...existingRows[existingIndex],
                ...row,
              };
            } else {
              existingRows.push({ ...row });
            }
          }

          return Promise.resolve({
            data: null,
            error: null,
          });
        },
      };

      return queryBuilder;
    },
  } satisfies MockSupabaseClient;

  return {
    operationLog,
    supabaseClient,
    tables,
  };
}

describe('catalog clean bootstrap payload', () => {
  test('clean baseline includes public catalog read policies for theme and set tables', () => {
    const cleanBaselineSql = readFileSync(
      new URL(
        '../../../../../supabase/bootstrap/brickhunt-clean-baseline.sql',
        import.meta.url,
      ),
      'utf8',
    );

    expect(cleanBaselineSql).toContain(
      'create policy "catalog_source_themes_select_public"',
    );
    expect(cleanBaselineSql).toContain(
      'on public.catalog_source_themes\nfor select\nto anon, authenticated\nusing (true);',
    );
    expect(cleanBaselineSql).toContain(
      'create policy "catalog_themes_select_public"',
    );
    expect(cleanBaselineSql).toContain(
      "on public.catalog_themes\nfor select\nto anon, authenticated\nusing (status = 'active');",
    );
    expect(cleanBaselineSql).toContain(
      'create policy "catalog_theme_mappings_select_public"',
    );
    expect(cleanBaselineSql).toContain(
      'on public.catalog_theme_mappings\nfor select\nto anon, authenticated\nusing (true);',
    );
    expect(cleanBaselineSql).toContain(
      'create policy "catalog_sets_select_public"',
    );
    expect(cleanBaselineSql).toContain(
      "on public.catalog_sets\nfor select\nto anon, authenticated\nusing (status = 'active');",
    );
  });

  test('builds a minimal clean payload from canonical catalog and commerce tables', async () => {
    const catalogSetsQuery = createQueryBuilder([
      {
        created_at: '2026-04-18T08:00:00.000Z',
        image_url: 'https://cdn.test/75192.jpg',
        name: 'Millennium Falcon',
        piece_count: 7541,
        primary_theme_id: 'theme:star-wars',
        release_year: 2017,
        set_id: '75192',
        slug: 'millennium-falcon-75192',
        source: 'rebrickable',
        source_set_number: '75192-1',
        source_theme_id: 'rebrickable:158',
        status: 'active',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
    ]);
    const sourceThemesQuery = createQueryBuilder([
      {
        created_at: '2026-04-18T08:00:00.000Z',
        id: 'rebrickable:171',
        parent_source_theme_id: null,
        source_system: 'rebrickable',
        source_theme_name: 'Star Wars',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
      {
        created_at: '2026-04-18T08:00:00.000Z',
        id: 'rebrickable:158',
        parent_source_theme_id: 'rebrickable:171',
        source_system: 'rebrickable',
        source_theme_name: 'Ultimate Collector Series',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
    ]);
    const themesQuery = createQueryBuilder([
      {
        created_at: '2026-04-18T08:00:00.000Z',
        display_name: 'Star Wars',
        id: 'theme:star-wars',
        slug: 'star-wars',
        status: 'active',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
    ]);
    const themeMappingsQuery = createQueryBuilder([
      {
        created_at: '2026-04-18T08:00:00.000Z',
        primary_theme_id: 'theme:star-wars',
        source_theme_id: 'rebrickable:158',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
    ]);
    const merchantsQuery = createQueryBuilder([
      {
        affiliate_network: null,
        created_at: '2026-04-18T08:00:00.000Z',
        id: 'merchant-lego',
        is_active: true,
        name: 'LEGO',
        notes: '',
        slug: 'lego-nl',
        source_type: 'direct',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
    ]);
    const offerSeedsQuery = createQueryBuilder([
      {
        created_at: '2026-04-18T08:00:00.000Z',
        id: 'seed-1',
        is_active: true,
        last_verified_at: '2026-04-18T09:30:00.000Z',
        merchant_id: 'merchant-lego',
        notes: '',
        product_url:
          'https://www.lego.com/nl-nl/product/millennium-falcon-75192',
        set_id: '75192',
        updated_at: '2026-04-18T09:30:00.000Z',
        validation_status: 'valid',
      },
    ]);
    const benchmarkSetsQuery = createQueryBuilder([
      {
        created_at: '2026-04-18T08:00:00.000Z',
        notes: 'High-signal benchmark',
        set_id: '75192',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
    ]);
    const from = vi.fn((table: string) => {
      if (table === 'catalog_sets_overlay') {
        return catalogSetsQuery;
      }

      if (table === 'catalog_source_themes') {
        return sourceThemesQuery;
      }

      if (table === 'catalog_themes') {
        return themesQuery;
      }

      if (table === 'catalog_theme_mappings') {
        return themeMappingsQuery;
      }

      if (table === 'commerce_merchants') {
        return merchantsQuery;
      }

      if (table === 'commerce_offer_seeds') {
        return offerSeedsQuery;
      }

      if (table === 'commerce_benchmark_sets') {
        return benchmarkSetsQuery;
      }

      throw new Error(`Unexpected table ${table}`);
    });
    const supabaseClient = {
      from,
    } satisfies MockSupabaseClient;

    const payload = await buildCatalogCleanBootstrapPayload({
      now: new Date('2026-04-18T10:00:00.000Z'),
      supabaseClient,
    });

    expect(payload.catalog.sets).toEqual([
      {
        createdAt: '2026-04-18T08:00:00.000Z',
        imageUrl: 'https://cdn.test/75192.jpg',
        name: 'Millennium Falcon',
        pieceCount: 7541,
        primaryThemeId: 'theme:star-wars',
        releaseYear: 2017,
        setId: '75192',
        slug: 'millennium-falcon-75192',
        source: 'rebrickable',
        sourceSetNumber: '75192-1',
        sourceThemeId: 'rebrickable:158',
        status: 'active',
        updatedAt: '2026-04-18T09:00:00.000Z',
      },
    ]);
    expect(payload.catalog.sourceThemes[0]).toEqual({
      createdAt: '2026-04-18T08:00:00.000Z',
      id: 'rebrickable:158',
      parentSourceThemeId: 'rebrickable:171',
      sourceSystem: 'rebrickable',
      sourceThemeName: 'Ultimate Collector Series',
      updatedAt: '2026-04-18T09:00:00.000Z',
    });
    expect(payload.commerce.offerSeeds).toHaveLength(1);
    expect(payload.exclusions.latestOffers).toBe('excluded');
  });

  test('fails when a set is still missing normalized theme ids', async () => {
    const catalogSetsQuery = createQueryBuilder([
      {
        created_at: '2026-04-18T08:00:00.000Z',
        image_url: null,
        name: 'X-Wing Starfighter',
        piece_count: 1949,
        primary_theme_id: null,
        release_year: 2023,
        set_id: '75355',
        slug: 'x-wing-starfighter-75355',
        source: 'rebrickable',
        source_set_number: '75355-1',
        source_theme_id: null,
        status: 'active',
        updated_at: '2026-04-18T09:00:00.000Z',
      },
    ]);
    const emptyQuery = createQueryBuilder([]);
    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'catalog_sets_overlay') {
          return catalogSetsQuery;
        }

        return emptyQuery;
      }),
    } satisfies MockSupabaseClient;

    await expect(
      buildCatalogCleanBootstrapPayload({
        supabaseClient,
      }),
    ).rejects.toThrow(/missing normalized theme ids/i);
  });

  test('writes the clean bootstrap payload as formatted json', async () => {
    const mkdirMock = vi.fn().mockResolvedValue(undefined);
    const writeFileMock = vi.fn().mockResolvedValue(undefined);
    const payload = {
      catalog: {
        sets: [],
        sourceThemes: [],
        themeMappings: [],
        themes: [],
      },
      commerce: {
        benchmarkSets: [],
        merchants: [],
        offerSeeds: [],
      },
      exclusions: {
        latestOffers: 'excluded',
        localCatalogProse: 'excluded',
        pricingHistoryRows: 'excluded',
        snapshotArtifacts: 'excluded',
        userData: 'excluded',
      },
      generatedAt: '2026-04-18T10:00:00.000Z',
      notes: 'test',
      source: 'brickhunt-clean-bootstrap' as const,
    };

    const outputPath = await writeCatalogCleanBootstrapPayload({
      cwd: '/Users/k40390/dev/lego-builder',
      mkdirImpl: mkdirMock,
      outputPath: 'tmp/clean-bootstrap.json',
      payload,
      writeFileImpl: writeFileMock,
    });

    expect(outputPath).toBe(
      '/Users/k40390/dev/lego-builder/tmp/clean-bootstrap.json',
    );
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalledWith(
      '/Users/k40390/dev/lego-builder/tmp/clean-bootstrap.json',
      expect.stringContaining('"source": "brickhunt-clean-bootstrap"'),
      'utf8',
    );
  });

  test('imports the clean bootstrap payload into the target tables in bootstrap order', async () => {
    const payload = {
      catalog: {
        sets: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            imageUrl: 'https://cdn.test/75192.jpg',
            name: 'Millennium Falcon',
            pieceCount: 7541,
            primaryThemeId: 'theme:star-wars',
            releaseYear: 2017,
            setId: '75192',
            slug: 'millennium-falcon-75192',
            source: 'rebrickable',
            sourceSetNumber: '75192-1',
            sourceThemeId: 'rebrickable:158',
            status: 'active',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        sourceThemes: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            id: 'rebrickable:171',
            sourceSystem: 'rebrickable',
            sourceThemeName: 'Star Wars',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            id: 'rebrickable:158',
            parentSourceThemeId: 'rebrickable:171',
            sourceSystem: 'rebrickable',
            sourceThemeName: 'Ultimate Collector Series',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        themeMappings: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            primaryThemeId: 'theme:star-wars',
            sourceThemeId: 'rebrickable:158',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        themes: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            displayName: 'Star Wars',
            id: 'theme:star-wars',
            slug: 'star-wars',
            status: 'active',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
      },
      commerce: {
        benchmarkSets: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            notes: 'High-signal benchmark',
            setId: '75192',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        merchants: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            id: 'merchant-lego',
            isActive: true,
            name: 'LEGO',
            notes: '',
            slug: 'lego-nl',
            sourceType: 'direct',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        offerSeeds: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            id: 'seed-1',
            isActive: true,
            lastVerifiedAt: '2026-04-18T09:30:00.000Z',
            merchantId: 'merchant-lego',
            notes: '',
            productUrl:
              'https://www.lego.com/nl-nl/product/millennium-falcon-75192',
            setId: '75192',
            updatedAt: '2026-04-18T09:30:00.000Z',
            validationStatus: 'valid',
          },
        ],
      },
      exclusions: {
        latestOffers: 'excluded',
        localCatalogProse: 'excluded',
        pricingHistoryRows: 'excluded',
        snapshotArtifacts: 'excluded',
        userData: 'excluded',
      },
      generatedAt: '2026-04-18T10:00:00.000Z',
      notes: 'test',
      source: 'brickhunt-clean-bootstrap' as const,
    };
    const { operationLog, supabaseClient, tables } =
      createMutableSupabaseClient({
        catalog_themes: [
          {
            created_at: '2026-04-17T08:00:00.000Z',
            display_name: 'Legacy Star Wars',
            id: 'theme:star-wars',
            slug: 'star-wars',
            status: 'active',
            updated_at: '2026-04-17T09:00:00.000Z',
          },
        ],
        commerce_merchants: [
          {
            affiliate_network: null,
            created_at: '2026-04-17T08:00:00.000Z',
            id: 'merchant-lego',
            is_active: true,
            name: 'LEGO',
            notes: 'legacy',
            slug: 'lego-nl',
            source_type: 'direct',
            updated_at: '2026-04-17T09:00:00.000Z',
          },
        ],
      });

    const summary = await importCatalogCleanBootstrapPayload({
      payload,
      supabaseClient,
    });

    expect(operationLog).toEqual([
      'upsert:catalog_source_themes',
      'upsert:catalog_themes',
      'upsert:catalog_theme_mappings',
      'upsert:catalog_sets',
      'upsert:commerce_merchants',
      'upsert:commerce_benchmark_sets',
      'upsert:commerce_offer_seeds',
    ]);
    expect(summary.steps).toEqual([
      {
        insertedCount: 2,
        inputCount: 2,
        table: 'catalog_source_themes',
        updatedCount: 0,
      },
      {
        insertedCount: 0,
        inputCount: 1,
        table: 'catalog_themes',
        updatedCount: 1,
      },
      {
        insertedCount: 1,
        inputCount: 1,
        table: 'catalog_theme_mappings',
        updatedCount: 0,
      },
      {
        insertedCount: 1,
        inputCount: 1,
        table: 'catalog_sets',
        updatedCount: 0,
      },
      {
        insertedCount: 0,
        inputCount: 1,
        table: 'commerce_merchants',
        updatedCount: 1,
      },
      {
        insertedCount: 1,
        inputCount: 1,
        table: 'commerce_benchmark_sets',
        updatedCount: 0,
      },
      {
        insertedCount: 1,
        inputCount: 1,
        table: 'commerce_offer_seeds',
        updatedCount: 0,
      },
    ]);
    expect(tables.get('catalog_sets')).toEqual([
      expect.objectContaining({
        set_id: '75192',
        source_theme_id: 'rebrickable:158',
      }),
    ]);
    expect(tables.get('commerce_offer_seeds')).toEqual([
      expect.objectContaining({
        id: 'seed-1',
        set_id: '75192',
      }),
    ]);
  });

  test('verifies whether all payload rows are present in the target environment', async () => {
    const payload = {
      catalog: {
        sets: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            name: 'Millennium Falcon',
            pieceCount: 7541,
            primaryThemeId: 'theme:star-wars',
            releaseYear: 2017,
            setId: '75192',
            slug: 'millennium-falcon-75192',
            source: 'rebrickable',
            sourceSetNumber: '75192-1',
            sourceThemeId: 'rebrickable:158',
            status: 'active',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        sourceThemes: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            id: 'rebrickable:158',
            sourceSystem: 'rebrickable',
            sourceThemeName: 'Ultimate Collector Series',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        themeMappings: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            primaryThemeId: 'theme:star-wars',
            sourceThemeId: 'rebrickable:158',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        themes: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            displayName: 'Star Wars',
            id: 'theme:star-wars',
            slug: 'star-wars',
            status: 'active',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
      },
      commerce: {
        benchmarkSets: [],
        merchants: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            id: 'merchant-lego',
            isActive: true,
            name: 'LEGO',
            notes: '',
            slug: 'lego-nl',
            sourceType: 'direct',
            updatedAt: '2026-04-18T09:00:00.000Z',
          },
        ],
        offerSeeds: [
          {
            createdAt: '2026-04-18T08:00:00.000Z',
            id: 'seed-1',
            isActive: true,
            merchantId: 'merchant-lego',
            notes: '',
            productUrl:
              'https://www.lego.com/nl-nl/product/millennium-falcon-75192',
            setId: '75192',
            updatedAt: '2026-04-18T09:30:00.000Z',
            validationStatus: 'valid',
          },
        ],
      },
      exclusions: {
        latestOffers: 'excluded',
        localCatalogProse: 'excluded',
        pricingHistoryRows: 'excluded',
        snapshotArtifacts: 'excluded',
        userData: 'excluded',
      },
      generatedAt: '2026-04-18T10:00:00.000Z',
      notes: 'test',
      source: 'brickhunt-clean-bootstrap' as const,
    };
    const { supabaseClient } = createMutableSupabaseClient({
      catalog_sets: [
        {
          set_id: '75192',
        },
      ],
      catalog_source_themes: [
        {
          id: 'rebrickable:158',
        },
      ],
      catalog_theme_mappings: [
        {
          source_theme_id: 'rebrickable:158',
        },
      ],
      catalog_themes: [
        {
          id: 'theme:star-wars',
        },
      ],
    });

    const summary = await verifyCatalogCleanBootstrapImport({
      payload,
      supabaseClient,
    });

    expect(summary.isComplete).toBe(false);
    expect(summary.steps).toContainEqual({
      expectedCount: 1,
      matchedCount: 0,
      missingKeys: ['id:seed-1'],
      table: 'commerce_offer_seeds',
    });
  });
});
