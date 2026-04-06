'use client';

import { useEffect, useState } from 'react';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
import {
  addWantedSet,
  getWantedSetContext,
  removeWantedSet,
} from '@lego-platform/wishlist/data-access';
import { WantedSetToggleCard } from '@lego-platform/wishlist/ui';
import { WantedSetState } from '@lego-platform/wishlist/util';

export function WishlistFeatureWishlistToggle({
  productIntent = 'wishlist',
  setId,
  variant = 'default',
}: {
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
        ? 'Je volgt nu de prijs van deze set.'
        : 'Brickhunt volgt deze prijs niet meer.';
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

    if (!isAuthenticated) {
      window.location.assign(buildWebPath(webPathnames.account));
      return;
    }

    setIsPending(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);
    const nextAction = wantedSetState.isWanted ? 'remove' : 'add';

    try {
      const nextWantedSetState = wantedSetState.isWanted
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
