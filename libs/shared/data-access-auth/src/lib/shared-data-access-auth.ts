import {
  createClient,
  type AuthChangeEvent,
  type SupabaseClient,
} from '@supabase/supabase-js';
import {
  getMissingBrowserSupabaseEnvKeys,
  getBrowserSupabaseConfig,
  hasBrowserSupabaseConfig,
} from '@lego-platform/shared/config';

let browserSupabaseClient: SupabaseClient | undefined;
let hasWarnedAboutMissingBrowserSupabaseConfig = false;
const browserAccountDataChangeListeners = new Set<() => void>();

export type BrowserSupabaseAuthChangeListener = (
  authChangeEvent: AuthChangeEvent,
) => void;

export type BrowserAccountDataChangeListener = () => void;

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

export function isBrowserSupabaseAuthAvailable(): boolean {
  return hasBrowserSupabaseConfig();
}

export function warnAboutMissingBrowserSupabaseConfig(): void {
  if (
    hasWarnedAboutMissingBrowserSupabaseConfig ||
    typeof window === 'undefined' ||
    hasBrowserSupabaseConfig()
  ) {
    return;
  }

  console.warn(
    `[auth] Browser sign-in is disabled because these environment variables are missing: ${getMissingBrowserSupabaseEnvKeys().join(', ')}.`,
  );
  hasWarnedAboutMissingBrowserSupabaseConfig = true;
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

export function subscribeToSupabaseAuthChanges(
  listener: BrowserSupabaseAuthChangeListener,
): () => void {
  if (!hasBrowserSupabaseConfig()) {
    return () => undefined;
  }

  const {
    data: { subscription },
  } = getBrowserSupabaseClient().auth.onAuthStateChange((authChangeEvent) => {
    listener(authChangeEvent);
  });

  return () => {
    subscription.unsubscribe();
  };
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

export function notifyBrowserAccountDataChanged(): void {
  browserAccountDataChangeListeners.forEach((listener) => {
    listener();
  });
}

export function subscribeToBrowserAccountDataChanges(
  listener: BrowserAccountDataChangeListener,
): () => void {
  browserAccountDataChangeListeners.add(listener);

  return () => {
    browserAccountDataChangeListeners.delete(listener);
  };
}

export function resetBrowserSupabaseClientForTests() {
  browserSupabaseClient = undefined;
  hasWarnedAboutMissingBrowserSupabaseConfig = false;
  browserAccountDataChangeListeners.clear();
}
