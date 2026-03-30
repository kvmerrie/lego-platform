'use client';

import { useEffect, useRef, useState } from 'react';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
import { CollectorCollectionPanel } from '@lego-platform/collection/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
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

export function ShellFeatureCollectorCollection() {
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
      setErrorMessage('Unable to load your private collection right now.');
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
    return <CollectorCollectionPanel state="loading" />;
  }

  if (!isAuthenticatedSession(userSession)) {
    return (
      <CollectorCollectionPanel
        errorMessage={errorMessage}
        state="signed-out"
      />
    );
  }

  const ownedSetCards = listCatalogSetCardsByIds(userSession.ownedSetIds);
  const hiddenOwnedCount = Math.max(
    0,
    userSession.ownedSetIds.length - ownedSetCards.length,
  );

  if (!ownedSetCards.length) {
    return (
      <CollectorCollectionPanel
        collectorName={userSession.collector.name}
        hiddenOwnedCount={hiddenOwnedCount}
        ownedCount={0}
        state="empty"
      />
    );
  }

  return (
    <CollectorCollectionPanel
      collectorName={userSession.collector.name}
      hiddenOwnedCount={hiddenOwnedCount}
      ownedCount={ownedSetCards.length}
      state="populated"
    >
      {ownedSetCards.map((catalogSetCard) => (
        <CatalogSetCard
          href={buildSetDetailPath(catalogSetCard.slug)}
          key={catalogSetCard.id}
          setSummary={catalogSetCard}
        />
      ))}
    </CollectorCollectionPanel>
  );
}

export default ShellFeatureCollectorCollection;
