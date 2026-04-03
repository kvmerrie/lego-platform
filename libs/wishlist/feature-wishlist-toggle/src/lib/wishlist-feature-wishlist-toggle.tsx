'use client';

import { useEffect, useState } from 'react';
import {
  addWantedSet,
  getWantedSetState,
  removeWantedSet,
} from '@lego-platform/wishlist/data-access';
import {
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
import { WantedSetToggleCard } from '@lego-platform/wishlist/ui';
import { WantedSetState } from '@lego-platform/wishlist/util';

export function WishlistFeatureWishlistToggle({
  setId,
  variant = 'default',
}: {
  setId: string;
  variant?: 'default' | 'product';
}) {
  const [wantedSetState, setWantedSetState] = useState<WantedSetState>();
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    async function loadWantedSetState() {
      try {
        const nextWantedSetState = await getWantedSetState(setId);

        if (!isMounted) {
          return;
        }

        setWantedSetState(nextWantedSetState);
        setErrorMessage(undefined);
        setSuccessMessage(undefined);
      } catch {
        if (!isMounted) {
          return;
        }

        setErrorMessage('Unable to load the wishlist state for this set.');
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
  }, [setId]);

  async function handleToggleWantedState() {
    if (!wantedSetState || isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const nextWantedSetState = wantedSetState.isWanted
        ? await removeWantedSet(setId)
        : await addWantedSet(setId);

      setWantedSetState(nextWantedSetState);
      setSuccessMessage(
        nextWantedSetState.isWanted
          ? 'Added to your wishlist. Your collector account is up to date.'
          : 'Removed from your wishlist. Your collector account is up to date.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update your wishlist right now.',
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <WantedSetToggleCard
      errorMessage={errorMessage}
      hasResolvedState={Boolean(wantedSetState)}
      isLoading={isLoading}
      isPending={isPending}
      isWanted={wantedSetState?.isWanted ?? false}
      setId={setId}
      successMessage={successMessage}
      variant={variant}
      onToggle={handleToggleWantedState}
    />
  );
}

export default WishlistFeatureWishlistToggle;
