'use client';

import { useEffect, useRef, useState } from 'react';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
import { removeOwnedSet } from '@lego-platform/collection/data-access';
import { CollectorCollectionPanel } from '@lego-platform/collection/ui';
import { getReviewedPriceSummary } from '@lego-platform/pricing/data-access';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { Button } from '@lego-platform/shared/ui';
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
import styles from './shell-feature-collector-collection.module.css';

type SavedSetSortOrder = 'recent' | 'release-year' | 'theme';

const sortOptions: ReadonlyArray<{
  key: SavedSetSortOrder;
  label: string;
}> = [
  {
    key: 'recent',
    label: 'Recent',
  },
  {
    key: 'release-year',
    label: 'Releasejaar',
  },
  {
    key: 'theme',
    label: 'Thema',
  },
];

function sortSetCards<
  T extends {
    name: string;
    releaseYear: number;
    theme: string;
  },
>(setCards: readonly T[], sortOrder: SavedSetSortOrder): T[] {
  if (sortOrder === 'recent') {
    return [...setCards];
  }

  if (sortOrder === 'release-year') {
    return [...setCards].sort(
      (left, right) =>
        right.releaseYear - left.releaseYear ||
        left.theme.localeCompare(right.theme) ||
        left.name.localeCompare(right.name),
    );
  }

  return [...setCards].sort(
    (left, right) =>
      left.theme.localeCompare(right.theme) ||
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
}

function readActionErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function getCollectionMarketNote(
  priceSummary: ReturnType<typeof getReviewedPriceSummary>,
): string | undefined {
  if (!priceSummary) {
    return undefined;
  }

  return [
    priceSummary.dealLabel,
    priceSummary.availabilityLabel ?? priceSummary.reviewedLabel,
  ].join(' · ');
}

export function ShellFeatureCollectorCollection() {
  const [userSession, setUserSession] = useState<UserSession>(
    createAnonymousUserSession(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [pendingSetIds, setPendingSetIds] = useState<Record<string, string>>(
    {},
  );
  const [sortOrder, setSortOrder] = useState<SavedSetSortOrder>('recent');
  const [statusMessage, setStatusMessage] = useState<string>();
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
      setErrorMessage('Je prive collectie kon nu niet worden geladen.');
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
  const sortedOwnedSetCards = sortSetCards(ownedSetCards, sortOrder);
  const hiddenOwnedCount = Math.max(
    0,
    userSession.ownedSetIds.length - ownedSetCards.length,
  );

  async function handleRemoveFromCollection({
    name,
    setId,
  }: {
    name: string;
    setId: string;
  }) {
    setPendingSetIds((currentPendingSetIds) => ({
      ...currentPendingSetIds,
      [setId]: 'remove',
    }));
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    try {
      await removeOwnedSet(setId);

      if (!isMountedRef.current) {
        return;
      }

      setStatusMessage(`${name} is uit je collectie verwijderd.`);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        readActionErrorMessage(
          error,
          'Je collectie kon nu niet worden bijgewerkt.',
        ),
      );
    } finally {
      if (isMountedRef.current) {
        setPendingSetIds((currentPendingSetIds) => {
          const nextPendingSetIds = { ...currentPendingSetIds };

          delete nextPendingSetIds[setId];

          return nextPendingSetIds;
        });
      }
    }
  }

  if (!ownedSetCards.length) {
    return (
      <CollectorCollectionPanel
        collectorName={userSession.collector.name}
        errorMessage={errorMessage}
        hiddenOwnedCount={hiddenOwnedCount}
        ownedCount={0}
        statusMessage={statusMessage}
        state="empty"
      />
    );
  }

  return (
    <CollectorCollectionPanel
      collectorName={userSession.collector.name}
      controls={
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <p className={styles.toolbarLabel}>Sorteren</p>
            <div className={styles.toolbarActions}>
              {sortOptions.map((sortOption) => (
                <Button
                  aria-pressed={sortOrder === sortOption.key}
                  key={sortOption.key}
                  tone={sortOrder === sortOption.key ? 'accent' : 'secondary'}
                  type="button"
                  onClick={() => setSortOrder(sortOption.key)}
                >
                  {sortOption.label}
                </Button>
              ))}
            </div>
          </div>
          <p className={styles.toolbarMeta}>
            {ownedSetCards.length} opgeslagen
          </p>
        </div>
      }
      errorMessage={errorMessage}
      hiddenOwnedCount={hiddenOwnedCount}
      ownedCount={ownedSetCards.length}
      statusMessage={statusMessage}
      state="populated"
    >
      {sortedOwnedSetCards.map((catalogSetCard) => {
        const reviewedPriceSummary = getReviewedPriceSummary(catalogSetCard.id);

        return (
          <CatalogSetCard
            actions={
              <div className={styles.cardActions}>
                <Button
                  disabled={Boolean(pendingSetIds[catalogSetCard.id])}
                  isLoading={pendingSetIds[catalogSetCard.id] === 'remove'}
                  tone="ghost"
                  type="button"
                  onClick={() =>
                    void handleRemoveFromCollection({
                      name: catalogSetCard.name,
                      setId: catalogSetCard.id,
                    })
                  }
                >
                  Verwijder
                </Button>
              </div>
            }
            href={buildSetDetailPath(catalogSetCard.slug)}
            key={catalogSetCard.id}
            priceContext={
              reviewedPriceSummary
                ? {
                    coverageLabel: reviewedPriceSummary.coverageLabel,
                    currentPrice: reviewedPriceSummary.currentPrice,
                    merchantLabel: reviewedPriceSummary.merchantLabel,
                    pricePositionLabel: reviewedPriceSummary.pricePositionLabel,
                    reviewedLabel: reviewedPriceSummary.reviewedLabel,
                  }
                : undefined
            }
            priceDisplay="subtle"
            savedState="owned"
            setSummary={catalogSetCard}
            supportingNote={getCollectionMarketNote(reviewedPriceSummary)}
          />
        );
      })}
    </CollectorCollectionPanel>
  );
}

export default ShellFeatureCollectorCollection;
