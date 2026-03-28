import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from '@lego-platform/shared/config';

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
  const serverSupabaseConfig = getServerSupabaseConfig();

  return createClient(
    serverSupabaseConfig.url,
    serverSupabaseConfig.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
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
  supabaseAdminClient: SupabaseClient = getServerSupabaseAdminClient(),
): Promise<AuthenticatedRequestPrincipal> {
  const { data, error } = await supabaseAdminClient.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error('Unable to verify the Supabase access token.');
  }

  return toAuthenticatedRequestPrincipal(data.user);
}

export async function resolveRequestPrincipalFromAuthHeader(
  authorizationHeader?: string,
  supabaseAdminClient: SupabaseClient = getServerSupabaseAdminClient(),
): Promise<RequestPrincipal> {
  const accessToken = extractBearerToken(authorizationHeader);

  if (!accessToken) {
    return createAnonymousRequestPrincipal();
  }

  return verifySupabaseAccessToken(accessToken, supabaseAdminClient);
}

export function resetServerSupabaseAdminClientForTests() {
  serverSupabaseAdminClient = undefined;
}
