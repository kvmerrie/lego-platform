/** @vitest-environment jsdom */

import React from 'react';
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CatalogSetReview,
  CatalogSetReviewSummary,
} from '@lego-platform/reviews/util';
import { ProductReviewsSection } from './product-reviews-section';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const emptySummary: CatalogSetReviewSummary = {
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
};

const reviewedSummary: CatalogSetReviewSummary = {
  averageRating: 4.8,
  averageBuildExperienceRating: 4.7,
  averagePlayExperienceRating: 4.6,
  averageValueForMoneyRating: 4.3,
  ratingDistribution: {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 1,
    '5': 4,
  },
  recommendCount: 5,
  reviewCount: 5,
  setId: '21066',
};

const approvedReview: CatalogSetReview = {
  authorDisplayName: 'Brickhunt-gebruiker',
  buildExperienceRating: 4,
  createdAt: '2026-06-10T10:00:00.000Z',
  id: 'review-1',
  moderationStatus: 'approved',
  overallRating: 5,
  playExperienceRating: 5,
  recommends: true,
  reviewText: 'De skyline blijft sterk op een plank.',
  setId: '21066',
  updatedAt: '2026-06-10T10:00:00.000Z',
  valueForMoneyRating: 3,
};

const pendingOwnReview: CatalogSetReview = {
  authorDisplayName: 'Brickhunt-gebruiker',
  buildExperienceRating: 4,
  createdAt: '2026-06-10T10:00:00.000Z',
  id: 'review-own',
  moderationStatus: 'pending',
  overallRating: 4,
  playExperienceRating: null,
  recommends: true,
  reviewText: 'Mooie skyline voor op een plank.',
  setId: '21066',
  updatedAt: '2026-06-10T10:00:00.000Z',
  valueForMoneyRating: null,
};

function renderProductReviewsSection({
  canReview = false,
  isAuthPromptOpen = false,
  isAuthLoading = false,
  onReviewSubmit = async () => undefined,
  onStartReview = () => undefined,
  ownReview,
  reviews = [],
  summary = emptySummary,
}: {
  canReview?: boolean;
  isAuthPromptOpen?: boolean;
  isAuthLoading?: boolean;
  onReviewSubmit?: (
    input: Parameters<
      React.ComponentProps<typeof ProductReviewsSection>['onReviewSubmit']
    >[0],
  ) => Promise<void>;
  onStartReview?: () => void;
  ownReview?: CatalogSetReview;
  reviews?: readonly CatalogSetReview[];
  summary?: CatalogSetReviewSummary;
} = {}) {
  return renderToStaticMarkup(
    <ProductReviewsSection
      accountHref="/account?next=%2Fsets%2Fnew-york-city-the-big-apple-21066%23productbeoordelingen"
      canReview={canReview}
      isAuthLoading={isAuthLoading}
      isAuthPromptOpen={isAuthPromptOpen}
      onAuthPromptClose={() => undefined}
      onReviewSubmit={onReviewSubmit}
      onStartReview={onStartReview}
      ownReview={ownReview}
      reviews={reviews}
      summary={summary}
    />,
  );
}

