import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiPaths } from '@lego-platform/shared/config';
import { getUserSession } from './user-data-access';
import type { UserSession } from '@lego-platform/user/util';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  buildSupabaseAuthorizationHeaders: vi.fn(),
}));

import { buildSupabaseAuthorizationHeaders } from '@lego-platform/shared/data-access-auth';

describe('user data access', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('attaches the bearer token when loading the current session', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const anonymousSession: UserSession = {
      state: 'anonymous',
      ownedSetIds: [],
      wantedSetIds: [],
    };

    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers({
        Authorization: 'Bearer browser-token',
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(anonymousSession), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await getUserSession();

    expect(fetchMock).toHaveBeenCalledWith(
      apiPaths.session,
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(new Headers(requestInit.headers).get('Authorization')).toBe(
      'Bearer browser-token',
    );
  });
});
