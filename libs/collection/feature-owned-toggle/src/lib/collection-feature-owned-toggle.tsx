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
  const [successMessage, setSuccessMessage] = useState<string>();

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
        setSuccessMessage(undefined);
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
      setSuccessMessage(undefined);
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
    setSuccessMessage(undefined);

    try {
      const nextOwnedSetState = ownedSetState.isOwned
        ? await removeOwnedSet(setId)
        : await addOwnedSet(setId);

      setOwnedSetState(nextOwnedSetState);
      setSuccessMessage(
        nextOwnedSetState.isOwned
          ? 'Saved to your owned collection. Your collector account updated immediately.'
          : 'Removed from owned. Your collector account updated immediately.',
      );
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
      successMessage={successMessage}
      onToggle={handleToggleOwnedState}
    />
  );
}

export default CollectionFeatureOwnedToggle;
