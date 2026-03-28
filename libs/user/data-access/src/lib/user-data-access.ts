import { hasBrowserSupabaseConfig } from '@lego-platform/shared/config';
import { apiPaths } from '@lego-platform/shared/config';
import {
  buildSupabaseAuthorizationHeaders,
  signInWithSupabaseOtp,
  signOutSupabaseBrowserSession,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
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

function getDefaultEmailRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.href;
}

export function isUserAuthAvailable(): boolean {
  return hasBrowserSupabaseConfig();
}

export async function requestUserSignIn(options: {
  email: string;
  emailRedirectTo?: string;
}) {
  const nextEmail = options.email.trim();

  if (!nextEmail) {
    throw new Error('A valid email address is required to sign in.');
  }

  const { error } = await signInWithSupabaseOtp({
    email: nextEmail,
    emailRedirectTo: options.emailRedirectTo ?? getDefaultEmailRedirectUrl(),
  });

  if (error) {
    throw new Error('Unable to start the Supabase sign-in flow.');
  }
}

export async function signOutCurrentUser() {
  const { error } = await signOutSupabaseBrowserSession();

  if (error) {
    throw new Error('Unable to sign out of the current Supabase session.');
  }
}

export function subscribeToUserAuthChanges(onChange: () => void): () => void {
  return subscribeToSupabaseAuthChanges(() => {
    onChange();
  });
}

export function getUserProfile(): UserProfile {
  return phaseOneCollectorIdentity;
}
