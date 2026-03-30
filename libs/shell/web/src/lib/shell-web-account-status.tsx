'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import { warnAboutMissingBrowserSupabaseConfig } from '@lego-platform/shared/data-access-auth';
import { ActionLink } from '@lego-platform/shared/ui';
import {
  getUserSession,
  isUserAuthAvailable,
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
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
          href={buildWebPath(webPathnames.account)}
          tone="secondary"
        >
          Sign in
        </ActionLink>
      </div>
    ) : (
      <div className={styles.menuAccountStatus}>
        <p className={styles.menuAccountTitle}>Signed out</p>
        <p className={styles.menuAccountMeta}>
          Sign in to open your collection, wishlist, and collector details.
        </p>
        <div className={styles.menuAccountActions}>
          <ActionLink href={buildWebPath(webPathnames.account)} tone="accent">
            Sign in
          </ActionLink>
        </div>
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
      <a
        className={styles.accountStatusNameLink}
        href={buildWebPath(webPathnames.account)}
      >
        {userSession.collector.name}
      </a>
      <ActionLink
        className={styles.accountActionLink}
        href={buildWebPath(webPathnames.account)}
        tone="secondary"
      >
        Account
      </ActionLink>
    </div>
  ) : (
    <div className={styles.menuAccountStatus}>
      <p className={styles.menuAccountTitle}>{userSession.collector.name}</p>
      <p className={styles.menuAccountMeta}>
        @{userSession.collector.id} · Collection and wishlist live here.
      </p>
      <div className={styles.menuAccountActions}>
        <ActionLink href={buildWebPath(webPathnames.account)} tone="secondary">
          Open account
        </ActionLink>
      </div>
      {errorMessage ? (
        <p aria-live="polite" className={styles.menuAccountError}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default ShellWebAccountStatus;
