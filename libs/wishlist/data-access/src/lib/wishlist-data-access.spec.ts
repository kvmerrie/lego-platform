import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiPaths } from '@lego-platform/shared/config';
import {
  addLocalFollowedPriceSet,
  addWantedSet,
  getFollowedPriceSetCollection,
  getWantedSetContext,
  removeLocalFollowedPriceSet,
} from './wishlist-data-access';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  buildSupabaseAuthorizationHeaders: vi.fn(),
  notifyBrowserAccountDataChanged: vi.fn(),
}));

import {
  buildSupabaseAuthorizationHeaders,
  notifyBrowserAccountDataChanged,
} from '@lego-platform/shared/data-access-auth';

describe('wishlist data access', () => {
  function createLocalStorageMock(initialEntries: Record<string, string> = {}) {
    const storageEntries = new Map(Object.entries(initialEntries));

    return {
      getItem(key: string) {
        return storageEntries.get(key) ?? null;
      },
      removeItem(key: string) {
        storageEntries.delete(key);
      },
      setItem(key: string, value: string) {
        storageEntries.set(key, value);
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(notifyBrowserAccountDataChanged).toHaveBeenCalledTimes(1);
  });

  test('returns a sign-in-required error for anonymous wanted writes', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers(),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(addWantedSet('21348')).rejects.toThrow(
      'Log in om deze set aan je verlanglijst toe te voegen.',
    );
  });

  test('reads follow context from the current session without user-domain dependencies', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers({
        Authorization: 'Bearer browser-token',
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'authenticated',
          notificationPreferences: {
            wishlistDealAlerts: true,
          },
          wantedSetIds: ['10316', '21348', '76417'],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(getWantedSetContext('21348')).resolves.toEqual({
      alertsEnabled: true,
      isAuthenticated: true,
      wantedCount: 3,
      wantedSetState: {
        isWanted: true,
        setId: '21348',
      },
    });
  });

  test('reads locally followed price sets for signed-out sessions', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    vi.stubGlobal('window', {
      localStorage: createLocalStorageMock({
        'brickhunt.followed-price-set-ids': JSON.stringify(['10316', '21348']),
      }),
    });
    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers(),
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'anonymous',
          wantedSetIds: ['76417'],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(getWantedSetContext('21348')).resolves.toEqual({
      alertsEnabled: false,
      isAuthenticated: false,
      wantedCount: 2,
      wantedSetState: {
        isWanted: true,
        setId: '21348',
      },
    });
  });

  test('lists followed price sets for signed-out sessions from local storage', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    vi.stubGlobal('window', {
      localStorage: createLocalStorageMock({
        'brickhunt.followed-price-set-ids': JSON.stringify(['10316', '21348']),
      }),
    });
    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers(),
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'anonymous',
          wantedSetIds: ['76417'],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(getFollowedPriceSetCollection()).resolves.toEqual({
      alertsEnabled: false,
      followedSetIds: ['10316', '21348'],
      isAuthenticated: false,
    });
  });

  test('stores and removes local followed price sets without backend writes', () => {
    const localStorage = createLocalStorageMock();

    vi.stubGlobal('window', {
      localStorage,
    });

    expect(addLocalFollowedPriceSet('21348')).toEqual({
      isWanted: true,
      setId: '21348',
    });
    expect(localStorage.getItem('brickhunt.followed-price-set-ids')).toBe(
      JSON.stringify(['21348']),
    );

    expect(removeLocalFollowedPriceSet('21348')).toEqual({
      isWanted: false,
      setId: '21348',
    });
    expect(localStorage.getItem('brickhunt.followed-price-set-ids')).toBeNull();
    expect(notifyBrowserAccountDataChanged).not.toHaveBeenCalled();
  });
});