describe('ProductReviewsSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  async function renderInteractiveProductReviewsSection(
    props: Partial<React.ComponentProps<typeof ProductReviewsSection>> = {},
  ) {
    await act(async () => {
      root.render(
        <ProductReviewsSection
          accountHref="/account?next=%2Fsets%2Fnew-york-city-the-big-apple-21066%23productbeoordelingen"
          canReview={false}
          isAuthPromptOpen={false}
          onAuthPromptClose={() => undefined}
          onReviewSubmit={async () => undefined}
          onStartReview={() => undefined}
          reviews={[]}
          summary={emptySummary}
          {...props}
        />,
      );
    });
  }

  it('renders the product-detail accordion layout instead of the old card header', () => {
    const markup = renderProductReviewsSection({
      reviews: [approvedReview],
      summary: reviewedSummary,
    });

    expect(markup).toContain('<details');
    expect(markup).toContain('<summary');
    expect(markup).toContain('Productbeoordelingen Recensies');
    expect(markup).toContain('detailAccordionTitle');
    expect(markup).toContain('(5)');
    expect(markup).toContain('Bouwervaring');
    expect(markup).toContain('4,7');
    expect(markup).toContain('Speelervaring');
    expect(markup).toContain('4,6');
    expect(markup).toContain('Waar voor je geld');
    expect(markup).toContain('4,3');
    expect(markup).not.toContain('Verzamelaarsstem');
  });

  it('renders a review CTA without placing the form inline', () => {
    const markup = renderProductReviewsSection({ canReview: true });

    expect(markup).toContain('Recensie toevoegen');
    expect(markup).not.toContain('id="product-review-form"');
    expect(markup).not.toContain('Reviewtekst');
  });

  it('renders the owner review card with a pending status badge', () => {
    const markup = renderProductReviewsSection({
      canReview: true,
      ownReview: pendingOwnReview,
      summary: reviewedSummary,
    });

    expect(markup).toContain('Jouw recensie');
    expect(markup).toContain('In controle');
    expect(markup).toContain('Mooie skyline voor op een plank.');
    expect(markup).toContain('Bouwervaring');
    expect(markup).not.toContain('Speelervaring</dt>');
    expect(markup).not.toContain('Waar voor je geld</dt>');
    expect(markup).toContain('Bewerken');
    expect(markup).not.toContain('id="product-review-form"');
  });

  it('renders compact checking state in the accordion body', () => {
    expect(renderProductReviewsSection({ isAuthLoading: true })).toContain(
      'We controleren je account.',
    );
  });

  it('opens the editor dialog for adding a review', async () => {
    await renderInteractiveProductReviewsSection({ canReview: true });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Schrijf je recensie');
    expect(document.body.textContent).toContain('Reviewtekst');
    expect(document.body.textContent).toContain('Meer details (optioneel)');
    expect(document.body.textContent).toContain('Bouwervaring');
    expect(document.body.textContent).toContain('Speelervaring');
    expect(document.body.textContent).toContain('Waar voor je geld');
  });

  it('opens the editor dialog with existing values for editing', async () => {
    await renderInteractiveProductReviewsSection({
      canReview: true,
      ownReview: pendingOwnReview,
      summary: reviewedSummary,
    });

    const editButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.includes('Bewerken'));

    await act(async () => {
      editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Schrijf je recensie');
    expect(
      document.body.querySelector<HTMLTextAreaElement>('textarea')?.value,
    ).toBe('Mooie skyline voor op een plank.');
    const pressedRatings = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        'button[aria-label][aria-pressed="true"]',
      ),
    );

    expect(pressedRatings).toHaveLength(2);
  });

  it('closes the editor dialog after a successful submit', async () => {
    const onReviewSubmit = vi.fn().mockResolvedValue(undefined);
    await renderInteractiveProductReviewsSection({
      canReview: true,
      onReviewSubmit,
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Schrijf je recensie');

    await act(async () => {
      document.body
        .querySelector<HTMLFormElement>('#product-review-form')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });

    expect(onReviewSubmit).toHaveBeenCalledWith({
      buildExperienceRating: null,
      overallRating: 5,
      playExperienceRating: null,
      recommends: null,
      reviewText: '',
      valueForMoneyRating: null,
    });
    expect(document.body.textContent).not.toContain('Schrijf je recensie');
  });

  it('submits selected optional subratings from the editor dialog', async () => {
    const onReviewSubmit = vi.fn().mockResolvedValue(undefined);
    await renderInteractiveProductReviewsSection({
      canReview: true,
      onReviewSubmit,
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const ratingButtons = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        'button[aria-label$="van 5 sterren"]',
      ),
    );

    await act(async () => {
      ratingButtons[9].dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      ratingButtons[12].dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });

    await act(async () => {
      document.body
        .querySelector<HTMLFormElement>('#product-review-form')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
    });

    expect(onReviewSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        buildExperienceRating: 5,
        playExperienceRating: 3,
        valueForMoneyRating: null,
      }),
    );
  });

  it('opens the login/register modal for anonymous review actions', async () => {
    function AnonymousReviewsHarness() {
      const [isAuthPromptOpen, setIsAuthPromptOpen] = React.useState(false);

      return (
        <ProductReviewsSection
          accountHref="/account?next=%2Fsets%2Fnew-york-city-the-big-apple-21066%23productbeoordelingen"
          canReview={false}
          isAuthPromptOpen={isAuthPromptOpen}
          onAuthPromptClose={() => setIsAuthPromptOpen(false)}
          onReviewSubmit={async () => undefined}
          onStartReview={() => setIsAuthPromptOpen(true)}
          reviews={[]}
          summary={emptySummary}
        />
      );
    }

    await act(async () => {
      root.render(<AnonymousReviewsHarness />);
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain(
      'Log in om je beoordeling te plaatsen',
    );
    expect(document.body.textContent).not.toContain('Reviewtekst');
  });

  it('uses detail-section line styling instead of a large bordered card shell', () => {
    const css = readFileSync(
      'libs/reviews/ui/src/lib/reviews-ui.module.css',
      'utf8',
    );
    const sectionRule = css.match(/\.productReviewsSection\s*\{[^}]+}/)?.[0];

    expect(css).not.toContain('.productReviewsDisclosure');
    expect(css).not.toContain('.productReviewsTitle');
    expect(css).not.toContain('.productReviewsSummary');
    expect(css).not.toContain('.productReviewsIconFrame');
    expect(sectionRule).toBeDefined();
    expect(sectionRule).not.toContain('margin');
    expect(sectionRule).not.toContain('border:');
    expect(sectionRule).not.toContain('padding:');
  });
});
