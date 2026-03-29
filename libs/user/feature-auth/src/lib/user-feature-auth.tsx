'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getUserSession,
  isUserAuthAvailable,
  requestUserSignIn,
  signOutCurrentUser,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
} from '@lego-platform/user/data-access';
import { warnAboutMissingBrowserSupabaseConfig } from '@lego-platform/shared/data-access-auth';
import { UserSessionCard } from '@lego-platform/user/ui';
import {
  createAnonymousUserSession,
  isAuthenticatedSession,
} from '@lego-platform/user/util';
import type { UserSession } from '@lego-platform/user/util';

export function UserFeatureAuth() {
  const [userSession, setUserSession] = useState<UserSession>(
    createAnonymousUserSession(),
  );
  const [authEmail, setAuthEmail] = useState('');
  const [authStatusMessage, setAuthStatusMessage] = useState<string>();
  const [isAuthActionPending, setIsAuthActionPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const isMountedRef = useRef(true);
  const authAvailable = isUserAuthAvailable();

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
        setAuthStatusMessage(undefined);
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

  async function handleSignIn() {
    const nextEmail = authEmail.trim();

    if (!nextEmail) {
      setErrorMessage('Enter the email address you want to use for sign-in.');
      return;
    }

    setIsAuthActionPending(true);
    setErrorMessage(undefined);
    setAuthStatusMessage(undefined);

    try {
      await requestUserSignIn({
        email: nextEmail,
      });
      setAuthStatusMessage(
        `Check ${nextEmail} for your sign-in link. If it does not arrive right away, wait about a minute before requesting another one.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start email sign-in right now.',
      );
    } finally {
      setIsAuthActionPending(false);
    }
  }

  async function handleSignOut() {
    setIsAuthActionPending(true);
    setErrorMessage(undefined);

    try {
      await signOutCurrentUser();
      setAuthStatusMessage(
        'Signed out. Your saved collector state stays attached to your account.',
      );
      setIsLoading(true);
      await loadUserSession();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign out right now.',
      );
    } finally {
      setIsAuthActionPending(false);
    }
  }

  return (
    <UserSessionCard
      authEmail={authEmail}
      authStatusMessage={authStatusMessage}
      errorMessage={errorMessage}
      isAuthActionPending={isAuthActionPending}
      isAuthAvailable={authAvailable}
      isLoading={isLoading}
      onAuthEmailChange={(value) => {
        setAuthEmail(value);
        setErrorMessage(undefined);
        setAuthStatusMessage(undefined);
      }}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      userSession={userSession}
    />
  );
}

export default UserFeatureAuth;
