import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import {
  getServerSupabaseConfig,
  hasServerSupabaseConfig,
  type ServerSupabaseConfig,
} from '@lego-platform/shared/config';

export interface AnonymousRequestPrincipal {
  state: 'anonymous';
}

export interface AuthenticatedRequestPrincipal {
  state: 'authenticated';
  userId: string;
  email: string | null;
}

export type RequestPrincipal =
  | AnonymousRequestPrincipal
  | AuthenticatedRequestPrincipal;

let serverSupabaseAdminClient: SupabaseClient | undefined;

function createAnonymousRequestPrincipal(): AnonymousRequestPrincipal {
  return {
    state: 'anonymous',
  };
}

function toAuthenticatedRequestPrincipal(
  user: User,
): AuthenticatedRequestPrincipal {
  return {
    state: 'authenticated',
    userId: user.id,
    email: user.email ?? null,
  };
}

export function createServerSupabaseAdminClient(): SupabaseClient {
  return createSupabaseAdminClient(getServerSupabaseConfig());
}

export function createSupabaseAdminClient({
  serviceRoleKey,
  url,
}: ServerSupabaseConfig): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getServerSupabaseAdminClient(): SupabaseClient {
  serverSupabaseAdminClient ??= createServerSupabaseAdminClient();

  return serverSupabaseAdminClient;
}

export function extractBearerToken(
  authorizationHeader?: string,
): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const tokenMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  return tokenMatch?.[1]?.trim() || undefined;
}

export async function verifySupabaseAccessToken(
  accessToken: string,
  supabaseAdminClient?: SupabaseClient,
): Promise<AuthenticatedRequestPrincipal> {
  const client = supabaseAdminClient ?? getServerSupabaseAdminClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error('Unable to verify the Supabase access token.');
  }

  return toAuthenticatedRequestPrincipal(data.user);
}

export async function resolveRequestPrincipalFromAuthHeader(
  authorizationHeader?: string,
  supabaseAdminClient?: SupabaseClient,
): Promise<RequestPrincipal> {
  const accessToken = extractBearerToken(authorizationHeader);

  if (!accessToken) {
    return createAnonymousRequestPrincipal();
  }

  if (!hasServerSupabaseConfig()) {
    return createAnonymousRequestPrincipal();
  }

  return verifySupabaseAccessToken(accessToken, supabaseAdminClient);
}

export function resetServerSupabaseAdminClientForTests() {
  serverSupabaseAdminClient = undefined;
}
