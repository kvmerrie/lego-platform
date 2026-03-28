'use client';

import { useEffect, useState } from 'react';
import { getUserSession } from '@lego-platform/user/data-access';
import { UserSessionCard } from '@lego-platform/user/ui';
import { createAnonymousUserSession } from '@lego-platform/user/util';
import type { UserSession } from '@lego-platform/user/util';

export function UserFeatureAuth() {
  const [userSession, setUserSession] = useState<UserSession>(
    createAnonymousUserSession(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    async function loadUserSession() {
      try {
        const nextUserSession = await getUserSession();

        if (!isMounted) {
          return;
        }

        setUserSession(nextUserSession);
        setErrorMessage(undefined);
      } catch {
        if (!isMounted) {
          return;
        }

        setUserSession(createAnonymousUserSession());
        setErrorMessage('Unable to reach the mock session endpoint right now.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUserSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <UserSessionCard
      errorMessage={errorMessage}
      isLoading={isLoading}
      userSession={userSession}
    />
  );
}

export default UserFeatureAuth;
