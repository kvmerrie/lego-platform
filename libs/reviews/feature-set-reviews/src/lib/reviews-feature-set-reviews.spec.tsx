/** @vitest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogSetReviewsPayload } from '@lego-platform/reviews/util';
import {
  buildReviewsAccountHref,
  ReviewsFeatureSetReviews,
} from './reviews-feature-set-reviews';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const reviewsDataAccessMocks = vi.hoisted(() => ({
  getCatalogSetReviewsForBrowser: vi.fn(),
  upsertCatalogSetReviewForBrowser: vi.fn(),
}));

const userDataAccessMocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  subscribeToUserAccountChanges: vi.fn(),
  subscribeToUserAuthChanges: vi.fn(),
}));

vi.mock('@lego-platform/reviews/data-access', () => reviewsDataAccessMocks);
vi.mock('@lego-platform/user/data-access', () => userDataAccessMocks);

const emptyPayload: CatalogSetReviewsPayload = {
  reviews: [],
  summary: {
    averageRating: undefined,
    ratingDistribution: {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    },
    recommendCount: 0,
    reviewCount: 0,
    setId: '21066',
  },
};

const pendingOwnReviewPayload: CatalogSetReviewsPayload = {
  ...emptyPayload,
  ownReview: {
    authorDisplayName: 'Brickhunt-gebruiker',
    createdAt: '2026-06-10T10:00:00.000Z',
    id: 'review-1',
    moderationStatus: 'pending',
    overallRating: 4,
    recommends: true,
    reviewText: 'Sterke skyline, vooral op een plank.',
    setId: '21066',
    updatedAt: '2026-06-10T10:00:00.000Z',
  },
};

const anonymousSession = {
  state: 'anonymous',
  ownedSetIds: [],
  setStates: [],
  wantedSetIds: [],
};

const authenticatedSession = {
  state: 'authenticated',
  account: {
    email: 'collector@example.com',
    userId: 'user-1',
  },
  collector: {
    collectionFocus: 'Architecture',
    id: 'collector',
    location: 'Amsterdam',
    name: 'Collector',
    tier: 'Collector',
  },
  notificationPreferences: {
    wishlistDealAlerts: false,
  },
  ownedSetIds: [],
  setStates: [],
  wantedSetIds: [],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('ReviewsFeatureSetReviews', () => {
  let container: HTMLDivElement;
  let root: Root;
  let authChangeListener: (() => void) | undefined;

  async function renderReviewsFeature(
    initialPayload: CatalogSetReviewsPayload = emptyPayload,
  ) {
    await act(async () => {
      root.render(
        <ReviewsFeatureSetReviews
          initialPayload={initialPayload}
          setId="21066"
          setSlug="new-york-city-the-big-apple-21066"
        />,
      );
    });
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    authChangeListener = undefined;

    reviewsDataAccessMocks.getCatalogSetReviewsForBrowser.mockResolvedValue(
      emptyPayload,
    );
    userDataAccessMocks.subscribeToUserAccountChanges.mockReturnValue(
      () => undefined,
    );
    userDataAccessMocks.subscribeToUserAuthChanges.mockImplementation(
      (listener: () => void) => {
        authChangeListener = listener;

        return () => undefined;
      },
    );
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('builds the anonymous account URL with an encoded set-detail anchor', () => {
    expect(
      buildReviewsAccountHref(
        '/sets/new-york-city-the-big-apple-21066#productbeoordelingen',
      ),
    ).toBe(
      '/account?next=%2Fsets%2Fnew-york-city-the-big-apple-21066%23productbeoordelingen',
    );
  });

  it('shows the anonymous prompt after an anonymous session loads', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(anonymousSession);

    await renderReviewsFeature();

    expect(container.textContent).toContain('Recensie toevoegen');
    expect(container.textContent).not.toContain('Reviewtekst');
  });

  it('changes from anonymous to authenticated review actions when auth state reloads after mount', async () => {
    userDataAccessMocks.getUserSession
      .mockResolvedValueOnce(anonymousSession)
      .mockResolvedValueOnce(authenticatedSession);

    await renderReviewsFeature();

    expect(container.textContent).toContain('Recensie toevoegen');
    expect(container.textContent).not.toContain('Reviewtekst');

    await act(async () => {
      authChangeListener?.();
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Reviewtekst');
  });

  it('shows the review editor after a login redirect with an authenticated session', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);

    await renderReviewsFeature();

    expect(container.textContent).toContain('Recensie toevoegen');
    expect(container.textContent).not.toContain('Reviewtekst');

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Reviewtekst');
  });

  it('keeps showing the anonymous prompt when no session is available', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(anonymousSession);

    await renderReviewsFeature();

    expect(container.textContent).toContain('Recensie toevoegen');
    expect(
      reviewsDataAccessMocks.getCatalogSetReviewsForBrowser,
    ).not.toHaveBeenCalled();
  });

  it('loads the signed-in collector own pending review', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);
    reviewsDataAccessMocks.getCatalogSetReviewsForBrowser.mockResolvedValue(
      pendingOwnReviewPayload,
    );

    await renderReviewsFeature();

    expect(container.textContent).toContain('Recensie bewerken');
    expect(container.textContent).toContain('Jouw recensie');
    expect(container.textContent).toContain('In controle');
    expect(
      reviewsDataAccessMocks.getCatalogSetReviewsForBrowser,
    ).toHaveBeenCalledWith('21066');
  });

  it('keeps authenticated review UI when the signed-in payload fetch fails', async () => {
    userDataAccessMocks.getUserSession.mockResolvedValue(authenticatedSession);
    reviewsDataAccessMocks.getCatalogSetReviewsForBrowser.mockRejectedValue(
      new Error('missing bearer token'),
    );

    await renderReviewsFeature();

    expect(container.textContent).toContain('Recensie toevoegen');
    expect(container.textContent).toContain(
      'Je bent ingelogd, maar je beoordeling kon nu niet worden geladen.',
    );
  });

  it('shows an account-check loading state while the browser session is still resolving', async () => {
    const sessionRequest = createDeferred<typeof authenticatedSession>();
    userDataAccessMocks.getUserSession.mockReturnValue(sessionRequest.promise);

    await renderReviewsFeature();

    expect(container.textContent).toContain('We controleren je account.');
    expect(container.textContent).not.toContain('Inloggen om te beoordelen');

    await act(async () => {
      sessionRequest.resolve(authenticatedSession);
    });

    expect(container.textContent).toContain('Recensie toevoegen');
  });
});
