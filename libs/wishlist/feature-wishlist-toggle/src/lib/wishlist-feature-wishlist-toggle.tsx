'use client';

import { useEffect, useState } from 'react';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
import {
  trackBrickhuntAnalyticsEvent,
  type BrickhuntAnalyticsProperties,
} from '@lego-platform/shared/util';
import {
  addWantedSet,
  addLocalFollowedPriceSet,
  getWantedSetContext,
  removeLocalFollowedPriceSet,
  removeWantedSet,
} from '@lego-platform/wishlist/data-access';
import { WantedSetToggleCard } from '@lego-platform/wishlist/ui';
import { WantedSetState } from '@lego-platform/wishlist/util';

export function WishlistFeatureWishlistToggle({
  analyticsContext,
  productIntent = 'wishlist',
  setId,
  variant = 'default',
}: {
  analyticsContext?: BrickhuntAnalyticsProperties;
  productIntent?: 'price-alert' | 'wishlist';
  setId: string;
  variant?: 'default' | 'inline' | 'product';
}) {
  const [wantedSetState, setWantedSetState] = useState<WantedSetState>();
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [followedSetCount, setFollowedSetCount] = useState<number>();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  function getSuccessStateMessage(nextIsWanted: boolean) {
    if (productIntent === 'price-alert') {
      return nextIsWanted
        ? 'Brickhunt houdt deze set nu voor je in de gaten.'
        : 'Brickhunt houdt deze set niet meer voor je in de gaten.';
    }

    return nextIsWanted
      ? 'Deze set staat nu op je verlanglijst.'
      : 'Deze set staat niet meer op je verlanglijst.';
  }

  function getToggleErrorMessage(error: unknown, nextAction: 'add' | 'remove') {
    if (productIntent === 'price-alert') {
      if (error instanceof Error && error.message.startsWith('Log in om')) {
        return nextAction === 'add'
          ? 'Log in om deze prijs te volgen.'
          : 'Log in om je gevolgde prijs bij te werken.';
      }

      return nextAction === 'add'
        ? 'Deze prijs kon nu niet worden gevolgd.'
        : 'Deze prijs kon nu niet meer worden gevolgd.';
    }

    return error instanceof Error
      ? error.message
      : 'Je verlanglijst kon nu niet worden bijgewerkt.';
  }

  useEffect(() => {
    let isMounted = true;

    async function loadWantedSetState() {
      try {
        const wantedSetContext = await getWantedSetContext(setId);

        if (!isMounted) {
          return;
        }

        setWantedSetState(wantedSetContext.wantedSetState);
        setIsAuthenticated(wantedSetContext.isAuthenticated);
        setFollowedSetCount(wantedSetContext.wantedCount);
        setAlertsEnabled(wantedSetContext.alertsEnabled);
        setErrorMessage(undefined);
        setSuccessMessage(undefined);
      } catch {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          productIntent === 'price-alert'
            ? 'We konden niet controleren of Brickhunt deze prijs al volgt.'
            : 'De verlanglijststatus voor deze set kon niet worden geladen.',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadWantedSetState();
    const unsubscribe = subscribeToSupabaseAuthChanges(() => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      setSuccessMessage(undefined);
      void loadWantedSetState();
    });
    const unsubscribeAccount = subscribeToBrowserAccountDataChanges(() => {
      if (!isMounted) {
        return;
      }

      void loadWantedSetState();
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeAccount();
    };
  }, [productIntent, setId]);

  async function handleToggleWantedState() {
    if (!wantedSetState || isPending) {
      return;
    }

    const nextAction = wantedSetState.isWanted ? 'remove' : 'add';

    if (!isAuthenticated) {
      if (productIntent !== 'price-alert') {
        window.location.assign(buildWebPath(webPathnames.account));
        return;
      }

      setIsPending(true);
      setErrorMessage(undefined);
      setSuccessMessage(undefined);

      if (nextAction === 'add') {
        trackBrickhuntAnalyticsEvent({
          event: 'follow_price_click',
          properties: {
            ...analyticsContext,
            signedIn: false,
          },
        });
        trackBrickhuntAnalyticsEvent({
          event: 'follow_price_logged_out',
          properties: {
            ...analyticsContext,
            signedIn: false,
          },
        });
      }

      try {
        const nextWantedSetState =
          nextAction === 'add'
            ? addLocalFollowedPriceSet(setId)
            : removeLocalFollowedPriceSet(setId);
        const countDelta =
          nextWantedSetState.isWanted === wantedSetState.isWanted
            ? 0
            : nextWantedSetState.isWanted
              ? 1
              : -1;
        const nextFollowedSetCount =
          typeof followedSetCount === 'number'
            ? Math.max(0, followedSetCount + countDelta)
            : nextWantedSetState.isWanted
              ? 1
              : 0;

        setWantedSetState(nextWantedSetState);
        setFollowedSetCount(nextFollowedSetCount);
        setSuccessMessage(getSuccessStateMessage(nextWantedSetState.isWanted));

        if (nextAction === 'add' && nextWantedSetState.isWanted) {
          trackBrickhuntAnalyticsEvent({
            event: 'follow_price_success',
            properties: {
              ...analyticsContext,
              followedSetCount: nextFollowedSetCount,
              signedIn: false,
            },
          });
        }
      } catch (error) {
        setErrorMessage(getToggleErrorMessage(error, nextAction));
      } finally {
        setIsPending(false);
      }

      return;
    }

    setIsPending(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    if (productIntent === 'price-alert' && nextAction === 'add') {
      trackBrickhuntAnalyticsEvent({
        event: 'follow_price_click',
        properties: {
          ...analyticsContext,
          signedIn: true,
        },
      });
    }

    try {
      const nextWantedSetState =
        nextAction === 'remove'
          ? await removeWantedSet(setId)
          : await addWantedSet(setId);
      const countDelta =
        nextWantedSetState.isWanted === wantedSetState.isWanted
          ? 0
          : nextWantedSetState.isWanted
            ? 1
            : -1;

      setWantedSetState(nextWantedSetState);
      setFollowedSetCount((currentFollowedSetCount) =>
        typeof currentFollowedSetCount === 'number'
          ? Math.max(0, currentFollowedSetCount + countDelta)
          : currentFollowedSetCount,
      );
      setSuccessMessage(getSuccessStateMessage(nextWantedSetState.isWanted));

      if (
        productIntent === 'price-alert' &&
        nextAction === 'add' &&
        nextWantedSetState.isWanted
      ) {
        trackBrickhuntAnalyticsEvent({
          event: 'follow_price_success',
          properties: {
            ...analyticsContext,
            followedSetCount:
              typeof followedSetCount === 'number'
                ? Math.max(0, followedSetCount + countDelta)
                : undefined,
            signedIn: true,
          },
        });
      }
    } catch (error) {
      setErrorMessage(getToggleErrorMessage(error, nextAction));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <WantedSetToggleCard
      errorMessage={errorMessage}
      alertsEnabled={alertsEnabled}
      analyticsContext={analyticsContext}
      followedSetCount={followedSetCount}
      hasResolvedState={Boolean(wantedSetState)}
      isAuthenticated={isAuthenticated}
      isLoading={isLoading}
      isPending={isPending}
      isWanted={wantedSetState?.isWanted ?? false}
      setId={setId}
      successMessage={successMessage}
      productIntent={productIntent}
      variant={variant}
      onToggle={handleToggleWantedState}
    />
  );
}

export default WishlistFeatureWishlistToggle;
