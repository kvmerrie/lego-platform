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
  notifyBrowserAccountDataChanged: vi.fn(),
  signInWithSupabaseOtp: vi.fn(),
  signOutSupabaseBrowserSession: vi.fn(),
  subscribeToBrowserAccountDataChanges: vi.fn(),
  subscribeToSupabaseAuthChanges: vi.fn(),
}));

import {
  buildSupabaseAuthorizationHeaders,
  notifyBrowserAccountDataChanged,
  signInWithSupabaseOtp,
  signOutSupabaseBrowserSession,
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';

describe('user data access', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
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

  test('fails fast when browser auth environment variables are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(
      requestUserSignIn({
        email: 'collector@example.com',
      }),
    ).rejects.toThrow(
      'Email sign-in is not available in this environment yet.',
    );
  });

  test('returns a calmer resend message when Supabase rate-limits sign-in emails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
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
      error: {
        code: 'over_email_send_rate_limit',
        message:
          'For security purposes, you can only request this after 60 seconds.',
      },
    });

    await expect(
      requestUserSignIn({
        email: 'collector@example.com',
      }),
    ).rejects.toThrow(
      'A sign-in link was sent recently. Wait about a minute, then try again.',
    );
  });

  test('returns a readable delivery message when the address is not authorized yet', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
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
      error: {
        code: 'email_address_not_authorized',
        message: 'Email address not authorized',
      },
    });

    await expect(
      requestUserSignIn({
        email: 'collector@example.com',
      }),
    ).rejects.toThrow(
      'Sign-in email delivery is not ready for this address yet. Please try again later or contact support.',
    );
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
    expect(notifyBrowserAccountDataChanged).toHaveBeenCalledTimes(1);
  });

  test('returns a readable conflict error when the collector handle is already taken', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    vi.mocked(buildSupabaseAuthorizationHeaders).mockResolvedValue(
      new Headers({
        Authorization: 'Bearer browser-token',
        'Content-Type': 'application/json',
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Collector handle is already in use.',
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(
      updateCurrentUserProfile({
        displayName: 'Alex Rivera',
        collectorHandle: 'alex-rivera',
        location: 'Rotterdam',
        collectionFocus: 'Castle icons and Ideas cabins',
      }),
    ).rejects.toThrow(
      'That collector handle is already taken. Try a more distinctive version.',
    );
  });

  test('delegates auth-change subscriptions through the shared browser auth utility', () => {
    const onChange = vi.fn();
    const unsubscribe = vi.fn();

    vi.mocked(subscribeToSupabaseAuthChanges).mockImplementation(
      () => unsubscribe,
    );

    const nextUnsubscribe = subscribeToUserAuthChanges(onChange);

    expect(subscribeToSupabaseAuthChanges).toHaveBeenCalledTimes(1);
    expect(nextUnsubscribe).toBe(unsubscribe);
  });

  test('delegates account-change subscriptions through the shared browser notifier', () => {
    const onChange = vi.fn();
    const unsubscribe = vi.fn();

    vi.mocked(subscribeToBrowserAccountDataChanges).mockImplementation(
      () => unsubscribe,
    );

    const nextUnsubscribe = subscribeToUserAccountChanges(onChange);

    expect(subscribeToBrowserAccountDataChanges).toHaveBeenCalledWith(onChange);
    expect(nextUnsubscribe).toBe(unsubscribe);
  });
});
