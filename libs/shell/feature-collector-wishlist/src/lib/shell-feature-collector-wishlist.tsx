'use client';

import { useEffect, useRef, useState } from 'react';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
import {
  CatalogSetCard,
  type CatalogSetCardContextBadge,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { addOwnedSet } from '@lego-platform/collection/data-access';
import {
  getReviewedPriceSummary,
  listWishlistPriceAlerts,
  type WishlistPriceAlert,
} from '@lego-platform/pricing/data-access';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { Button } from '@lego-platform/shared/ui';
import { removeWantedSet } from '@lego-platform/wishlist/data-access';
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
import styles from './shell-feature-collector-wishlist.module.css';

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
    label: 'Release year',
  },
  {
    key: 'theme',
    label: 'Theme',
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

function toWishlistPriceContext(
  priceSummary: ReturnType<typeof getReviewedPriceSummary>,
): CatalogSetCardPriceContext | undefined {
  if (!priceSummary) {
    return undefined;
  }

  return {
    coverageLabel: priceSummary.coverageLabel,
    currentPrice: priceSummary.currentPrice,
    merchantLabel: priceSummary.merchantLabel,
    pricePositionLabel: priceSummary.pricePositionLabel,
    reviewedLabel: priceSummary.reviewedLabel,
  };
}

function getWishlistBuyingNote({
  priceSummary,
  wishlistAlert,
}: {
  priceSummary: ReturnType<typeof getReviewedPriceSummary>;
  wishlistAlert?: WishlistPriceAlert;
}): string | undefined {
  if (wishlistAlert) {
    return wishlistAlert.detail;
  }

  if (!priceSummary) {
    return undefined;
  }

  if (priceSummary.dealLabel === 'Best current deal') {
    return `${priceSummary.dealLabel} · ${
      priceSummary.availabilityLabel ??
      priceSummary.coverageNote ??
      priceSummary.reviewedLabel
    }`;
  }

  return (
    priceSummary.coverageNote ??
    priceSummary.availabilityLabel ??
    priceSummary.reviewedLabel
  );
}

function toWishlistContextBadge(
  wishlistAlert?: WishlistPriceAlert,
): CatalogSetCardContextBadge | undefined {
  if (!wishlistAlert) {
    return undefined;
  }

  return {
    label: wishlistAlert.label,
    tone: wishlistAlert.tone,
  };
}

export function ShellFeatureCollectorWishlist() {
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
  const [wishlistAlerts, setWishlistAlerts] = useState<
    Record<string, WishlistPriceAlert | undefined>
  >({});
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

  useEffect(() => {
    if (!isAuthenticatedSession(userSession)) {
      setWishlistAlerts({});
      return;
    }

    if (userSession.wantedSetIds.length === 0) {
      setWishlistAlerts({});
      return;
    }

    let isCancelled = false;
    const savedAtBySetId = Object.fromEntries(
      userSession.setStates
        .filter((setState) => setState.state === 'wishlist')
        .map((setState) => [setState.setId, setState.createdAt]),
    );

    void listWishlistPriceAlerts({
      savedAtBySetId,
      setIds: userSession.wantedSetIds,
    })
      .then((nextWishlistAlerts) => {
        if (isCancelled || !isMountedRef.current) {
          return;
        }

        setWishlistAlerts(nextWishlistAlerts);
      })
      .catch(() => {
        if (isCancelled || !isMountedRef.current) {
          return;
        }

        setWishlistAlerts({});
      });

    return () => {
      isCancelled = true;
    };
  }, [userSession]);

  if (isLoading) {
    return <CollectorWishlistPanel state="loading" />;
  }

  if (!isAuthenticatedSession(userSession)) {
    return (
      <CollectorWishlistPanel errorMessage={errorMessage} state="signed-out" />
    );
  }

  const wantedSetCards = listCatalogSetCardsByIds(userSession.wantedSetIds);
  const sortedWantedSetCards = sortSetCards(wantedSetCards, sortOrder);
  const activeWishlistAlertCount = wantedSetCards.filter(
    (catalogSetCard) => wishlistAlerts[catalogSetCard.id],
  ).length;
  const hiddenWantedCount = Math.max(
    0,
    userSession.wantedSetIds.length - wantedSetCards.length,
  );

  async function handleMoveToCollection({
    name,
    setId,
  }: {
    name: string;
    setId: string;
  }) {
    setPendingSetIds((currentPendingSetIds) => ({
      ...currentPendingSetIds,
      [setId]: 'move',
    }));
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    try {
      await addOwnedSet(setId);

      if (!isMountedRef.current) {
        return;
      }

      setStatusMessage(`${name} moved to your collection.`);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        readActionErrorMessage(
          error,
          'Unable to move this set to your collection right now.',
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

  async function handleRemoveFromWishlist({
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
      await removeWantedSet(setId);

      if (!isMountedRef.current) {
        return;
      }

      setStatusMessage(`${name} removed from your wishlist.`);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        readActionErrorMessage(
          error,
          'Unable to update your wishlist right now.',
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

  if (!wantedSetCards.length) {
    return (
      <CollectorWishlistPanel
        collectorName={userSession.collector.name}
        errorMessage={errorMessage}
        hiddenWantedCount={hiddenWantedCount}
        statusMessage={statusMessage}
        state="empty"
        wantedCount={0}
      />
    );
  }

  return (
    <CollectorWishlistPanel
      collectorName={userSession.collector.name}
      controls={
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <p className={styles.toolbarLabel}>Sort</p>
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
            {wantedSetCards.length} saved
            {activeWishlistAlertCount > 0
              ? ` · ${activeWishlistAlertCount} buy signal${
                  activeWishlistAlertCount === 1 ? '' : 's'
                } right now`
              : ''}
          </p>
        </div>
      }
      errorMessage={errorMessage}
      hiddenWantedCount={hiddenWantedCount}
      statusMessage={statusMessage}
      state="populated"
      wantedCount={wantedSetCards.length}
    >
      {sortedWantedSetCards.map((catalogSetCard) => {
        const reviewedPriceSummary = getReviewedPriceSummary(catalogSetCard.id);
        const wishlistAlert = wishlistAlerts[catalogSetCard.id];

        return (
          <CatalogSetCard
            actions={
              <div className={styles.cardActions}>
                <Button
                  disabled={Boolean(pendingSetIds[catalogSetCard.id])}
                  isLoading={pendingSetIds[catalogSetCard.id] === 'move'}
                  tone="accent"
                  type="button"
                  onClick={() =>
                    void handleMoveToCollection({
                      name: catalogSetCard.name,
                      setId: catalogSetCard.id,
                    })
                  }
                >
                  Move to collection
                </Button>
                <Button
                  disabled={Boolean(pendingSetIds[catalogSetCard.id])}
                  isLoading={pendingSetIds[catalogSetCard.id] === 'remove'}
                  tone="ghost"
                  type="button"
                  onClick={() =>
                    void handleRemoveFromWishlist({
                      name: catalogSetCard.name,
                      setId: catalogSetCard.id,
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            }
            contextBadge={toWishlistContextBadge(wishlistAlert)}
            href={buildSetDetailPath(catalogSetCard.slug)}
            key={catalogSetCard.id}
            priceContext={toWishlistPriceContext(reviewedPriceSummary)}
            savedState="wishlist"
            setSummary={catalogSetCard}
            supportingNote={getWishlistBuyingNote({
              priceSummary: reviewedPriceSummary,
              wishlistAlert,
            })}
          />
        );
      })}
    </CollectorWishlistPanel>
  );
}

export default ShellFeatureCollectorWishlist;
