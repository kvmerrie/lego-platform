import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiPaths } from '@lego-platform/shared/config';
import {
  completeUserSignInCallback,
  getCurrentUserProfile,
  getUserSession,
  markWishlistAlertsViewed,
  requestUserSignIn,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signInWithGoogle,
  signUpWithEmailPassword,
  signOutCurrentUser,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
} from './user-data-access';
import type { CollectorProfile, UserSession } from '@lego-platform/user/util';

vi.mock('@lego-platform/shared/data-access-auth', () => ({
  buildSupabaseAuthCallbackUrl: vi.fn((location: Location) => {
    const callbackUrl = new URL('/auth/callback', location.origin);

    callbackUrl.searchParams.set(
      'next',
      `${location.pathname}${location.search ?? ''}`,
    );

    return callbackUrl.toString();
  }),
  buildSupabaseAuthorizationHeaders: vi.fn(),
  completeSupabaseAuthCallback: vi.fn(),
  notifyBrowserAccountDataChanged: vi.fn(),
  resetSupabasePasswordForEmail: vi.fn(),
  signInWithSupabaseOAuth: vi.fn(),
  signInWithSupabaseOtp: vi.fn(),
  signInWithSupabasePassword: vi.fn(),
  signOutSupabaseBrowserSession: vi.fn(),
  signUpWithSupabasePassword: vi.fn(),
  subscribeToBrowserAccountDataChanges: vi.fn(),
  subscribeToSupabaseAuthChanges: vi.fn(),
  updateSupabaseBrowserPassword: vi.fn(),
}));

import {
  buildSupabaseAuthCallbackUrl,
  buildSupabaseAuthorizationHeaders,
  completeSupabaseAuthCallback,
  notifyBrowserAccountDataChanged,
  resetSupabasePasswordForEmail,
  signInWithSupabaseOAuth,
  signInWithSupabaseOtp,
  signInWithSupabasePassword,
  signOutSupabaseBrowserSession,
  signUpWithSupabasePassword,
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
  updateSupabaseBrowserPassword,
} from '@lego-platform/shared/data-access-auth';

