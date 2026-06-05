import { gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import {
  parseRebrickableSetsCsv,
  parseRebrickableThemesCsv,
  syncLocalRebrickableMirror,
} from './rebrickable-mirror-sync-server';

function createSupabaseClientMock() {
  const upsertByTable = new Map<string, ReturnType<typeof vi.fn>>();

  return {
    supabaseClient: {
      from: vi.fn((table: string) => {
        const upsert =
          upsertByTable.get(table) ??
          vi.fn(async () => ({
            error: null,
          }));
        upsertByTable.set(table, upsert);

        return { upsert };
      }),
    },
    upsertByTable,
  };
}

describe('Rebrickable mirror CSV parsing', () => {
  test('parses themes.csv rows', () => {
    const parsed = parseRebrickableThemesCsv({
      csvText: 'id,name,parent_id\n1,System,\n2,Space,1\n',
      nowIso: '2026-06-04T10:00:00.000Z',
      sourceUpdatedAt: '2026-06-04T08:00:00.000Z',
    });

    expect(parsed).toEqual({
      downloadedRows: 2,
      rows: [
        {
          id: 1,
          name: 'System',
          parent_id: null,
          source_updated_at: '2026-06-04T08:00:00.000Z',
          synced_at: '2026-06-04T10:00:00.000Z',
        },
        {
          id: 2,
          name: 'Space',
          parent_id: 1,
          source_updated_at: '2026-06-04T08:00:00.000Z',
          synced_at: '2026-06-04T10:00:00.000Z',
        },
      ],
      skippedRows: 0,
    });
  });

  test('parses sets.csv rows', () => {
    const parsed = parseRebrickableSetsCsv({
      csvText:
        'set_num,name,year,theme_id,num_parts,img_url\n10341-1,NASA Artemis Space Launch System,2024,2,3601,https://img.example/10341.jpg\nbad,,2024,2,1,\n',
      nowIso: '2026-06-04T10:00:00.000Z',
    });

    expect(parsed.downloadedRows).toBe(2);
    expect(parsed.skippedRows).toBe(1);
    expect(parsed.rows).toEqual([
      {
        img_url: 'https://img.example/10341.jpg',
        name: 'NASA Artemis Space Launch System',
        num_parts: 3601,
        set_img_url: null,
        set_num: '10341-1',
        source_updated_at: null,
        synced_at: '2026-06-04T10:00:00.000Z',
        theme_id: 2,
        year: 2024,
      },
    ]);
  });
});

describe('syncLocalRebrickableMirror', () => {
  test('upserts mirror rows from downloaded gzip CSV files', async () => {
    const themesCsv = 'id,name,parent_id\n1,System,\n2,Space,1\n';
    const setsCsv =
      'set_num,name,year,theme_id,num_parts,img_url\n10341-1,NASA Artemis Space Launch System,2024,2,3601,https://img.example/10341.jpg\n';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => gzipSync(Buffer.from(themesCsv)),
        headers: new Headers({
          'last-modified': 'Thu, 04 Jun 2026 08:00:00 GMT',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => gzipSync(Buffer.from(setsCsv)),
        headers: new Headers({
          'last-modified': 'Thu, 04 Jun 2026 08:00:00 GMT',
        }),
      }) as unknown as typeof fetch;
    const { supabaseClient, upsertByTable } = createSupabaseClientMock();

    const result = await syncLocalRebrickableMirror({
      fetchImpl,
      limit: 10,
      supabaseClient: supabaseClient as never,
    });

    expect(result.themes?.upsertedRows).toBe(2);
    expect(result.sets?.upsertedRows).toBe(1);
    expect(upsertByTable.get('rebrickable_themes')).toHaveBeenCalledTimes(1);
    expect(upsertByTable.get('rebrickable_sets')).toHaveBeenCalledTimes(1);
  });

  test('dry-run parses rows but does not write', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () =>
        gzipSync(Buffer.from('id,name,parent_id\n1,System,\n')),
      headers: new Headers(),
    }) as unknown as typeof fetch;
    const { supabaseClient } = createSupabaseClientMock();

    const result = await syncLocalRebrickableMirror({
      dryRun: true,
      fetchImpl,
      limit: 10,
      supabaseClient: supabaseClient as never,
      themesOnly: true,
    });

    expect(result.themes?.parsedRows).toBe(1);
    expect(result.themes?.upsertedRows).toBe(0);
    expect(supabaseClient.from).not.toHaveBeenCalled();
  });
});
