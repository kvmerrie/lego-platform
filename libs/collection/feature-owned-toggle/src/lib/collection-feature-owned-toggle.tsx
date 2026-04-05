'use client';

import { useEffect, useState } from 'react';
import {
  addOwnedSet,
  getOwnedSetState,
  removeOwnedSet,
} from '@lego-platform/collection/data-access';
import {
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
import { OwnedSetToggleCard } from '@lego-platform/collection/ui';
import { OwnedSetState } from '@lego-platform/collection/util';

export function CollectionFeatureOwnedToggle({
  setId,
  variant = 'default',
}: {
  setId: string;
  variant?: 'compact' | 'default' | 'product';
}) {
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

        setErrorMessage(
          'De collectiestatus voor deze set kon niet worden geladen.',
        );
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
    const unsubscribeAccount = subscribeToBrowserAccountDataChanges(() => {
      if (!isMounted) {
        return;
      }

      void loadOwnedSetState();
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeAccount();
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
          ? 'Gemarkeerd als in collectie. Je account is bijgewerkt.'
          : 'Verwijderd uit je collectie. Je account is bijgewerkt.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Je collectie kon nu niet worden bijgewerkt.',
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
      variant={variant}
      onToggle={handleToggleOwnedState}
    />
  );
}

export default CollectionFeatureOwnedToggle;
