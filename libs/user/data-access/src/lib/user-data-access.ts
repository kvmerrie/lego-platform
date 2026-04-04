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
    throw new Error('De huidige sessie kon niet worden geladen.');
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
    return 'Er is onlangs al een inloglink verstuurd. Wacht ongeveer een minuut en probeer het daarna opnieuw.';
  }

  if (
    authErrorText.includes('not authorized') ||
    authErrorText.includes('address not authorized')
  ) {
    return 'E-mailbezorging voor inloggen is voor dit adres nog niet klaar. Probeer het later opnieuw of neem contact op met support.';
  }

  return 'De inloglink kon nu niet worden verstuurd.';
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
    return 'E-mailadres of wachtwoord is onjuist.';
  }

  if (authErrorText.includes('email not confirmed')) {
    return 'Controleer je e-mail en bevestig je account voordat je inlogt.';
  }

  if (
    authErrorText.includes('rate') ||
    authErrorText.includes('security purposes') ||
    authErrorText.includes('too many')
  ) {
    return 'Te veel inlogpogingen. Wacht ongeveer een minuut en probeer het daarna opnieuw.';
  }

  return 'Inloggen met e-mail en wachtwoord kon nu niet worden voltooid.';
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
    return 'Voor dit e-mailadres bestaat al een account. Probeer in te loggen.';
  }

  if (
    authErrorText.includes('password should be') ||
    authErrorText.includes('password is too short') ||
    authErrorText.includes('weak password')
  ) {
    return 'Kies een sterker wachtwoord. Gebruik minimaal 8 tekens.';
  }

  if (
    authErrorText.includes('rate') ||
    authErrorText.includes('security purposes') ||
    authErrorText.includes('too many')
  ) {
    return 'Er zijn recent te veel accountpogingen geweest. Wacht ongeveer een minuut en probeer het daarna opnieuw.';
  }

  return 'Je account kon nu niet worden aangemaakt.';
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
    return 'Er is onlangs al een herstelmail verstuurd. Wacht ongeveer een minuut en probeer het daarna opnieuw.';
  }

  return 'De wachtwoordherstelmail kon nu niet worden verstuurd.';
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
    return 'Kies een sterker wachtwoord. Gebruik minimaal 8 tekens.';
  }

  return 'Het nieuwe wachtwoord kon nu niet worden opgeslagen.';
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
    return 'Inloggen met Google is in deze omgeving nog niet beschikbaar.';
  }

  return 'Inloggen met Google kon nu niet worden gestart.';
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
    throw new Error('Het huidige verzamelaarsprofiel kon niet worden geladen.');
  }

  return (await response.json()) as CollectorProfile;
}

export async function requestUserSignIn(options: {
  email: string;
  emailRedirectTo?: string;
}) {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error(
      'Accountinloggen is in deze omgeving nog niet beschikbaar.',
    );
  }

  const nextEmail = options.email.trim();

  if (!nextEmail) {
    throw new Error('Er is een geldig e-mailadres nodig om in te loggen.');
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
      'Accountinloggen is in deze omgeving nog niet beschikbaar.',
    );
  }

  const email = options.email.trim();
  const password = options.password.trim();

  if (!email) {
    throw new Error('Er is een geldig e-mailadres nodig om in te loggen.');
  }

  if (!password) {
    throw new Error('Vul je wachtwoord in om in te loggen.');
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
      'Accountinloggen is in deze omgeving nog niet beschikbaar.',
    );
  }

  const email = options.email.trim();
  const password = options.password.trim();

  if (!email) {
    throw new Error(
      'Er is een geldig e-mailadres nodig om een account aan te maken.',
    );
  }

  if (!password) {
    throw new Error('Kies een wachtwoord voor het nieuwe account.');
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
      'Accountinloggen is in deze omgeving nog niet beschikbaar.',
    );
  }

  const email = options.email.trim();

  if (!email) {
    throw new Error(
      'Er is een geldig e-mailadres nodig om een wachtwoord te herstellen.',
    );
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
      'Accountinloggen is in deze omgeving nog niet beschikbaar.',
    );
  }

  const password = options.password.trim();

  if (!password) {
    throw new Error('Vul eerst een nieuw wachtwoord in voordat je opslaat.');
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
      'Accountinloggen is in deze omgeving nog niet beschikbaar.',
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
    throw new Error('Uitloggen kon nu niet worden voltooid.');
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
    throw new Error('Log in om je verzamelaarsprofiel te bewerken.');
  }

  if (response.status === 409) {
    throw new Error(
      'Deze verzamelaarsnaam is al in gebruik. Probeer een duidelijkere variant.',
    );
  }

  if (response.status === 400) {
    const errorResponse = (await response.json()) as { message?: string };

    throw new Error(
      errorResponse.message ??
        'De invoer voor het verzamelaarsprofiel is ongeldig.',
    );
  }

  if (!response.ok) {
    throw new Error('Het verzamelaarsprofiel kon nu niet worden opgeslagen.');
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
    throw new Error('Log in om dealupdates op je verlanglijst te volgen.');
  }

  if (!response.ok) {
    throw new Error(
      'De weergavestatus van verlanglijstalerts kon nu niet worden bijgewerkt.',
    );
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
