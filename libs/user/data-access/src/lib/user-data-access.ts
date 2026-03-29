import { hasBrowserSupabaseConfig } from '@lego-platform/shared/config';
import { apiPaths } from '@lego-platform/shared/config';
import {
  buildSupabaseAuthorizationHeaders,
  signInWithSupabaseOtp,
  signOutSupabaseBrowserSession,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
import {
  createCollectorProfileDraft,
  phaseOneCollectorIdentity,
  validateUpdateCollectorProfileInput,
} from '@lego-platform/user/util';
import type {
  CollectorProfile,
  UpdateCollectorProfileInput,
  UserProfile,
  UserSession,
} from '@lego-platform/user/util';

const userAccountChangeListeners = new Set<() => void>();

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

function notifyUserAccountChanged() {
  userAccountChangeListeners.forEach((listener) => {
    listener();
  });
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

export async function getCurrentUserProfile(): Promise<CollectorProfile | null> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(apiPaths.profile, {
    cache: 'no-store',
    headers,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load the current collector profile.');
  }

  return (await response.json()) as CollectorProfile;
}

export async function requestUserSignIn(options: {
  email: string;
  emailRedirectTo?: string;
}) {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error('Email sign-in is not available in this environment yet.');
  }

  const nextEmail = options.email.trim();

  if (!nextEmail) {
    throw new Error('A valid email address is required to sign in.');
  }

  const { error } = await signInWithSupabaseOtp({
    email: nextEmail,
    emailRedirectTo: options.emailRedirectTo ?? getDefaultEmailRedirectUrl(),
  });

  if (error) {
    throw new Error('Unable to send the sign-in link right now.');
  }
}

export async function signOutCurrentUser() {
  const { error } = await signOutSupabaseBrowserSession();

  if (error) {
    throw new Error('Unable to sign out right now.');
  }
}

export function subscribeToUserAuthChanges(onChange: () => void): () => void {
  return subscribeToSupabaseAuthChanges(() => {
    onChange();
  });
}

export function subscribeToUserAccountChanges(onChange: () => void): () => void {
  userAccountChangeListeners.add(onChange);

  return () => {
    userAccountChangeListeners.delete(onChange);
  };
}

export async function updateCurrentUserProfile(
  input: UpdateCollectorProfileInput,
): Promise<CollectorProfile> {
  const updateCollectorProfileInput = validateUpdateCollectorProfileInput(input);
  const headers = await buildSupabaseAuthorizationHeaders({
    'Content-Type': 'application/json',
  });
  const response = await fetch(apiPaths.profile, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updateCollectorProfileInput),
  });

  if (response.status === 401) {
    throw new Error('Sign in to edit your collector profile.');
  }

  if (response.status === 409) {
    throw new Error(
      'That collector handle is already taken. Try a more distinctive version.',
    );
  }

  if (response.status === 400) {
    const errorResponse = (await response.json()) as { message?: string };

    throw new Error(
      errorResponse.message ?? 'Collector profile input is invalid.',
    );
  }

  if (!response.ok) {
    throw new Error('Unable to save the collector profile right now.');
  }

  const collectorProfile = (await response.json()) as CollectorProfile;

  notifyUserAccountChanged();

  return collectorProfile;
}

export function getUserProfile(): UserProfile {
  return phaseOneCollectorIdentity;
}

export { createCollectorProfileDraft };
