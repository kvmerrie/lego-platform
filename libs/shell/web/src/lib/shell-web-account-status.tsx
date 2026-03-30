'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { warnAboutMissingBrowserSupabaseConfig } from '@lego-platform/shared/data-access-auth';
import {
  getUserSession,
  isUserAuthAvailable,
  signOutCurrentUser,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
} from '@lego-platform/user/data-access';
import { UserShellAccountStatusCard } from '@lego-platform/user/ui';
import {
  createAnonymousUserSession,
  type UserSession,
} from '@lego-platform/user/util';

function createInitialUserSession(): UserSession {
  return createAnonymousUserSession();
}

export function ShellWebAccountStatus() {
  const [userSession, setUserSession] = useState<UserSession>(
    createInitialUserSession(),
  );
  const [statusMessage, setStatusMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthActionPending, setIsAuthActionPending] = useState(false);
  const isMountedRef = useRef(true);
  const latestUserSessionRef = useRef<UserSession>(createInitialUserSession());
  const authAvailable = isUserAuthAvailable();

  const applyUserSession = useCallback((nextUserSession: UserSession) => {
    latestUserSessionRef.current = nextUserSession;
    setUserSession(nextUserSession);
  }, []);

  const loadUserSession = useCallback(async () => {
    try {
      const nextUserSession = await getUserSession();

      if (!isMountedRef.current) {
        return;
      }

      applyUserSession(nextUserSession);
      setErrorMessage(undefined);

      if (nextUserSession.state === 'authenticated') {
        setStatusMessage(undefined);
      }
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      if (latestUserSessionRef.current.state === 'anonymous') {
        applyUserSession(createAnonymousUserSession());
      }

      setErrorMessage('Unable to refresh collector status right now.');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [applyUserSession]);

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
  }, [authAvailable, loadUserSession]);

  async function handleSignOut() {
    setIsAuthActionPending(true);
    setErrorMessage(undefined);

    try {
      await signOutCurrentUser();

      if (!isMountedRef.current) {
        return;
      }

      setStatusMessage(
        'Signed out. Your private collector state will be waiting when you sign back in.',
      );
      setIsLoading(true);
      await loadUserSession();
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to sign out right now.',
      );
    } finally {
      if (isMountedRef.current) {
        setIsAuthActionPending(false);
      }
    }
  }

  return (
    <UserShellAccountStatusCard
      errorMessage={errorMessage}
      isAuthActionPending={isAuthActionPending}
      isAuthAvailable={authAvailable}
      isLoading={isLoading}
      statusMessage={statusMessage}
      userSession={userSession}
      onSignOut={handleSignOut}
    />
  );
}

export default ShellWebAccountStatus;
