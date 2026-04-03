'use client';

import { useEffect, useRef, useState } from 'react';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { CollectorWishlistPanel } from '@lego-platform/wishlist/ui';
import {
  getUserSession,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
} from '@lego-platform/user/data-access';
import {
  createAnonymousUserSession,
  isAuthenticatedSession,
  type UserSession,
} from '@lego-platform/user/util';

export function ShellFeatureCollectorWishlist() {
  const [userSession, setUserSession] = useState<UserSession>(
    createAnonymousUserSession(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const isMountedRef = useRef(true);

  async function loadUserSession() {
    try {
      const nextUserSession = await getUserSession();

      if (!isMountedRef.current) {
        return;
      }

      setUserSession(nextUserSession);
      setErrorMessage(undefined);
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      setUserSession(createAnonymousUserSession());
      setErrorMessage('Unable to load your private wishlist right now.');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
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
  }, []);

  if (isLoading) {
    return <CollectorWishlistPanel state="loading" />;
  }

  if (!isAuthenticatedSession(userSession)) {
    return (
      <CollectorWishlistPanel errorMessage={errorMessage} state="signed-out" />
    );
  }

  const wantedSetCards = listCatalogSetCardsByIds(userSession.wantedSetIds);
  const hiddenWantedCount = Math.max(
    0,
    userSession.wantedSetIds.length - wantedSetCards.length,
  );

  if (!wantedSetCards.length) {
    return (
      <CollectorWishlistPanel
        collectorName={userSession.collector.name}
        hiddenWantedCount={hiddenWantedCount}
        state="empty"
        wantedCount={0}
      />
    );
  }

  return (
    <CollectorWishlistPanel
      collectorName={userSession.collector.name}
      hiddenWantedCount={hiddenWantedCount}
      state="populated"
      wantedCount={wantedSetCards.length}
    >
      {wantedSetCards.map((catalogSetCard) => (
        <CatalogSetCard
          href={buildSetDetailPath(catalogSetCard.slug)}
          key={catalogSetCard.id}
          savedState="wishlist"
          setSummary={catalogSetCard}
        />
      ))}
    </CollectorWishlistPanel>
  );
}

export default ShellFeatureCollectorWishlist;
