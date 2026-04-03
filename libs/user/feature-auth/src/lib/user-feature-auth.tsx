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
      setErrorMessage('Unable to load the current session right now.');
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
            'Enter the email address you want to use for sign-in.',
          );
        }

        await signInWithEmailPassword({
          email: nextEmail,
          password: authPassword,
        });
        clearPasswordFields();
        setAuthStatusMessage(
          'Signed in. Your account, wishlist, and collection are ready.',
        );
        setIsLoading(true);
        await loadUserSession();
        return;
      }

      if (authMode === 'sign-up') {
        if (!nextEmail) {
          throw new Error(
            'Enter the email address you want to use for the new account.',
          );
        }

        if (!authPassword) {
          throw new Error('Choose a password for the new account.');
        }

        if (authPassword !== authPasswordConfirmation) {
          throw new Error('The password confirmation does not match yet.');
        }

        const { requiresEmailConfirmation } = await signUpWithEmailPassword({
          email: nextEmail,
          password: authPassword,
        });

        clearPasswordFields();

        if (requiresEmailConfirmation) {
          setNextAuthMode('sign-in');
          setAuthStatusMessage(
            `Check ${nextEmail} to confirm your account. After confirmation, you can sign in here with your password.`,
          );
          return;
        }

        setAuthStatusMessage(
          'Account created. Your private collector saves are ready to use.',
        );
        setIsLoading(true);
        await loadUserSession();
        return;
      }

      if (authMode === 'reset-password') {
        if (!nextEmail) {
          throw new Error('Enter the email address tied to your account.');
        }

        await sendPasswordResetEmail({
          email: nextEmail,
        });
        setAuthStatusMessage(
          `Check ${nextEmail} for your password reset email. Open the link there to choose a new password.`,
        );
        return;
      }

      if (!nextEmail) {
        throw new Error('Enter the email address you want to use for sign-in.');
      }

      await requestUserSignIn({
        email: nextEmail,
      });
      setAuthStatusMessage(
        `Check ${nextEmail} for your sign-in link. Once you open it, your account page refreshes automatically. If it does not arrive right away, wait about a minute before requesting another one.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start sign-in right now.',
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
        'Continuing with Google. If the redirect does not start, try again in a moment.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start Google sign-in right now.',
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
        throw new Error('Enter a new password before saving it.');
      }

      if (passwordResetValue !== passwordResetConfirmation) {
        throw new Error('The new password confirmation does not match yet.');
      }

      await updateCurrentUserPassword({
        password: passwordResetValue,
      });
      setPasswordResetValue('');
      setPasswordResetConfirmation('');
      setIsPasswordRecoveryMode(false);
      setAuthStatusMessage(
        'Password updated. You can keep using this account with your new password.',
      );

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', buildWebPath(webPathnames.account));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save the new password right now.',
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
        'Signed out. Your saved sets will still be here when you sign back in.',
      );
      setIsLoading(true);
      await loadUserSession();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to sign out right now.',
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
