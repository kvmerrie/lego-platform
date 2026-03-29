'use client';

import { useEffect, useState } from 'react';
import {
  addOwnedSet,
  getOwnedSetState,
  removeOwnedSet,
} from '@lego-platform/collection/data-access';
import { subscribeToSupabaseAuthChanges } from '@lego-platform/shared/data-access-auth';
import { OwnedSetToggleCard } from '@lego-platform/collection/ui';
import { OwnedSetState } from '@lego-platform/collection/util';

export function CollectionFeatureOwnedToggle({ setId }: { setId: string }) {
  const [ownedSetState, setOwnedSetState] = useState<OwnedSetState>();
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    async function loadOwnedSetState() {
      try {
        const nextOwnedSetState = await getOwnedSetState(setId);

        if (!isMounted) {
          return;
        }

        setOwnedSetState(nextOwnedSetState);
        setErrorMessage(undefined);
      } catch {
        if (!isMounted) {
          return;
        }

        setErrorMessage('Unable to load the owned state for this set.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOwnedSetState();
    const unsubscribe = subscribeToSupabaseAuthChanges(() => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      void loadOwnedSetState();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [setId]);

  async function handleToggleOwnedState() {
    if (!ownedSetState || isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(undefined);

    try {
      const nextOwnedSetState = ownedSetState.isOwned
        ? await removeOwnedSet(setId)
        : await addOwnedSet(setId);

      setOwnedSetState(nextOwnedSetState);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save the owned state right now.',
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <OwnedSetToggleCard
      errorMessage={errorMessage}
      hasResolvedState={Boolean(ownedSetState)}
      isLoading={isLoading}
      isOwned={ownedSetState?.isOwned ?? false}
      isPending={isPending}
      setId={setId}
      onToggle={handleToggleOwnedState}
    />
  );
}

export default CollectionFeatureOwnedToggle;
