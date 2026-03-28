import { apiPaths } from '@lego-platform/shared/config';
import { buildSupabaseAuthorizationHeaders } from '@lego-platform/shared/data-access-auth';
import { phaseOneCollectorIdentity } from '@lego-platform/user/util';
import type { UserProfile, UserSession } from '@lego-platform/user/util';

export async function getUserSession(): Promise<UserSession> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(apiPaths.session, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Unable to load the current session.');
  }

  return (await response.json()) as UserSession;
}

export function getUserProfile(): UserProfile {
  return phaseOneCollectorIdentity;
}
