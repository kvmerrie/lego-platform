import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiPaths } from '@lego-platform/shared/config';
import {
  getCurrentUserProfile,
  getUserSession,
  requestUserSignIn,
  signOutCurrentUser,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
  updateCurrentUserProfile,
} from './user-data-access';
import type { CollectorProfile, UserSession } from '@lego-platform/user/util';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  buildSupabaseAuthorizationHeaders: vi.fn(),
  signInWithSupabaseOtp: vi.fn(),
  signOutSupabaseBrowserSession: vi.fn(),
  subscribeToSupabaseAuthChanges: vi.fn(),
}));

import {
  buildSupabaseAuthorizationHeaders,
  signInWithSupabaseOtp,
  signOutSupabaseBrowserSession,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';

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

  test('starts email sign-in with a redirect back to the current page', async () => {
    vi.stubGlobal('window', {
      location: {
        href: 'http://localhost:3000/sets/rivendell-10316',
      },
    });
    vi.mocked(signInWithSupabaseOtp).mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: null,
    });

    await requestUserSignIn({
      email: 'collector@example.com',
    });

    expect(signInWithSupabaseOtp).toHaveBeenCalledWith({
      email: 'collector@example.com',
      emailRedirectTo: 'http://localhost:3000/sets/rivendell-10316',
    });
  });

  test('signs out through the shared browser auth utility', async () => {
    vi.mocked(signOutSupabaseBrowserSession).mockResolvedValue({
      error: null,
    });

    await signOutCurrentUser();

    expect(signOutSupabaseBrowserSession).toHaveBeenCalledTimes(1);
  });

  test('returns null when loading the current collector profile without a valid session', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers({
        Authorization: 'Bearer browser-token',
      }),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(getCurrentUserProfile()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      apiPaths.profile,
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
  });

  test('updates the current collector profile and notifies account listeners', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const collectorProfile: CollectorProfile = {
      displayName: 'Alex Rivera',
      collectorHandle: 'alex-rivera',
      location: 'Rotterdam',
      collectionFocus: 'Castle icons and Ideas cabins',
      tier: 'Founding Collector',
      email: 'alex@example.test',
    };
    const onAccountChange = vi.fn();

    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers({
        Authorization: 'Bearer browser-token',
        'Content-Type': 'application/json',
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(collectorProfile), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    const unsubscribe = subscribeToUserAccountChanges(onAccountChange);

    try {
      const updatedCollectorProfile = await updateCurrentUserProfile({
        displayName: 'Alex Rivera',
        collectorHandle: ' Alex Rivera ',
        location: 'Rotterdam',
        collectionFocus: 'Castle icons and Ideas cabins',
      });

      expect(updatedCollectorProfile).toEqual(collectorProfile);
      expect(fetchMock).toHaveBeenCalledWith(
        apiPaths.profile,
        expect.objectContaining({
          body: JSON.stringify({
            displayName: 'Alex Rivera',
            collectorHandle: 'alex-rivera',
            location: 'Rotterdam',
            collectionFocus: 'Castle icons and Ideas cabins',
          }),
          headers: expect.any(Headers),
          method: 'PATCH',
        }),
      );
      expect(onAccountChange).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  test('delegates auth-change subscriptions through the shared browser auth utility', () => {
    const onChange = vi.fn();
    const unsubscribe = vi.fn();

    vi.mocked(subscribeToSupabaseAuthChanges).mockImplementation(() => unsubscribe);

    const nextUnsubscribe = subscribeToUserAuthChanges(onChange);

    expect(subscribeToSupabaseAuthChanges).toHaveBeenCalledTimes(1);
    expect(nextUnsubscribe).toBe(unsubscribe);
  });
});
