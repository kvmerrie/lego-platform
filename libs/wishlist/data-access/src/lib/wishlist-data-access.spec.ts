import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiPaths } from '@lego-platform/shared/config';
import { addWantedSet } from './wishlist-data-access';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  buildSupabaseAuthorizationHeaders: vi.fn(),
}));

import { buildSupabaseAuthorizationHeaders } from '@lego-platform/shared/data-access-auth';

describe('wishlist data access', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('attaches the bearer token when marking a set as wanted', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers({
        Authorization: 'Bearer browser-token',
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          setId: '21348',
          isWanted: true,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await addWantedSet('21348');

    expect(fetchMock).toHaveBeenCalledWith(
      `${apiPaths.wantedSets}/21348`,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.any(Headers),
      }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(new Headers(requestInit.headers).get('Authorization')).toBe(
      'Bearer browser-token',
    );
  });
});
