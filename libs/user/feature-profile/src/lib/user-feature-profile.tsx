'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createCollectorProfileDraft,
  type CollectorProfile,
  type UpdateCollectorProfileInput,
} from '@lego-platform/user/util';
import {
  getCurrentUserProfile,
  subscribeToUserAuthChanges,
  updateCurrentUserProfile,
} from '@lego-platform/user/data-access';
import { UserProfileEditorCard } from '@lego-platform/user/ui';

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function UserFeatureProfile() {
  const [collectorProfile, setCollectorProfile] =
    useState<CollectorProfile | null>(null);
  const [draft, setDraft] = useState<UpdateCollectorProfileInput>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const isMountedRef = useRef(true);

  async function loadCollectorProfile() {
    try {
      const nextCollectorProfile = await getCurrentUserProfile();

      if (!isMountedRef.current) {
        return;
      }

      setCollectorProfile(nextCollectorProfile);
      setDraft(
        nextCollectorProfile
          ? createCollectorProfileDraft(nextCollectorProfile)
          : undefined,
      );
      setErrorMessage(undefined);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setCollectorProfile(null);
      setDraft(undefined);
      setErrorMessage(
        readErrorMessage(
          error,
          'Unable to load the current collector profile right now.',
        ),
      );
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    void loadCollectorProfile();
    const unsubscribe = subscribeToUserAuthChanges(() => {
      if (!isMountedRef.current) {
        return;
      }

      setIsLoading(true);
      setSuccessMessage(undefined);
      void loadCollectorProfile();
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    if (!draft) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(undefined);
    setSuccessMessage(undefined);

    try {
      const updatedCollectorProfile = await updateCurrentUserProfile(draft);

      if (!isMountedRef.current) {
        return;
      }

      setCollectorProfile(updatedCollectorProfile);
      setDraft(createCollectorProfileDraft(updatedCollectorProfile));
      setSuccessMessage(
        'Collector profile saved. Your collector card and saved account surfaces now reflect the updated details.',
      );
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        readErrorMessage(
          error,
          'Unable to save the collector profile right now.',
        ),
      );
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  if (!isLoading && !collectorProfile && !errorMessage) {
    return null;
  }

  return (
    <UserProfileEditorCard
      collectorProfile={collectorProfile ?? undefined}
      draft={draft}
      errorMessage={errorMessage}
      isDirty={
        collectorProfile && draft
          ? JSON.stringify(draft) !==
            JSON.stringify(createCollectorProfileDraft(collectorProfile))
          : false
      }
      isLoading={isLoading}
      isSaving={isSaving}
      onDraftChange={(field, value) => {
        setDraft((currentDraft) => {
          if (!currentDraft) {
            return currentDraft;
          }

          return {
            ...currentDraft,
            [field]: value,
          };
        });
        setErrorMessage(undefined);
        setSuccessMessage(undefined);
      }}
      onSubmit={handleSubmit}
      successMessage={successMessage}
    />
  );
}

export default UserFeatureProfile;