describe('user data access', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
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
      setStates: [],
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

  test('starts email sign-in with a redirect through the dedicated auth callback route', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/sets/rivendell-10316',
        search: '',
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
      emailRedirectTo:
        'http://localhost:3000/auth/callback?next=%2Fsets%2Frivendell-10316',
    });
    expect(buildSupabaseAuthCallbackUrl).toHaveBeenCalledWith(window.location);
  });

  test('fails fast when browser auth environment variables are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(
      requestUserSignIn({
        email: 'collector@example.com',
      }),
    ).rejects.toThrow(
      'Accountinloggen is in deze omgeving nog niet beschikbaar.',
    );
  });

  test('returns a calmer resend message when Supabase rate-limits sign-in emails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/sets/rivendell-10316',
        search: '',
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
      'Er is onlangs al een inloglink verstuurd. Wacht ongeveer een minuut en probeer het daarna opnieuw.',
    );
  });

  test('returns a readable delivery message when the address is not authorized yet', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/sets/rivendell-10316',
        search: '',
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
      'E-mailbezorging voor inloggen is voor dit adres nog niet klaar. Probeer het later opnieuw of neem contact op met support.',
    );
  });

  test('signs in with email and password through the shared Supabase browser auth helper', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.mocked(signInWithSupabasePassword).mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
        },
        user: null,
      },
      error: null,
    } as Awaited<ReturnType<typeof signInWithSupabasePassword>>);

    await signInWithEmailPassword({
      email: 'collector@example.com',
      password: 'super-secret',
    });

    expect(signInWithSupabasePassword).toHaveBeenCalledWith({
      email: 'collector@example.com',
      password: 'super-secret',
    });
    expect(notifyBrowserAccountDataChanged).toHaveBeenCalledTimes(1);
  });

  test('returns a calm invalid-credentials message for email and password sign-in', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.mocked(signInWithSupabasePassword).mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      },
    } as Awaited<ReturnType<typeof signInWithSupabasePassword>>);

    await expect(
      signInWithEmailPassword({
        email: 'collector@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('E-mailadres of wachtwoord is onjuist.');
  });

  test('creates an email and password account and reports when confirmation is still required', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/account',
        search: '',
      },
    });
    vi.mocked(signUpWithSupabasePassword).mockResolvedValue({
      data: {
        session: null,
        user: {
          id: 'collector-1',
        },
      },
      error: null,
    } as Awaited<ReturnType<typeof signUpWithSupabasePassword>>);

    await expect(
      signUpWithEmailPassword({
        email: 'collector@example.com',
        password: 'super-secret',
      }),
    ).resolves.toEqual({
      requiresEmailConfirmation: true,
    });

    expect(signUpWithSupabasePassword).toHaveBeenCalledWith({
      email: 'collector@example.com',
      password: 'super-secret',
      emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Faccount',
    });
  });

  test('starts Google sign-in through the shared OAuth helper', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/account',
        search: '',
      },
    });
    vi.mocked(signInWithSupabaseOAuth).mockResolvedValue({
      data: {
        provider: 'google',
        url: 'https://example.supabase.co/auth/v1/authorize',
      },
      error: null,
    } as Awaited<ReturnType<typeof signInWithSupabaseOAuth>>);

    await signInWithGoogle();

    expect(signInWithSupabaseOAuth).toHaveBeenCalledWith({
      provider: 'google',
      redirectTo: 'http://localhost:3000/auth/callback?next=%2Faccount',
    });
  });

  test('sends password reset emails back through the callback route into account recovery mode', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:3000',
      },
    });
    vi.mocked(resetSupabasePasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    } as Awaited<ReturnType<typeof resetSupabasePasswordForEmail>>);

    await sendPasswordResetEmail({
      email: 'collector@example.com',
    });

    expect(resetSupabasePasswordForEmail).toHaveBeenCalledWith({
      email: 'collector@example.com',
      redirectTo:
        'http://localhost:3000/auth/callback?next=%2Faccount%3Fauth%3Dreset-password',
    });
  });

  test('updates the current password through the shared Supabase browser auth helper', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    vi.mocked(updateSupabaseBrowserPassword).mockResolvedValue({
      data: {
        user: {
          id: 'collector-1',
        },
      },
      error: null,
    } as Awaited<ReturnType<typeof updateSupabaseBrowserPassword>>);

    await updateCurrentUserPassword({
      password: 'new-super-secret',
    });

    expect(updateSupabaseBrowserPassword).toHaveBeenCalledWith({
      password: 'new-super-secret',
    });
    expect(notifyBrowserAccountDataChanged).toHaveBeenCalledTimes(1);
  });

  test('signs out through the shared browser auth utility', async () => {
    vi.mocked(signOutSupabaseBrowserSession).mockResolvedValue({
      error: null,
    });

    await signOutCurrentUser();

    expect(signOutSupabaseBrowserSession).toHaveBeenCalledTimes(1);
  });

  test('completes sign-in callbacks through the shared Supabase callback helper', async () => {
    vi.mocked(completeSupabaseAuthCallback).mockResolvedValue({
      nextPath: '/collection',
    });

    await expect(completeUserSignInCallback()).resolves.toEqual({
      nextPath: '/collection',
    });
    expect(completeSupabaseAuthCallback).toHaveBeenCalledTimes(1);
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
      wishlistDealAlerts: false,
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
      wishlistDealAlerts: false,
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
          wishlistDealAlerts: false,
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
        wishlistDealAlerts: true,
      }),
    ).rejects.toThrow(
      'Deze verzamelaarsnaam is al in gebruik. Probeer een duidelijkere variant.',
    );
  });

  test('marks wishlist alerts as viewed without broadcasting an account refresh', async () => {
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
          wishlistAlertsLastViewedAt: '2026-04-03T21:30:00.000Z',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(markWishlistAlertsViewed()).resolves.toBe(
      '2026-04-03T21:30:00.000Z',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      apiPaths.wishlistAlertsViewed,
      expect.objectContaining({
        headers: expect.any(Headers),
        method: 'POST',
      }),
    );
    expect(notifyBrowserAccountDataChanged).not.toHaveBeenCalled();
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
