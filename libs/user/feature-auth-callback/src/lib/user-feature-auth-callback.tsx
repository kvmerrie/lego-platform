'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionLink, SectionHeading, Surface } from '@lego-platform/shared/ui';
import { completeUserSignInCallback } from '@lego-platform/user/data-access';

export function UserFeatureAuthCallback() {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    isMountedRef.current = true;

    void completeUserSignInCallback()
      .then(({ nextPath }) => {
        if (!isMountedRef.current) {
          return;
        }

        router.replace(nextPath);
      })
      .catch((error) => {
        if (!isMountedRef.current) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to finish sign-in right now.',
        );
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [router]);

  if (errorMessage) {
    return (
      <Surface as="section" elevation="rested" tone="muted">
        <SectionHeading
          description="The sign-in link opened, but the collector session could not be completed from this browser state."
          eyebrow="Collector account"
          title="Unable to finish sign-in"
          titleAs="h2"
        />
        <p>{errorMessage}</p>
        <ActionLink href="/" tone="secondary">
          Return to the public catalog
        </ActionLink>
      </Surface>
    );
  }

  return (
    <Surface as="section" elevation="rested" tone="muted">
      <SectionHeading
        description="Completing the secure sign-in handoff for your collector account and refreshing your saved collector state."
        eyebrow="Collector account"
        title="Completing sign-in"
        titleAs="h2"
      />
      <p>
        Please keep this tab open for a moment while the collector session is
        confirmed.
      </p>
    </Surface>
  );
}

export default UserFeatureAuthCallback;
