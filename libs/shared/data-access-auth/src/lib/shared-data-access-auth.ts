import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabaseConfig } from '@lego-platform/shared/config';

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
  const {
    data: { session },
  } = await getBrowserSupabaseClient().auth.getSession();

  return session?.access_token;
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
