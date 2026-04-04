'use client';

import { useEffect, useRef, useState } from 'react';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  getUserSession,
  isUserAuthAvailable,
  requestUserSignIn,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signInWithGoogle,
  signUpWithEmailPassword,
  signOutCurrentUser,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
  updateCurrentUserPassword,
} from '@lego-platform/user/data-access';
import { warnAboutMissingBrowserSupabaseConfig } from '@lego-platform/shared/data-access-auth';
import { UserSessionCard } from '@lego-platform/user/ui';
import {
  createAnonymousUserSession,
  isAuthenticatedSession,
} from '@lego-platform/user/util';
import type { UserSession } from '@lego-platform/user/util';

type UserAuthMode = 'magic-link' | 'reset-password' | 'sign-in' | 'sign-up';

export function UserFeatureAuth() {
  const [userSession, setUserSession] = useState<UserSession>(
    createAnonymousUserSession(),
  );
  const [authMode, setAuthMode] = useState<UserAuthMode>('sign-in');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirmation, setAuthPasswordConfirmation] = useState('');
  const [passwordResetValue, setPasswordResetValue] = useState('');
  const [passwordResetConfirmation, setPasswordResetConfirmation] =
    useState('');
  const [authStatusMessage, setAuthStatusMessage] = useState<string>();
  const [isAuthActionPending, setIsAuthActionPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  const isMountedRef = useRef(true);
  const authAvailable = isUserAuthAvailable();

  function resetAuthMessages() {
    setErrorMessage(undefined);
    setAuthStatusMessage(undefined);
  }

  function setNextAuthMode(nextMode: UserAuthMode) {
    setAuthMode(nextMode);
    resetAuthMessages();
  }

  function clearPasswordFields() {
    setAuthPassword('');
    setAuthPasswordConfirmation('');
  }

  async function loadUserSession() {
    try {
      const nextUserSession = await getUserSession();

      if (!isMountedRef.current) {
        return;
      }

      setUserSession(nextUserSession);
      setErrorMessage(undefined);

      if (isAuthenticatedSession(nextUserSession)) {
        setAuthEmail(nextUserSession.account?.email ?? '');
      }
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      setUserSession(createAnonymousUserSession());
      setErrorMessage('De huidige sessie kon nu niet worden geladen.');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);

      setIsPasswordRecoveryMode(searchParams.get('auth') === 'reset-password');
    }

    if (!authAvailable) {
      warnAboutMissingBrowserSupabaseConfig();
    }
    void loadUserSession();
    const unsubscribeAuth = subscribeToUserAuthChanges(() => {
      if (!isMountedRef.current) {
        return;
      }

      setIsLoading(true);
      void loadUserSession();
    });
    const unsubscribeAccount = subscribeToUserAccountChanges(() => {
      if (!isMountedRef.current) {
        return;
      }

      void loadUserSession();
    });

    return () => {
      isMountedRef.current = false;
      unsubscribeAuth();
      unsubscribeAccount();
    };
  }, [authAvailable]);

  async function handlePrimaryAuthAction() {
    const nextEmail = authEmail.trim();

    setIsAuthActionPending(true);
    resetAuthMessages();

    try {
      if (authMode === 'sign-in') {
        if (!nextEmail) {
          throw new Error(
            'Vul het e-mailadres in dat je wilt gebruiken om in te loggen.',
          );
        }

        await signInWithEmailPassword({
          email: nextEmail,
          password: authPassword,
        });
        clearPasswordFields();
        setAuthStatusMessage(
          'Je bent ingelogd. Je account, verlanglijst en collectie staan klaar.',
        );
        setIsLoading(true);
        await loadUserSession();
        return;
      }

      if (authMode === 'sign-up') {
        if (!nextEmail) {
          throw new Error(
            'Vul het e-mailadres in dat je voor het nieuwe account wilt gebruiken.',
          );
        }

        if (!authPassword) {
          throw new Error('Kies een wachtwoord voor het nieuwe account.');
        }

        if (authPassword !== authPasswordConfirmation) {
          throw new Error('De wachtwoordbevestiging komt nog niet overeen.');
        }

        const { requiresEmailConfirmation } = await signUpWithEmailPassword({
          email: nextEmail,
          password: authPassword,
        });

        clearPasswordFields();

        if (requiresEmailConfirmation) {
          setNextAuthMode('sign-in');
          setAuthStatusMessage(
            `Controleer ${nextEmail} om je account te bevestigen. Daarna kun je hier inloggen met je wachtwoord.`,
          );
          return;
        }

        setAuthStatusMessage(
          'Account aangemaakt. Je prive verzamelaarsstatus is klaar voor gebruik.',
        );
        setIsLoading(true);
        await loadUserSession();
        return;
      }

      if (authMode === 'reset-password') {
        if (!nextEmail) {
          throw new Error(
            'Vul het e-mailadres in dat aan je account gekoppeld is.',
          );
        }

        await sendPasswordResetEmail({
          email: nextEmail,
        });
        setAuthStatusMessage(
          `Controleer ${nextEmail} voor je wachtwoordherstelmail. Open daar de link om een nieuw wachtwoord te kiezen.`,
        );
        return;
      }

      if (!nextEmail) {
        throw new Error(
          'Vul het e-mailadres in dat je wilt gebruiken om in te loggen.',
        );
      }

      await requestUserSignIn({
        email: nextEmail,
      });
      setAuthStatusMessage(
        `Controleer ${nextEmail} voor je inloglink. Zodra je die opent, ververst je accountpagina automatisch. Komt hij niet meteen binnen, wacht dan ongeveer een minuut voordat je een nieuwe aanvraagt.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Inloggen kon nu niet worden gestart.',
      );
    } finally {
      setIsAuthActionPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsAuthActionPending(true);
    resetAuthMessages();

    try {
      await signInWithGoogle();
      setAuthStatusMessage(
        'Doorgaan met Google. Als de redirect niet start, probeer het zo nog eens.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Inloggen met Google kon nu niet worden gestart.',
      );
    } finally {
      setIsAuthActionPending(false);
    }
  }

  async function handleCompletePasswordReset() {
    setIsAuthActionPending(true);
    resetAuthMessages();

    try {
      if (!passwordResetValue) {
        throw new Error(
          'Vul eerst een nieuw wachtwoord in voordat je opslaat.',
        );
      }

      if (passwordResetValue !== passwordResetConfirmation) {
        throw new Error(
          'De bevestiging van het nieuwe wachtwoord komt nog niet overeen.',
        );
      }

      await updateCurrentUserPassword({
        password: passwordResetValue,
      });
      setPasswordResetValue('');
      setPasswordResetConfirmation('');
      setIsPasswordRecoveryMode(false);
      setAuthStatusMessage(
        'Wachtwoord bijgewerkt. Je kunt dit account blijven gebruiken met je nieuwe wachtwoord.',
      );

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', buildWebPath(webPathnames.account));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Het nieuwe wachtwoord kon nu niet worden opgeslagen.',
      );
    } finally {
      setIsAuthActionPending(false);
    }
  }

  async function handleSignOut() {
    setIsAuthActionPending(true);
    resetAuthMessages();

    try {
      await signOutCurrentUser();
      clearPasswordFields();
      setPasswordResetValue('');
      setPasswordResetConfirmation('');
      setIsPasswordRecoveryMode(false);
      setAuthStatusMessage(
        'Je bent uitgelogd. Je opgeslagen sets staan hier nog steeds zodra je opnieuw inlogt.',
      );
      setIsLoading(true);
      await loadUserSession();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Uitloggen kon nu niet worden voltooid.',
      );
    } finally {
      setIsAuthActionPending(false);
    }
  }

  return (
    <UserSessionCard
      authMode={authMode}
      authEmail={authEmail}
      authPassword={authPassword}
      authPasswordConfirmation={authPasswordConfirmation}
      authStatusMessage={authStatusMessage}
      errorMessage={errorMessage}
      isAuthActionPending={isAuthActionPending}
      isAuthAvailable={authAvailable}
      isLoading={isLoading}
      isPasswordRecoveryMode={isPasswordRecoveryMode}
      onAuthEmailChange={(value) => {
        setAuthEmail(value);
        resetAuthMessages();
      }}
      onAuthModeChange={setNextAuthMode}
      onAuthPasswordChange={(value) => {
        setAuthPassword(value);
        resetAuthMessages();
      }}
      onAuthPasswordConfirmationChange={(value) => {
        setAuthPasswordConfirmation(value);
        resetAuthMessages();
      }}
      onCompletePasswordRecovery={handleCompletePasswordReset}
      onGoogleSignIn={handleGoogleSignIn}
      onPasswordRecoveryChange={(value) => {
        setPasswordResetValue(value);
        resetAuthMessages();
      }}
      onPasswordRecoveryConfirmationChange={(value) => {
        setPasswordResetConfirmation(value);
        resetAuthMessages();
      }}
      onPrimaryAuthAction={handlePrimaryAuthAction}
      onSignOut={handleSignOut}
      passwordRecoveryConfirmation={passwordResetConfirmation}
      passwordRecoveryValue={passwordResetValue}
      userSession={userSession}
    />
  );
}

export default UserFeatureAuth;
