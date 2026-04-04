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
            : 'Inloggen kon nu niet worden afgerond.',
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
          description="De inloglink is geopend, maar de verzamelaarsessie kon vanuit deze browserstatus niet worden voltooid."
          eyebrow="Verzamelaarsaccount"
          title="Inloggen kon niet worden afgerond"
          titleAs="h2"
        />
        <p>{errorMessage}</p>
        <ActionLink href="/" tone="secondary">
          Terug naar de openbare catalogus
        </ActionLink>
      </Surface>
    );
  }

  return (
    <Surface as="section" elevation="rested" tone="muted">
      <SectionHeading
        description="De veilige inlogoverdracht voor je verzamelaarsaccount wordt afgerond en je opgeslagen verzamelstatus wordt vernieuwd."
        eyebrow="Verzamelaarsaccount"
        title="Inloggen wordt afgerond"
        titleAs="h2"
      />
      <p>
        Houd dit tabblad nog even open terwijl de verzamelaarsessie wordt
        bevestigd.
      </p>
    </Surface>
  );
}

export default UserFeatureAuthCallback;
