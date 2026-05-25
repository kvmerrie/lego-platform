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
});
