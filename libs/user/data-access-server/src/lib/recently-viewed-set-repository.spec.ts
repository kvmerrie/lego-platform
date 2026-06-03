import { describe, expect, test, vi } from 'vitest';
import {
  createRecentlyViewedSetRepository,
  RECENTLY_VIEWED_SET_LIMIT,
} from './recently-viewed-set-repository';

describe('recently viewed set repository', () => {
  test('lists recent viewed sets newest first for one user', async () => {
    const orderCalls: Array<[string, { ascending: boolean }]> = [];
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn((column: string, options: { ascending: boolean }) => {
        orderCalls.push([column, options]);
        return queryBuilder;
      }),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            user_id: 'user-123',
            set_id: '10316',
            viewed_at: '2026-06-03T08:00:00.000Z',
            created_at: '2026-06-03T08:00:00.000Z',
          },
        ],
        error: null,
      }),
    };
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    };
    const repository = createRecentlyViewedSetRepository(
      supabaseClient as never,
    );

    await expect(repository.listByUserId('user-123')).resolves.toEqual([
      {
        userId: 'user-123',
        setId: '10316',
        viewedAt: '2026-06-03T08:00:00.000Z',
        createdAt: '2026-06-03T08:00:00.000Z',
      },
    ]);
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(orderCalls).toEqual([
      ['viewed_at', { ascending: false }],
      ['set_id', { ascending: true }],
    ]);
  });

  test('upserts repeated views on user and set id', async () => {
    const upsert = vi.fn();
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          set_id: '42177',
          viewed_at: '2026-06-03T08:00:00.000Z',
          created_at: '2026-06-03T07:00:00.000Z',
        },
        error: null,
      }),
      upsert: vi.fn((row: unknown, options: unknown) => {
        upsert(row, options);
        return queryBuilder;
      }),
    };
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    };
    const repository = createRecentlyViewedSetRepository(
      supabaseClient as never,
    );

    await repository.upsertViewedSet({
      userId: 'user-123',
      setId: '42177-1',
      viewedAt: '2026-06-03T08:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-123',
        set_id: '42177',
        viewed_at: '2026-06-03T08:00:00.000Z',
      },
      {
        onConflict: 'user_id,set_id',
      },
    );
  });

  test('prunes records beyond the recent viewed cap after writes', async () => {
    const deleteQueryBuilder = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        error: null,
      }),
    };
    const queryBuilder = {
      delete: vi.fn().mockReturnValue(deleteQueryBuilder),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ set_id: 'old-set' }],
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          set_id: '10316',
          viewed_at: '2026-06-03T08:00:00.000Z',
          created_at: '2026-06-03T08:00:00.000Z',
        },
        error: null,
      }),
      upsert: vi.fn().mockReturnThis(),
    };
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    };
    const repository = createRecentlyViewedSetRepository(
      supabaseClient as never,
    );

    await repository.upsertViewedSet({
      userId: 'user-123',
      setId: '10316',
    });

    expect(queryBuilder.range).toHaveBeenCalledWith(
      RECENTLY_VIEWED_SET_LIMIT,
      10_000,
    );
    expect(deleteQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(deleteQueryBuilder.in).toHaveBeenCalledWith('set_id', ['old-set']);
  });
});
