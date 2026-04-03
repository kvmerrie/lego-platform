import {
  apiPaths,
  buildWebPath,
  hasBrowserSupabaseConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import {
  buildSupabaseAuthCallbackUrl,
  buildSupabaseAuthorizationHeaders,
  completeSupabaseAuthCallback,
  notifyBrowserAccountDataChanged,
  resetSupabasePasswordForEmail,
  signInWithSupabaseOAuth,
  signInWithSupabaseOtp,
  signInWithSupabasePassword,
  signOutSupabaseBrowserSession,
  signUpWithSupabasePassword,
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
  updateSupabaseBrowserPassword,
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

  return buildSupabaseAuthCallbackUrl(window.location);
}

function getPasswordResetRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const callbackUrl = new URL('/auth/callback', window.location.origin);

  callbackUrl.searchParams.set(
    'next',
    `${buildWebPath(webPathnames.account)}?auth=reset-password`,
  );

  return callbackUrl.toString();
}

function getMagicLinkSignInErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  const authErrorText =
    `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();

  if (
    authErrorText.includes('rate') ||
    authErrorText.includes('security purposes') ||
    authErrorText.includes('too many')
  ) {
    return 'A sign-in link was sent recently. Wait about a minute, then try again.';
  }

  if (
    authErrorText.includes('not authorized') ||
    authErrorText.includes('address not authorized')
  ) {
    return 'Sign-in email delivery is not ready for this address yet. Please try again later or contact support.';
  }

  return 'Unable to send the sign-in link right now.';
}

function getPasswordAuthErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  const authErrorText =
    `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();

  if (
    authErrorText.includes('invalid login credentials') ||
    authErrorText.includes('invalid credentials')
  ) {
    return 'Email or password is incorrect.';
  }

  if (authErrorText.includes('email not confirmed')) {
    return 'Check your email and confirm your account before signing in.';
  }

  if (
    authErrorText.includes('rate') ||
    authErrorText.includes('security purposes') ||
    authErrorText.includes('too many')
  ) {
    return 'Too many sign-in attempts. Wait about a minute, then try again.';
  }

  return 'Unable to sign in with email and password right now.';
}

function getSignUpErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  const authErrorText =
    `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();

  if (
    authErrorText.includes('already registered') ||
    authErrorText.includes('user already registered')
  ) {
    return 'That email already has an account. Try signing in instead.';
  }

  if (
    authErrorText.includes('password should be') ||
    authErrorText.includes('password is too short') ||
    authErrorText.includes('weak password')
  ) {
    return 'Choose a stronger password. Use at least 8 characters.';
  }

  if (
    authErrorText.includes('rate') ||
    authErrorText.includes('security purposes') ||
    authErrorText.includes('too many')
  ) {
    return 'Too many account attempts happened recently. Wait about a minute, then try again.';
  }

  return 'Unable to create your account right now.';
}

function getPasswordResetErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  const authErrorText =
    `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();

  if (
    authErrorText.includes('rate') ||
    authErrorText.includes('security purposes') ||
    authErrorText.includes('too many')
  ) {
    return 'A reset email was sent recently. Wait about a minute, then try again.';
  }

  return 'Unable to send the password reset email right now.';
}

function getPasswordUpdateErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  const authErrorText =
    `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();

  if (
    authErrorText.includes('password should be') ||
    authErrorText.includes('password is too short') ||
    authErrorText.includes('weak password')
  ) {
    return 'Choose a stronger password. Use at least 8 characters.';
  }

  return 'Unable to save the new password right now.';
}

function getGoogleSignInErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  const authErrorText =
    `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();

  if (
    authErrorText.includes('provider') ||
    authErrorText.includes('google') ||
    authErrorText.includes('not enabled')
  ) {
    return 'Google sign-in is not available in this environment yet.';
  }

  return 'Unable to start Google sign-in right now.';
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
    throw new Error(
      'Account sign-in is not available in this environment yet.',
    );
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
    throw new Error(getMagicLinkSignInErrorMessage(error));
  }
}

