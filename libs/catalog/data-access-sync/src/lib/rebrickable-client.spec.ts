import { describe, expect, test, vi } from 'vitest';

import { createRebrickableClient } from './rebrickable-client';

describe('createRebrickableClient', () => {
  test('passes Rebrickable release signal filters to listSets', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    })) as unknown as typeof fetch;
    const client = createRebrickableClient({
      apiKey: 'test-key',
      fetchImpl,
      minimumRequestSpacingMs: 0,
    });

    await client.listSets({
      comingSoon: true,
      newRelease: true,
      page: 2,
      pageSize: 40,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://rebrickable.com/api/v3/lego/sets/?comingsoon=1&newrelease=1&page=2&page_size=40',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'key test-key',
        }),
      }),
    );
  });

  test('trips a per-run unavailable guard on 403 and logs once', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
      headers: new Headers(),
    })) as unknown as typeof fetch;
    const logImpl = vi.fn();
    const client = createRebrickableClient({
      apiKey: 'test-key',
      fetchImpl,
      logImpl,
      minimumRequestSpacingMs: 0,
    });

    await expect(client.getSet('10341-1')).rejects.toThrow(
      'Rebrickable request failed (403)',
    );
    await expect(client.getSet('10342-1')).rejects.toThrow(
      'Rebrickable request skipped',
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(logImpl).toHaveBeenCalledTimes(1);
    expect(logImpl).toHaveBeenCalledWith(
      'rebrickable_unavailable ip_banned_or_forbidden',
    );
  });
});
