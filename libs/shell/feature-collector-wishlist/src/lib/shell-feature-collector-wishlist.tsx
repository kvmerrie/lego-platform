'use client';

import { useEffect, useRef, useState } from 'react';
import { listCatalogSetCardsByIdsForBrowser } from '@lego-platform/catalog/data-access-web';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSetCard,
  type CatalogSetCardContextBadge,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { addOwnedSet } from '@lego-platform/collection/data-access';
import {
  buildSetDecisionPresentation,
  getPricePanelSnapshot,
  getReviewedPriceSummary,
  isWishlistAlertNotificationCandidateNew,
  listWishlistAlertNotificationCandidates,
  listWishlistPriceAlerts,
  type WishlistPriceAlert,
} from '@lego-platform/pricing/data-access';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { Button } from '@lego-platform/shared/ui';
import { removeWantedSet } from '@lego-platform/wishlist/data-access';
import { CollectorWishlistPanel } from '@lego-platform/wishlist/ui';
import {
  getUserSession,
  markWishlistAlertsViewed,
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

function toWishlistPriceContext({
  pricePanelSnapshot,
  priceSummary,
  theme,
}: {
  pricePanelSnapshot: ReturnType<typeof getPricePanelSnapshot>;
  priceSummary: ReturnType<typeof getReviewedPriceSummary>;
  theme: string;
}): CatalogSetCardPriceContext | undefined {
  if (!priceSummary) {
    return undefined;
  }

  const decisionPresentation = buildSetDecisionPresentation({
    hasCurrentOffer: false,
    pricePanelSnapshot,
    theme,
  });

  return {
    coverageLabel: priceSummary.coverageLabel,
    currentPrice: priceSummary.currentPrice,
    decisionLabel: decisionPresentation.cardLabel,
    decisionNote: decisionPresentation.cardSupportingCopy,
    merchantLabel: priceSummary.merchantLabel,
    pricePositionLabel: priceSummary.pricePositionLabel,
    pricePositionTone: decisionPresentation.verdict.tone,
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

  if (priceSummary.dealLabel === 'Beste deal nu') {
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

function toWishlistContextBadge({
  isNew,
  wishlistAlert,
}: {
  isNew?: boolean;
  wishlistAlert?: WishlistPriceAlert;
}): CatalogSetCardContextBadge | undefined {
  if (!wishlistAlert) {
    return undefined;
  }

  return {
    label: isNew ? `Nieuw · ${wishlistAlert.label}` : wishlistAlert.label,
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
  const [wantedSetCards, setWantedSetCards] = useState<
    CatalogHomepageSetCard[]
  >([]);
  const isMountedRef = useRef(true);
  const hasMarkedViewedRef = useRef(false);

  async function loadUserSession() {
    try {
      const nextUserSession = await getUserSession();
      const nextWantedSetCards = isAuthenticatedSession(nextUserSession)
        ? await listCatalogSetCardsByIdsForBrowser({
            canonicalIds: nextUserSession.wantedSetIds,
          })
        : [];

      if (!isMountedRef.current) {
        return;
      }

      setWantedSetCards(nextWantedSetCards);
      setUserSession(nextUserSession);
      setErrorMessage(undefined);
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      setWantedSetCards([]);
      setUserSession(createAnonymousUserSession());
      setErrorMessage('Je prive verlanglijst kon nu niet worden geladen.');
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
      hasMarkedViewedRef.current = false;
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

  useEffect(() => {
    if (
      hasMarkedViewedRef.current ||
      !isAuthenticatedSession(userSession) ||
      !userSession.notificationPreferences.wishlistDealAlerts ||
      userSession.wantedSetIds.length === 0
    ) {
      return;
    }

    hasMarkedViewedRef.current = true;
    void markWishlistAlertsViewed().catch(() => undefined);
  }, [userSession]);

  if (isLoading) {
    return <CollectorWishlistPanel state="loading" />;
  }

  if (!isAuthenticatedSession(userSession)) {
    return (
      <CollectorWishlistPanel errorMessage={errorMessage} state="signed-out" />
    );
  }

  const sortedWantedSetCards = sortSetCards(wantedSetCards, sortOrder);
  const activeWishlistAlertCount = wantedSetCards.filter(
    (catalogSetCard) => wishlistAlerts[catalogSetCard.id],
  ).length;
  const wishlistAlertNotificationCandidates =
    listWishlistAlertNotificationCandidates({
      wishlistPriceAlerts: wishlistAlerts,
    });
  const newWishlistAlertCount = wantedSetCards.filter((catalogSetCard) =>
    isWishlistAlertNotificationCandidateNew({
      lastViewedAt:
        userSession.notificationPreferences.wishlistAlertsLastViewedAt,
      wishlistAlertNotificationCandidate:
        wishlistAlertNotificationCandidates[catalogSetCard.id],
    }),
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

      setStatusMessage(`${name} is naar je collectie verplaatst.`);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        readActionErrorMessage(
          error,
          'Deze set kon nu niet naar je collectie worden verplaatst.',
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

      setStatusMessage(`${name} is van je verlanglijst verwijderd.`);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        readActionErrorMessage(
          error,
          'Je verlanglijst kon nu niet worden bijgewerkt.',
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
            {wantedSetCards.length} opgeslagen
            {activeWishlistAlertCount > 0
              ? ` · ${activeWishlistAlertCount} koopsignaal${
                  activeWishlistAlertCount === 1 ? '' : 's'
                } nu actief`
              : ''}
            {newWishlistAlertCount > 0
              ? ` · ${newWishlistAlertCount} nieuw sinds je laatste check`
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
        const pricePanelSnapshot = getPricePanelSnapshot(catalogSetCard.id);
        const reviewedPriceSummary = getReviewedPriceSummary(catalogSetCard.id);
        const wishlistAlert = wishlistAlerts[catalogSetCard.id];
        const isNewWishlistAlert = isWishlistAlertNotificationCandidateNew({
          lastViewedAt:
            userSession.notificationPreferences.wishlistAlertsLastViewedAt,
          wishlistAlertNotificationCandidate:
            wishlistAlertNotificationCandidates[catalogSetCard.id],
        });

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
                  Verplaats naar collectie
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
                  Verwijder
                </Button>
              </div>
            }
            contextBadge={toWishlistContextBadge({
              isNew: isNewWishlistAlert,
              wishlistAlert,
            })}
            href={buildSetDetailPath(catalogSetCard.slug)}
            key={catalogSetCard.id}
            priceContext={toWishlistPriceContext({
              pricePanelSnapshot,
              priceSummary: reviewedPriceSummary,
              theme: catalogSetCard.theme,
            })}
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
