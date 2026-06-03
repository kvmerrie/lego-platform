import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  addRecentlyViewedSetNum,
  getRecentlyViewedSetNumsForCurrentUser,
  getRecentlyViewedSetNums,
  recordRecentlyViewedSetNum,
} from './recently-viewed-sets-browser';

const authMocks = vi.hoisted(() => ({
  buildSupabaseAuthorizationHeaders: vi.fn(),
  notifyBrowserAccountDataChanged: vi.fn(),
}));

vi.mock('@lego-platform/shared/data-access-auth', () => authMocks);

function installStorageWindow() {
  const storage = new Map<string, string>();

  vi.stubGlobal('window', {
    localStorage: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
}

describe('recently viewed sets browser storage', () => {
  afterEach(() => {
    authMocks.buildSupabaseAuthorizationHeaders.mockReset();
    authMocks.buildSupabaseAuthorizationHeaders.mockResolvedValue(
      new Headers(),
    );
    authMocks.notifyBrowserAccountDataChanged.mockReset();
    vi.unstubAllGlobals();
  });

  test('keeps newest set nums first and dedupes', () => {
    installStorageWindow();

    addRecentlyViewedSetNum('10316');
    addRecentlyViewedSetNum('75355');
    addRecentlyViewedSetNum('10316');

    expect(getRecentlyViewedSetNums()).toEqual(['10316', '75355']);
  });

  test('keeps at most 12 set nums', () => {
    installStorageWindow();

    for (let index = 1; index <= 14; index += 1) {
      addRecentlyViewedSetNum(`${index}`);
    }

    expect(getRecentlyViewedSetNums()).toEqual([
      '14',
      '13',
      '12',
      '11',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
    ]);
  });

  test('clears invalid stored values', () => {
    installStorageWindow();

    window.localStorage.setItem(
      'brickhunt.recently-viewed-set-nums',
      JSON.stringify(['10316', '', 'bad value', '75355']),
    );

    expect(getRecentlyViewedSetNums()).toEqual(['10316', '75355']);
  });

  test('is a no-op when localStorage is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(() => addRecentlyViewedSetNum('10316')).not.toThrow();
    expect(getRecentlyViewedSetNums()).toEqual([]);
  });

  test('is a no-op when localStorage throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('security');
        },
        removeItem: () => {
          throw new Error('security');
        },
        setItem: () => {
          throw new Error('quota');
        },
      },
    });

    expect(() => addRecentlyViewedSetNum('10316')).not.toThrow();
    expect(getRecentlyViewedSetNums()).toEqual([]);
  });

  test('records authenticated views remotely instead of localStorage', async () => {
    installStorageWindow();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);
    authMocks.buildSupabaseAuthorizationHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer user-token',
      }),
    );

    await recordRecentlyViewedSetNum('10316');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/me/recently-viewed-sets/10316',
      {
        headers: new Headers({
          Authorization: 'Bearer user-token',
        }),
        method: 'PUT',
      },
    );
    expect(getRecentlyViewedSetNums()).toEqual([]);
    expect(authMocks.notifyBrowserAccountDataChanged).toHaveBeenCalled();
  });

  test('falls back to localStorage when authenticated write is rejected', async () => {
    installStorageWindow();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );
    authMocks.buildSupabaseAuthorizationHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer expired-token',
      }),
    );

    await recordRecentlyViewedSetNum('10316');

    expect(getRecentlyViewedSetNums()).toEqual(['10316']);
  });

  test('lists remote recent views for authenticated users', async () => {
    installStorageWindow();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          setIds: ['10316', '75355'],
        }),
      }),
    );
    authMocks.buildSupabaseAuthorizationHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer user-token',
      }),
    );

    await expect(getRecentlyViewedSetNumsForCurrentUser()).resolves.toEqual({
      isAuthenticated: true,
      setNums: ['10316', '75355'],
    });
  });

  test('merges local recent views into remote history after login', async () => {
    installStorageWindow();
    addRecentlyViewedSetNum('10316');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        setIds: ['10316', '75355'],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    authMocks.buildSupabaseAuthorizationHeaders.mockResolvedValue(
      new Headers({
        Authorization: 'Bearer user-token',
      }),
    );

    await expect(getRecentlyViewedSetNumsForCurrentUser()).resolves.toEqual({
      isAuthenticated: true,
      setNums: ['10316', '75355'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/me/recently-viewed-sets/merge',
      expect.objectContaining({
        body: JSON.stringify({ setIds: ['10316'] }),
        method: 'POST',
      }),
    );
    expect(getRecentlyViewedSetNums()).toEqual([]);
  });
});
