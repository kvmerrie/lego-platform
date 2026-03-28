'use client';

import { useEffect, useState } from 'react';
import {
  addWantedSet,
  getWantedSetState,
  removeWantedSet,
} from '@lego-platform/wishlist/data-access';
import { WantedSetToggleCard } from '@lego-platform/wishlist/ui';
import { WantedSetState } from '@lego-platform/wishlist/util';

export function WishlistFeatureWishlistToggle({ setId }: { setId: string }) {
  const [wantedSetState, setWantedSetState] = useState<WantedSetState>();
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

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
      } catch {
        if (!isMounted) {
          return;
        }

        setErrorMessage('Unable to load the wanted state for this set.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadWantedSetState();

    return () => {
      isMounted = false;
    };
  }, [setId]);

  async function handleToggleWantedState() {
    if (!wantedSetState || isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(undefined);

    try {
      const nextWantedSetState = wantedSetState.isWanted
        ? await removeWantedSet(setId)
        : await addWantedSet(setId);

      setWantedSetState(nextWantedSetState);
    } catch {
      setErrorMessage('Unable to save the wanted state right now.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <WantedSetToggleCard
      errorMessage={errorMessage}
      isLoading={isLoading}
      isPending={isPending}
      isWanted={wantedSetState?.isWanted ?? false}
      setId={setId}
      onToggle={handleToggleWantedState}
    />
  );
}

export default WishlistFeatureWishlistToggle;
