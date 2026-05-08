import { describe, expect, test, vi } from 'vitest';
import { createUserSetStatusRepository } from './user-set-status-repository';

describe('user set status repository', () => {
  test('normalizes set ids before wishlist reads and upserts', async () => {
    const eqCalls: [string, string][] = [];
    const upsert = vi.fn();
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((column: string, value: string) => {
        eqCalls.push([column, value]);
        return queryBuilder;
      }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      upsert: vi.fn((row: unknown) => {
        upsert(row);
        return queryBuilder;
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-123',
          set_id: '42177',
          is_owned: false,
          is_wanted: true,
          created_at: '2026-05-08T10:00:00.000Z',
          updated_at: '2026-05-08T10:00:00.000Z',
        },
        error: null,
      }),
    };
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    };
    const repository = createUserSetStatusRepository(supabaseClient as never);

    await repository.setWantedState({
      userId: 'user-123',
      setId: '42177-1',
      isWanted: true,
    });

    expect(eqCalls).toContainEqual(['set_id', '42177']);
    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      set_id: '42177',
      is_owned: false,
      is_wanted: true,
    });
  });
});
