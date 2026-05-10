import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { renderCatalogPopularitySnapshotModule } from '@lego-platform/catalog/util';
import {
  aggregateCatalogPopularityEvents,
  listCatalogPopularityEventRows,
  runCatalogPopularitySync,
  type CatalogPopularityEventRow,
} from './catalog-popularity-data-access-server';

const now = new Date('2026-05-10T12:00:00.000Z');

function eventRow(
  overrides: Partial<CatalogPopularityEventRow>,
): CatalogPopularityEventRow {
  return {
    created_at: '2026-05-10T11:00:00.000Z',
    event_type: 'set_view',
    session_id: 'session-00000001',
    set_num: '10316',
    ...overrides,
  };
}

function createSupabaseClientMock({
  errorMessage,
  pages,
}: {
  errorMessage?: string;
  pages: readonly (readonly CatalogPopularityEventRow[])[];
}) {
  let pageIndex = 0;
  const query = {
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => ({
      data: errorMessage ? null : (pages[pageIndex++] ?? []),
      error: errorMessage ? { message: errorMessage } : null,
    })),
    select: vi.fn(() => query),
  };

  return {
    from: vi.fn(() => query),
    query,
  };
}

describe('aggregateCatalogPopularityEvents', () => {
  test('calculates weighted popularity scores', () => {
    const snapshot = aggregateCatalogPopularityEvents({
      events: [
        eventRow({ event_type: 'set_view', session_id: 'session-view' }),
        eventRow({
          event_type: 'catalog_set_click',
          session_id: 'session-click',
        }),
        eventRow({ event_type: 'offer_click', session_id: 'session-offer' }),
      ],
      now,
    });

    expect(snapshot.windows.day).toEqual([
      {
        set_num: '10316',
        score: 12,
        counts: {
          set_view: 1,
          catalog_set_click: 1,
          offer_click: 1,
        },
      },
    ]);
  });

  test('deduplicates by session, set number, and event type per window', () => {
    const snapshot = aggregateCatalogPopularityEvents({
      events: [
        eventRow({ event_type: 'offer_click', session_id: 'session-a' }),
        eventRow({ event_type: 'offer_click', session_id: 'session-a' }),
        eventRow({ event_type: 'set_view', session_id: 'session-a' }),
        eventRow({ event_type: 'set_view', session_id: 'session-a' }),
      ],
      now,
    });

    expect(snapshot.windows.day).toEqual([
      {
        set_num: '10316',
        score: 9,
        counts: {
          set_view: 1,
          catalog_set_click: 0,
          offer_click: 1,
        },
      },
    ]);
  });

  test('filters sets below the score threshold', () => {
    const snapshot = aggregateCatalogPopularityEvents({
      events: [
        eventRow({ session_id: 'session-a', set_num: '10316' }),
        eventRow({ session_id: 'session-b', set_num: '10316' }),
        eventRow({ session_id: 'session-c', set_num: '10316' }),
        eventRow({ session_id: 'session-d', set_num: '10316' }),
      ],
      now,
    });

    expect(snapshot.windows.day).toEqual([]);
  });

  test('sorts deterministically by score, counts, and set number', () => {
    const snapshot = aggregateCatalogPopularityEvents({
      events: [
        eventRow({
          event_type: 'catalog_set_click',
          session_id: 'session-a',
          set_num: '10316',
        }),
        eventRow({
          event_type: 'catalog_set_click',
          session_id: 'session-b',
          set_num: '10316',
        }),
        eventRow({
          event_type: 'offer_click',
          session_id: 'session-c',
          set_num: '21348',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-d',
          set_num: '10294',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-e',
          set_num: '10294',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-f',
          set_num: '10294',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-g',
          set_num: '10294',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-h',
          set_num: '10294',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-i',
          set_num: '10305',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-j',
          set_num: '10305',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-k',
          set_num: '10305',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-l',
          set_num: '10305',
        }),
        eventRow({
          event_type: 'set_view',
          session_id: 'session-m',
          set_num: '10305',
        }),
      ],
      now,
    });

    expect(snapshot.windows.day.map(({ set_num }) => set_num)).toEqual([
      '21348',
      '10316',
      '10294',
      '10305',
    ]);
  });

  test('separates 24-hour and 7-day windows', () => {
    const snapshot = aggregateCatalogPopularityEvents({
      events: [
        eventRow({ event_type: 'offer_click', session_id: 'session-day' }),
        eventRow({
          created_at: '2026-05-05T12:00:00.000Z',
          event_type: 'offer_click',
          session_id: 'session-week',
          set_num: '21348',
        }),
      ],
      now,
    });

    expect(snapshot.windows.day.map(({ set_num }) => set_num)).toEqual([
      '10316',
    ]);
    expect(snapshot.windows.week.map(({ set_num }) => set_num)).toEqual([
      '10316',
      '21348',
    ]);
  });

  test('handles empty input', () => {
    const snapshot = aggregateCatalogPopularityEvents({
      events: [],
      now,
    });

    expect(snapshot).toEqual({
      generatedAt: '2026-05-10T12:00:00.000Z',
      windows: {
        day: [],
        week: [],
      },
    });
  });
});

