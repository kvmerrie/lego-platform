'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  getCatalogSetReviewsForBrowser,
  upsertCatalogSetReviewForBrowser,
} from '@lego-platform/reviews/data-access';
import { ProductReviewsSection } from '@lego-platform/reviews/ui';
import type {
  CatalogSetReviewInput,
  CatalogSetReviewsPayload,
} from '@lego-platform/reviews/util';
import { buildSetDetailPath, webPathnames } from '@lego-platform/shared/config';
import {
  getUserSession,
  subscribeToUserAccountChanges,
  subscribeToUserAuthChanges,
} from '@lego-platform/user/data-access';
import { isAuthenticatedSession } from '@lego-platform/user/util';

export function buildReviewsAccountHref(returnPath: string): string {
  const searchParams = new URLSearchParams({
    next: returnPath,
  });

  return `${webPathnames.account}?${searchParams.toString()}`;
}

export function ReviewsFeatureSetReviews({
  initialPayload,
  setId,
  setSlug,
}: {
  initialPayload: CatalogSetReviewsPayload;
  setId: string;
  setSlug: string;
}) {
  const [payload, setPayload] =
    useState<CatalogSetReviewsPayload>(initialPayload);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const returnPath = `${buildSetDetailPath(setSlug)}#productbeoordelingen`;
  const accountHref = useMemo(
    () => buildReviewsAccountHref(returnPath),
    [returnPath],
  );

  useEffect(() => {
    let isActive = true;

    async function loadReviewSession() {
      setIsAuthLoading(true);
      setError(undefined);

      try {
        const userSession = await getUserSession();

        if (!isActive) {
          return;
        }

        const nextIsAuthenticated = isAuthenticatedSession(userSession);
        setIsAuthenticated(nextIsAuthenticated);

        if (!nextIsAuthenticated) {
          setPayload(initialPayload);
          return;
        }
      } catch {
        if (isActive) {
          setIsAuthenticated(false);
          setPayload(initialPayload);
        }
        return;
      } finally {
        if (isActive) {
          setIsAuthLoading(false);
        }
      }

      try {
        const nextPayload = await getCatalogSetReviewsForBrowser(setId);

        if (isActive) {
          setPayload(nextPayload);
        }
      } catch {
        if (isActive) {
          setError(
            'Je bent ingelogd, maar je beoordeling kon nu niet worden geladen.',
          );
        }
      }
    }

    void loadReviewSession();

    const unsubscribeAuth = subscribeToUserAuthChanges(() => {
      void loadReviewSession();
    });
    const unsubscribeAccount = subscribeToUserAccountChanges(() => {
      void loadReviewSession();
    });

    return () => {
      isActive = false;
      unsubscribeAuth();
      unsubscribeAccount();
    };
  }, [initialPayload, setId]);

  function handleStartReview() {
    if (!isAuthenticated) {
      setIsAuthPromptOpen(true);
    }
  }

  async function handleReviewSubmit(input: CatalogSetReviewInput) {
    if (!isAuthenticated) {
      setIsAuthPromptOpen(true);
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      setPayload(await upsertCatalogSetReviewForBrowser(setId, input));
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Je beoordeling kon niet worden opgeslagen.';

      if (message.toLowerCase().startsWith('log in')) {
        setIsAuthPromptOpen(true);
      } else {
        setError(message);
      }

      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ProductReviewsSection
      accountHref={accountHref}
      canReview={isAuthenticated}
      error={error}
      isAuthPromptOpen={isAuthPromptOpen}
      isAuthLoading={isAuthLoading}
      isSubmitting={isSubmitting}
      onAuthPromptClose={() => setIsAuthPromptOpen(false)}
      onReviewSubmit={handleReviewSubmit}
      onStartReview={handleStartReview}
      ownReview={payload.ownReview}
      reviews={payload.reviews}
      summary={payload.summary}
    />
  );
}