export async function signInWithEmailPassword(options: {
  email: string;
  password: string;
}) {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error(
      'Account sign-in is not available in this environment yet.',
    );
  }

  const email = options.email.trim();
  const password = options.password.trim();

  if (!email) {
    throw new Error('A valid email address is required to sign in.');
  }

  if (!password) {
    throw new Error('Enter your password to sign in.');
  }

  const { data, error } = await signInWithSupabasePassword({
    email,
    password,
  });

  if (error) {
    throw new Error(getPasswordAuthErrorMessage(error));
  }

  if (data.session) {
    notifyBrowserAccountDataChanged();
  }
}

export async function signUpWithEmailPassword(options: {
  email: string;
  password: string;
}): Promise<{ requiresEmailConfirmation: boolean }> {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error(
      'Account sign-in is not available in this environment yet.',
    );
  }

  const email = options.email.trim();
  const password = options.password.trim();

  if (!email) {
    throw new Error('A valid email address is required to create an account.');
  }

  if (!password) {
    throw new Error('Choose a password for the new account.');
  }

  const { data, error } = await signUpWithSupabasePassword({
    email,
    password,
    emailRedirectTo: getDefaultEmailRedirectUrl(),
  });

  if (error) {
    throw new Error(getSignUpErrorMessage(error));
  }

  if (data.session) {
    notifyBrowserAccountDataChanged();
  }

  return {
    requiresEmailConfirmation: !data.session,
  };
}

export async function sendPasswordResetEmail(options: { email: string }) {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error(
      'Account sign-in is not available in this environment yet.',
    );
  }

  const email = options.email.trim();

  if (!email) {
    throw new Error('A valid email address is required to reset a password.');
  }

  const { error } = await resetSupabasePasswordForEmail({
    email,
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) {
    throw new Error(getPasswordResetErrorMessage(error));
  }
}

export async function updateCurrentUserPassword(options: { password: string }) {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error(
      'Account sign-in is not available in this environment yet.',
    );
  }

  const password = options.password.trim();

  if (!password) {
    throw new Error('Enter a new password before saving it.');
  }

  const { error } = await updateSupabaseBrowserPassword({
    password,
  });

  if (error) {
    throw new Error(getPasswordUpdateErrorMessage(error));
  }

  notifyBrowserAccountDataChanged();
}

export async function signInWithGoogle() {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error(
      'Account sign-in is not available in this environment yet.',
    );
  }

  const { error } = await signInWithSupabaseOAuth({
    provider: 'google',
    redirectTo: getDefaultEmailRedirectUrl(),
  });

  if (error) {
    throw new Error(getGoogleSignInErrorMessage(error));
  }
}

export async function completeUserSignInCallback(): Promise<{
  nextPath: string;
}> {
  return completeSupabaseAuthCallback();
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

export function subscribeToUserAccountChanges(
  onChange: () => void,
): () => void {
  return subscribeToBrowserAccountDataChanges(onChange);
}

export async function updateCurrentUserProfile(
  input: UpdateCollectorProfileInput,
): Promise<CollectorProfile> {
  const updateCollectorProfileInput =
    validateUpdateCollectorProfileInput(input);
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

  notifyBrowserAccountDataChanged();

  return collectorProfile;
}

export async function markWishlistAlertsViewed(): Promise<string | undefined> {
  const headers = await buildSupabaseAuthorizationHeaders({
    'Content-Type': 'application/json',
  });
  const response = await fetch(apiPaths.wishlistAlertsViewed, {
    method: 'POST',
    headers,
  });

  if (response.status === 401) {
    throw new Error('Sign in to track wishlist deal updates.');
  }

  if (!response.ok) {
    throw new Error('Unable to update wishlist alert view state right now.');
  }

  const payload = (await response.json()) as {
    wishlistAlertsLastViewedAt?: string;
  };

  return payload.wishlistAlertsLastViewedAt;
}

export function getUserProfile(): UserProfile {
  return phaseOneCollectorIdentity;
}

export { createCollectorProfileDraft };
