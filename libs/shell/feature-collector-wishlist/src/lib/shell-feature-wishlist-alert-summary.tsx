'use client';

import { useEffect, useRef, useState } from 'react';
import {
  listWishlistAlertNotificationCandidates,
  listWishlistPriceAlerts,
  summarizeNewWishlistAlertCandidates,
  summarizeWishlistPriceAlerts,
  type WishlistNewAlertSummary,
  type WishlistPriceAlertSummary,
} from '@lego-platform/pricing/data-access';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import { ActionLink, SectionHeading, Surface } from '@lego-platform/shared/ui';
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

function getWishlistAlertDetail(
  wishlistAlertSummary: WishlistPriceAlertSummary,
): string {
  if (wishlistAlertSummary.newBestPriceCount > 0) {
    return `${wishlistAlertSummary.newBestPriceCount} op een nieuwe beste reviewed prijs.`;
  }

  if (wishlistAlertSummary.priceImprovedSinceSaveCount > 0) {
    return `${wishlistAlertSummary.priceImprovedSinceSaveCount} lager dan toen je ${wishlistAlertSummary.priceImprovedSinceSaveCount === 1 ? 'die set' : 'ze'} opsloeg.`;
  }

  return `${wishlistAlertSummary.strongDealCount} gemarkeerd als sterke deal op dit moment.`;
}

function getNewWishlistAlertDetail(
  wishlistNewAlertSummary: WishlistNewAlertSummary,
): string {
  if (wishlistNewAlertSummary.newBestPriceCount > 0) {
    return `${wishlistNewAlertSummary.newBestPriceCount} op een nieuwe beste reviewed prijs sinds je laatste check.`;
  }

  if (wishlistNewAlertSummary.priceImprovedSinceSaveCount > 0) {
    return `${wishlistNewAlertSummary.priceImprovedSinceSaveCount} lager dan bij je laatste check.`;
  }

  return `${wishlistNewAlertSummary.strongDealCount} gemarkeerd als sterke deal sinds je laatste check.`;
}

export function ShellFeatureWishlistAlertSummary() {
  const [userSession, setUserSession] = useState<UserSession>(
    createAnonymousUserSession(),
  );
  const [wishlistAlertSummary, setWishlistAlertSummary] =
    useState<WishlistPriceAlertSummary>();
  const [wishlistNewAlertSummary, setWishlistNewAlertSummary] =
    useState<WishlistNewAlertSummary>();
  const isMountedRef = useRef(true);
  const hasMarkedViewedRef = useRef(false);

  async function loadUserSession() {
    try {
      const nextUserSession = await getUserSession();

      if (!isMountedRef.current) {
        return;
      }

      setUserSession(nextUserSession);
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      setUserSession(createAnonymousUserSession());
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    void loadUserSession();

    const unsubscribeAuth = subscribeToUserAuthChanges(() => {
      if (!isMountedRef.current) {
        return;
      }

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
      setWishlistAlertSummary(undefined);
      setWishlistNewAlertSummary(undefined);
      hasMarkedViewedRef.current = false;
      return;
    }

    if (
      !userSession.notificationPreferences.wishlistDealAlerts ||
      userSession.wantedSetIds.length === 0
    ) {
      setWishlistAlertSummary(undefined);
      setWishlistNewAlertSummary(undefined);
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
      .then((wishlistPriceAlerts) => {
        if (isCancelled || !isMountedRef.current) {
          return;
        }

        const wishlistAlertNotificationCandidates =
          listWishlistAlertNotificationCandidates({
            wishlistPriceAlerts,
          });

        setWishlistAlertSummary(
          summarizeWishlistPriceAlerts(wishlistPriceAlerts),
        );
        setWishlistNewAlertSummary(
          summarizeNewWishlistAlertCandidates({
            lastViewedAt:
              userSession.notificationPreferences.wishlistAlertsLastViewedAt,
            wishlistAlertNotificationCandidates,
          }),
        );
      })
      .catch(() => {
        if (isCancelled || !isMountedRef.current) {
          return;
        }

        setWishlistAlertSummary(undefined);
        setWishlistNewAlertSummary(undefined);
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

  if (!isAuthenticatedSession(userSession) || !wishlistAlertSummary) {
    return null;
  }

  return (
    <Surface
      as="section"
      className={styles.alertSummary}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading
        description={`${wishlistAlertSummary.activeCount} set${
          wishlistAlertSummary.activeCount === 1 ? '' : 's'
        } op je verlanglijst hebben nu een actief koopsignaal.`}
        eyebrow="Verlanglijstsignalen"
        title={
          wishlistNewAlertSummary
            ? `${wishlistNewAlertSummary.newCount} nieuwe dealupdate${
                wishlistNewAlertSummary.newCount === 1 ? '' : 's'
              }`
            : 'Goed moment om je verlanglijst te checken'
        }
        titleAs="h2"
      />
      <p className={styles.alertSummaryMeta}>
        {wishlistNewAlertSummary
          ? getNewWishlistAlertDetail(wishlistNewAlertSummary)
          : getWishlistAlertDetail(wishlistAlertSummary)}
      </p>
      <div className={styles.alertSummaryActions}>
        <ActionLink href={buildWebPath(webPathnames.wishlist)} tone="secondary">
          Bekijk signalen op je verlanglijst
        </ActionLink>
      </div>
    </Surface>
  );
}

export default ShellFeatureWishlistAlertSummary;
