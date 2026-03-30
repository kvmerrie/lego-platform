'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { warnAboutMissingBrowserSupabaseConfig } from '@lego-platform/shared/data-access-auth';
import { ActionLink, Button } from '@lego-platform/shared/ui';
import {
  getUserSession,
  isUserAuthAvailable,
  signOutCurrentUser,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
} from '@lego-platform/user/data-access';
import {
  createAnonymousUserSession,
  isAuthenticatedSession,
  type UserSession,
} from '@lego-platform/user/util';
import styles from './shell-web.module.css';

function createInitialUserSession(): UserSession {
  return createAnonymousUserSession();
}

export function ShellWebAccountStatus({
  variant,
}: {
  variant: 'header' | 'menu';
}) {
  const [userSession, setUserSession] = useState<UserSession>(
    createInitialUserSession(),
  );
  const [statusMessage, setStatusMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuthActionPending, setIsAuthActionPending] = useState(false);
  const isMountedRef = useRef(true);
  const latestUserSessionRef = useRef<UserSession>(createInitialUserSession());
  const authAvailable = isUserAuthAvailable();

  const applyUserSession = useCallback((nextUserSession: UserSession) => {
    latestUserSessionRef.current = nextUserSession;
    setUserSession(nextUserSession);
  }, []);

  const loadUserSession = useCallback(
    async ({
      isBackgroundRefresh = false,
    }: { isBackgroundRefresh?: boolean } = {}) => {
      if (isBackgroundRefresh && isMountedRef.current) {
        setIsRefreshing(true);
      }

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
          setIsBootstrapping(false);
          setIsRefreshing(false);
        }
      }
    },
    [applyUserSession],
  );

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

      void loadUserSession({ isBackgroundRefresh: true });
    });
    const unsubscribeAccount = subscribeToUserAccountChanges(() => {
      if (!isMountedRef.current) {
        return;
      }

      void loadUserSession({ isBackgroundRefresh: true });
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
        'Signed out. Your private saves will be here when you return.',
      );
      await loadUserSession({ isBackgroundRefresh: true });
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

  if (isBootstrapping) {
    return variant === 'header' ? (
      <div aria-busy="true" aria-live="polite" className={styles.accountStatus}>
        <span
          aria-hidden="true"
          className={`${styles.statusDot} ${styles.statusDotInfo}`}
        />
        <span className={styles.accountStatusText}>Checking</span>
        <span aria-hidden="true" className={styles.accountActionPlaceholder} />
      </div>
    ) : (
      <div className={styles.menuAccountStatus} aria-live="polite">
        <p className={styles.menuAccountTitle}>Checking collector status</p>
      </div>
    );
  }

  if (!isAuthenticatedSession(userSession)) {
    return variant === 'header' ? (
      <div
        aria-busy={isRefreshing || undefined}
        className={styles.accountStatus}
      >
        <span
          aria-hidden="true"
          className={`${styles.statusDot} ${styles.statusDotWarning}`}
        />
        <span className={styles.accountStatusText}>Signed out</span>
        <ActionLink
          className={styles.accountActionLink}
          href="/collection"
          tone="secondary"
        >
          Sign in
        </ActionLink>
      </div>
    ) : (
      <div className={styles.menuAccountStatus}>
        <p className={styles.menuAccountTitle}>Signed out</p>
        <p className={styles.menuAccountMeta}>
          Sign in to save your collection and wishlist privately.
        </p>
        <div className={styles.menuAccountActions}>
          <ActionLink href="/collection" tone="accent">
            Sign in
          </ActionLink>
        </div>
        {statusMessage ? (
          <p aria-live="polite" className={styles.menuAccountInfo}>
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p aria-live="polite" className={styles.menuAccountError}>
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return variant === 'header' ? (
    <div aria-busy={isRefreshing || undefined} className={styles.accountStatus}>
      <span
        aria-hidden="true"
        className={`${styles.statusDot} ${styles.statusDotPositive}`}
      />
      <span className={styles.accountStatusName}>
        {userSession.collector.name}
      </span>
      <Button
        className={styles.accountActionButton}
        isLoading={Boolean(isAuthActionPending)}
        tone="ghost"
        type="button"
        onClick={handleSignOut}
      >
        Sign out
      </Button>
    </div>
  ) : (
    <div className={styles.menuAccountStatus}>
      <p className={styles.menuAccountTitle}>{userSession.collector.name}</p>
      <p className={styles.menuAccountMeta}>@{userSession.collector.id}</p>
      <div className={styles.menuAccountActions}>
        <Button
          className={styles.accountActionButton}
          isLoading={Boolean(isAuthActionPending)}
          tone="ghost"
          type="button"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </div>
      {statusMessage ? (
        <p aria-live="polite" className={styles.menuAccountInfo}>
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p aria-live="polite" className={styles.menuAccountError}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default ShellWebAccountStatus;
