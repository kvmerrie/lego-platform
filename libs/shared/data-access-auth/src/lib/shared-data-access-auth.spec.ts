import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSupabaseAuthCallbackUrl,
  completeSupabaseAuthCallback,
  resetBrowserSupabaseClientForTests,
  sanitizePostAuthRedirectPath,
  subscribeToBrowserAccountDataChanges,
} from './shared-data-access-auth';

describe('shared data access auth', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetBrowserSupabaseClientForTests();
    vi.restoreAllMocks();
  });

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
      'This sign-in link is no longer valid. Request a fresh one and try again.',
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
      'This sign-in link is no longer valid. Request a fresh one and try again.',
    );
  });
});