describe('listCatalogPopularityEventRows', () => {
  test('returns an empty list for an empty database window', async () => {
    const { from } = createSupabaseClientMock({
      pages: [[]],
    });

    await expect(
      listCatalogPopularityEventRows({
        eventPageSize: 2,
        maxEventRows: 2,
        now,
        supabaseClient: { from } as never,
      }),
    ).resolves.toEqual([]);
  });

  test('throws on Supabase errors', async () => {
    const { from } = createSupabaseClientMock({
      errorMessage: 'db unavailable',
      pages: [],
    });

    await expect(
      listCatalogPopularityEventRows({
        eventPageSize: 2,
        maxEventRows: 2,
        now,
        supabaseClient: { from } as never,
      }),
    ).rejects.toThrow(
      'Unable to load catalog user events for popularity aggregation.',
    );
  });

  test('throws before returning a partial result when the row cap is exceeded', async () => {
    const { from } = createSupabaseClientMock({
      pages: [
        [
          eventRow({ session_id: 'session-a' }),
          eventRow({ session_id: 'session-b' }),
        ],
        [eventRow({ session_id: 'session-c' })],
      ],
    });

    await expect(
      listCatalogPopularityEventRows({
        eventPageSize: 2,
        maxEventRows: 2,
        now,
        supabaseClient: { from } as never,
      }),
    ).rejects.toThrow(
      'Catalog popularity aggregation exceeded the fail-safe limit of 2 event rows per run.',
    );
  });
});

describe('runCatalogPopularitySync', () => {
  test('writes an empty artifact for an empty database window', async () => {
    const workspaceRoot = await mkdtemp(
      resolve(tmpdir(), 'catalog-popularity-sync-'),
    );
    const artifactPath = resolve(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-popularity-snapshot.generated.ts',
    );
    const { from } = createSupabaseClientMock({
      pages: [[]],
    });

    try {
      const result = await runCatalogPopularitySync({
        mode: 'write',
        now,
        supabaseClient: { from } as never,
        workspaceRoot,
      });

      expect(result.artifactCheck.isClean).toBe(false);
      expect(result.popularitySnapshot).toEqual({
        generatedAt: '2026-05-10T12:00:00.000Z',
        windows: {
          day: [],
          week: [],
        },
      });
      expect(await readFile(artifactPath, 'utf8')).toBe(
        renderCatalogPopularitySnapshotModule(result.popularitySnapshot),
      );
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });

  test('does not mark check mode stale only because generatedAt changed', async () => {
    const workspaceRoot = await mkdtemp(
      resolve(tmpdir(), 'catalog-popularity-sync-'),
    );
    const artifactPath = resolve(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-popularity-snapshot.generated.ts',
    );
    const currentSnapshot = {
      generatedAt: '2026-05-09T12:00:00.000Z',
      windows: {
        day: [],
        week: [],
      },
    };
    const { from } = createSupabaseClientMock({
      pages: [[]],
    });

    await mkdir(dirname(artifactPath), { recursive: true });
    await writeFile(
      artifactPath,
      renderCatalogPopularitySnapshotModule(currentSnapshot),
      'utf8',
    );

    try {
      const result = await runCatalogPopularitySync({
        mode: 'check',
        now,
        supabaseClient: { from } as never,
        workspaceRoot,
      });

      expect(result.artifactCheck.isClean).toBe(true);
      expect(result.popularitySnapshot.generatedAt).toBe(
        currentSnapshot.generatedAt,
      );
      expect(await readFile(artifactPath, 'utf8')).toBe(
        renderCatalogPopularitySnapshotModule(currentSnapshot),
      );
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });
});
