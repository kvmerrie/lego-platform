import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { apiPaths } from '@lego-platform/shared/config';
import {
  buildSupabaseAuthCallbackUrl,
  completeSupabaseAuthCallback,
  notifyBrowserAccountDataChanged,
  readBrowserSessionPayload,
  resetBrowserSupabaseClientForTests,
  sanitizePostAuthRedirectPath,
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from './shared-data-access-auth';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('shared data access auth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetBrowserSupabaseClientForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockBrowserAuthSession(accessToken = 'access-token') {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: accessToken,
            },
          },
        }),
        onAuthStateChange: vi.fn(),
      },
    } as never);
  }

  it('builds the dedicated auth callback URL with a sanitized next path', () => {
    expect(
      buildSupabaseAuthCallbackUrl({
        origin: 'http://localhost:3000',
        pathname: '/sets/rivendell-10316',
        search: '?ref=homepage',
      }),
    ).toBe(
      'http://localhost:3000/auth/callback?next=%2Fsets%2Frivendell-10316%3Fref%3Dhomepage',
    );
  });

  it('keeps safe relative next paths and rejects unsafe redirect targets', () => {
    expect(sanitizePostAuthRedirectPath('/collection')).toBe('/collection');
    expect(sanitizePostAuthRedirectPath('https://evil.test')).toBe('/');
    expect(sanitizePostAuthRedirectPath('//evil.test')).toBe('/');
    expect(
      sanitizePostAuthRedirectPath('/auth/callback?next=%2Fcollection'),
    ).toBe('/');
  });

  it('dedupes concurrent browser session payload requests', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockBrowserAuthSession();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const sessionPayload = {
      state: 'authenticated',
      wantedSetIds: ['10316'],
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(sessionPayload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(
      Promise.all([readBrowserSessionPayload(), readBrowserSessionPayload()]),
    ).resolves.toEqual([sessionPayload, sessionPayload]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      apiPaths.session,
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get(
        'Authorization',
      ),
    ).toBe('Bearer access-token');
  });

  it('reuses a recent browser session payload and clears it on account changes', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockBrowserAuthSession();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'anonymous' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'authenticated' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

    await expect(readBrowserSessionPayload()).resolves.toEqual({
      state: 'anonymous',
    });
    await expect(readBrowserSessionPayload()).resolves.toEqual({
      state: 'anonymous',
    });

    notifyBrowserAccountDataChanged();

    await expect(readBrowserSessionPayload()).resolves.toEqual({
      state: 'authenticated',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not let an older in-flight session response repopulate cache after account changes', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mockBrowserAuthSession();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    let resolveFirstResponse: ((response: Response) => void) | undefined;

    fetchMock
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirstResponse = resolve;
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'authenticated' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

    const firstSessionPayload = readBrowserSessionPayload();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    notifyBrowserAccountDataChanged();
    resolveFirstResponse?.(
      new Response(JSON.stringify({ state: 'anonymous' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(firstSessionPayload).resolves.toEqual({
      state: 'anonymous',
    });
    await expect(readBrowserSessionPayload()).resolves.toEqual({
      state: 'authenticated',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the cached session for initial auth events and clears it for real auth changes', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const onAuthStateChange = vi.fn();

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'access-token',
            },
          },
        }),
        onAuthStateChange,
      },
    } as never);

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'anonymous' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'authenticated' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });

    subscribeToSupabaseAuthChanges(vi.fn());
    const authListener = onAuthStateChange.mock.calls[0]?.[0] as (
      event: string,
    ) => void;

    await readBrowserSessionPayload();
    authListener('INITIAL_SESSION');
    await readBrowserSessionPayload();
    authListener('SIGNED_IN');
    await readBrowserSessionPayload();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exchanges code-based callback URLs into a browser session', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const onAccountDataChanged = vi.fn();
    const unsubscribe =
      subscribeToBrowserAccountDataChanges(onAccountDataChanged);
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
        },
        user: null,
      },
      error: null,
    });

    await expect(
      completeSupabaseAuthCallback({
        currentUrl: new URL(
          'http://localhost:3000/auth/callback?code=flow-code&next=%2Fcollection',
        ),
        supabaseClient: {
          auth: {
            exchangeCodeForSession,
            getSession: vi.fn(),
            setSession: vi.fn(),
          },
        },
      }),
    ).resolves.toEqual({
      nextPath: '/collection',
    });

    expect(exchangeCodeForSession).toHaveBeenCalledWith('flow-code');
    expect(onAccountDataChanged).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('accepts hash-based access and refresh tokens during the callback flow', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const setSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
        },
        user: null,
      },
      error: null,
    });

    await expect(
      completeSupabaseAuthCallback({
        currentUrl: new URL(
          'http://localhost:3000/auth/callback?next=%2Fsets%2Frivendell-10316#access_token=access-token&refresh_token=refresh-token',
        ),
        supabaseClient: {
          auth: {
            exchangeCodeForSession: vi.fn(),
            getSession: vi.fn(),
            setSession,
          },
        },
      }),
    ).resolves.toEqual({
      nextPath: '/sets/rivendell-10316',
    });

    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('surfaces a calm invalid-link error when the callback includes an auth error', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    await expect(
      completeSupabaseAuthCallback({
        currentUrl: new URL(
          'http://localhost:3000/auth/callback?error_description=OTP+has+expired',
        ),
        supabaseClient: {
          auth: {
            exchangeCodeForSession: vi.fn(),
            getSession: vi.fn(),
            setSession: vi.fn(),
          },
        },
      }),
    ).rejects.toThrow(
      'Deze inloglink is niet meer geldig. Vraag een nieuwe aan en probeer het opnieuw.',
    );
  });

  it('fails clearly when the callback cannot establish a session', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    await expect(
      completeSupabaseAuthCallback({
        currentUrl: new URL('http://localhost:3000/auth/callback'),
        supabaseClient: {
          auth: {
            exchangeCodeForSession: vi.fn(),
            getSession: vi.fn().mockResolvedValue({
              data: { session: null },
            }),
            setSession: vi.fn(),
          },
        },
      }),
    ).rejects.toThrow(
      'Deze inloglink is niet meer geldig. Vraag een nieuwe aan en probeer het opnieuw.',
    );
  });
});
