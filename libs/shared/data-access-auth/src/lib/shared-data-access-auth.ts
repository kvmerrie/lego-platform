import {
  createClient,
  type AuthChangeEvent,
  type AuthTokenResponsePassword,
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
const DEFAULT_POST_AUTH_REDIRECT_PATH = '/';
const SUPABASE_AUTH_CALLBACK_PATH = '/auth/callback';

export type BrowserSupabaseAuthChangeListener = (
  authChangeEvent: AuthChangeEvent,
) => void;

export type BrowserAccountDataChangeListener = () => void;

interface BrowserSupabaseLocationLike {
  origin: string;
  pathname: string;
  search?: string;
}

interface SupabaseBrowserAuthApi {
  auth: Pick<
    SupabaseClient['auth'],
    'exchangeCodeForSession' | 'getSession' | 'setSession'
  >;
}

export function createBrowserSupabaseClient(): SupabaseClient {
  const browserSupabaseConfig = getBrowserSupabaseConfig();

  return createClient(
    browserSupabaseConfig.url,
    browserSupabaseConfig.anonKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
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

function getCurrentBrowserUrl(): URL | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return new URL(window.location.href);
}

function getUrlHashParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.replace(/^#/, ''));
}

function normalizeAuthCallbackMessage(value: string): string {
  return value.replace(/\+/g, ' ').trim();
}

function formatAuthCallbackErrorMessage(rawMessage?: string): string {
  if (!rawMessage) {
    return 'Unable to finish sign-in right now.';
  }

  const normalizedMessage = normalizeAuthCallbackMessage(rawMessage);
  const errorText = normalizedMessage.toLowerCase();

  if (
    errorText.includes('expired') ||
    errorText.includes('flow state') ||
    errorText.includes('already been used') ||
    errorText.includes('invalid') ||
    errorText.includes('otp')
  ) {
    return 'This sign-in link is no longer valid. Request a fresh one and try again.';
  }

  return normalizedMessage;
}

export function sanitizePostAuthRedirectPath(
  path: string | null | undefined,
): string {
  if (!path) {
    return DEFAULT_POST_AUTH_REDIRECT_PATH;
  }

  const normalizedPath = path.trim();

  if (
    !normalizedPath.startsWith('/') ||
    normalizedPath.startsWith('//') ||
    normalizedPath.startsWith(SUPABASE_AUTH_CALLBACK_PATH)
  ) {
    return DEFAULT_POST_AUTH_REDIRECT_PATH;
  }

  return normalizedPath;
}

export function buildSupabaseAuthCallbackUrl(
  currentLocation: BrowserSupabaseLocationLike,
): string {
  const nextPath = sanitizePostAuthRedirectPath(
    `${currentLocation.pathname}${currentLocation.search ?? ''}`,
  );
  const callbackUrl = new URL(
    SUPABASE_AUTH_CALLBACK_PATH,
    currentLocation.origin,
  );

  callbackUrl.searchParams.set('next', nextPath);

  return callbackUrl.toString();
}

function readSupabaseAuthCallbackError(url: URL): string | undefined {
  const hashParams = getUrlHashParams(url);

  return (
    url.searchParams.get('error_description') ??
    hashParams.get('error_description') ??
    url.searchParams.get('error') ??
    hashParams.get('error') ??
    undefined
  );
}

function readSupabaseAuthCallbackNextPath(url: URL): string {
  return sanitizePostAuthRedirectPath(url.searchParams.get('next'));
}

function readSupabaseAuthCallbackTokens(url: URL):
  | {
      accessToken: string;
      refreshToken: string;
    }
  | undefined {
  const hashParams = getUrlHashParams(url);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return undefined;
  }

  return {
    accessToken,
    refreshToken,
  };
}

function hasResolvedSession(
  response:
    | {
        data: AuthTokenResponsePassword['data'];
        error: AuthTokenResponsePassword['error'];
      }
    | {
        data: {
          session: Awaited<
            ReturnType<SupabaseClient['auth']['getSession']>
          >['data']['session'];
        };
        error: null;
      },
): boolean {
  return Boolean(response.data.session);
}

export async function completeSupabaseAuthCallback({
  currentUrl = getCurrentBrowserUrl(),
  supabaseClient,
}: {
  currentUrl?: URL;
  supabaseClient?: SupabaseBrowserAuthApi;
} = {}): Promise<{ nextPath: string }> {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error('Email sign-in is not available in this environment yet.');
  }

  if (!currentUrl) {
    throw new Error('Unable to read the auth callback URL.');
  }

  const nextPath = readSupabaseAuthCallbackNextPath(currentUrl);
  const callbackError = readSupabaseAuthCallbackError(currentUrl);
  const browserSupabaseClient = supabaseClient ?? getBrowserSupabaseClient();

  if (callbackError) {
    throw new Error(formatAuthCallbackErrorMessage(callbackError));
  }

  const authCode = currentUrl.searchParams.get('code');

  if (authCode) {
    const response =
      await browserSupabaseClient.auth.exchangeCodeForSession(authCode);

    if (response.error) {
      throw new Error(formatAuthCallbackErrorMessage(response.error.message));
    }

    if (hasResolvedSession(response)) {
      notifyBrowserAccountDataChanged();

      return { nextPath };
    }
  }

  const callbackTokens = readSupabaseAuthCallbackTokens(currentUrl);

  if (callbackTokens) {
    const response = await browserSupabaseClient.auth.setSession({
      access_token: callbackTokens.accessToken,
      refresh_token: callbackTokens.refreshToken,
    });

    if (response.error) {
      throw new Error(formatAuthCallbackErrorMessage(response.error.message));
    }

    if (hasResolvedSession(response)) {
      notifyBrowserAccountDataChanged();

      return { nextPath };
    }
  }

  const {
    data: { session },
  } = await browserSupabaseClient.auth.getSession();

  if (!session) {
    throw new Error(
      'This sign-in link is no longer valid. Request a fresh one and try again.',
    );
  }

  notifyBrowserAccountDataChanged();

  return { nextPath };
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
