'use client';

import { useEffect, useRef, useState } from 'react';
import {
  listWishlistPriceAlerts,
  summarizeWishlistPriceAlerts,
  type WishlistPriceAlertSummary,
} from '@lego-platform/pricing/data-access';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import { ActionLink, SectionHeading, Surface } from '@lego-platform/shared/ui';
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

function getWishlistAlertDetail(
  wishlistAlertSummary: WishlistPriceAlertSummary,
): string {
  if (wishlistAlertSummary.newBestPriceCount > 0) {
    return `${wishlistAlertSummary.newBestPriceCount} at a new best reviewed price.`;
  }

  if (wishlistAlertSummary.priceImprovedSinceSaveCount > 0) {
    return `${wishlistAlertSummary.priceImprovedSinceSaveCount} lower than when you saved ${
      wishlistAlertSummary.priceImprovedSinceSaveCount === 1 ? 'it' : 'them'
    }.`;
  }

  return `${wishlistAlertSummary.strongDealCount} marked as a strong deal right now.`;
}

export function ShellFeatureWishlistAlertSummary() {
  const [userSession, setUserSession] = useState<UserSession>(
    createAnonymousUserSession(),
  );
  const [wishlistAlertSummary, setWishlistAlertSummary] =
    useState<WishlistPriceAlertSummary>();
  const isMountedRef = useRef(true);

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
      return;
    }

    if (
      !userSession.notificationPreferences.wishlistDealAlerts ||
      userSession.wantedSetIds.length === 0
    ) {
      setWishlistAlertSummary(undefined);
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

        setWishlistAlertSummary(
          summarizeWishlistPriceAlerts(wishlistPriceAlerts),
        );
      })
      .catch(() => {
        if (isCancelled || !isMountedRef.current) {
          return;
        }

        setWishlistAlertSummary(undefined);
      });

    return () => {
      isCancelled = true;
    };
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
        description={`${wishlistAlertSummary.activeCount} wishlist set${
          wishlistAlertSummary.activeCount === 1 ? '' : 's'
        } have a live buy signal right now.`}
        eyebrow="Wishlist signals"
        title="Good time to check your wishlist"
        titleAs="h2"
      />
      <p className={styles.alertSummaryMeta}>
        {getWishlistAlertDetail(wishlistAlertSummary)}
      </p>
      <div className={styles.alertSummaryActions}>
        <ActionLink href={buildWebPath(webPathnames.wishlist)} tone="secondary">
          Review wishlist signals
        </ActionLink>
      </div>
    </Surface>
  );
}

export default ShellFeatureWishlistAlertSummary;
