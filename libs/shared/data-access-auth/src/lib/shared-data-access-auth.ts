import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getBrowserSupabaseConfig,
  hasBrowserSupabaseConfig,
} from '@lego-platform/shared/config';

let browserSupabaseClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient(): SupabaseClient {
  const browserSupabaseConfig = getBrowserSupabaseConfig();

  return createClient(
    browserSupabaseConfig.url,
    browserSupabaseConfig.anonKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    },
  );
}

export function getBrowserSupabaseClient(): SupabaseClient {
  browserSupabaseClient ??= createBrowserSupabaseClient();

  return browserSupabaseClient;
}

export async function getBrowserAccessToken(): Promise<string | undefined> {
  if (!hasBrowserSupabaseConfig()) {
    return undefined;
  }

  const {
    data: { session },
  } = await getBrowserSupabaseClient().auth.getSession();

  return session?.access_token;
}

export async function buildSupabaseAuthorizationHeaders(
  headers?: HeadersInit,
): Promise<Headers> {
  const nextHeaders = new Headers(headers);
  const accessToken = await getBrowserAccessToken();

  if (accessToken) {
    nextHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  return nextHeaders;
}

export async function signInWithSupabaseOtp(options: {
  email: string;
  emailRedirectTo?: string;
}) {
  return getBrowserSupabaseClient().auth.signInWithOtp({
    email: options.email,
    options: options.emailRedirectTo
      ? {
          emailRedirectTo: options.emailRedirectTo,
        }
      : undefined,
  });
}

export async function signOutSupabaseBrowserSession() {
  return getBrowserSupabaseClient().auth.signOut();
}

export function resetBrowserSupabaseClientForTests() {
  browserSupabaseClient = undefined;
}
