import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiPaths } from '@lego-platform/shared/config';
import {
  getUserSession,
  requestUserSignIn,
  signOutCurrentUser,
  subscribeToUserAuthChanges,
} from './user-data-access';
import type { UserSession } from '@lego-platform/user/util';

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

  test('delegates auth-change subscriptions through the shared browser auth utility', () => {
    const onChange = vi.fn();
    const unsubscribe = vi.fn();

    vi.mocked(subscribeToSupabaseAuthChanges).mockImplementation(() => unsubscribe);

    const nextUnsubscribe = subscribeToUserAuthChanges(onChange);

    expect(subscribeToSupabaseAuthChanges).toHaveBeenCalledTimes(1);
    expect(nextUnsubscribe).toBe(unsubscribe);
  });
});
