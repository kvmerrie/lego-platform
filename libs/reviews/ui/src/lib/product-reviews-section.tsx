'use client';

import React, { type FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Star, ToyBrick } from 'lucide-react';
import {
  ActionLink,
  Button,
  DetailAccordionSection,
  ResponsiveDialog,
} from '@lego-platform/shared/ui';
import {
  OPEN_PRODUCT_REVIEWS_EVENT,
  PRODUCT_REVIEWS_SECTION_ID,
} from '@lego-platform/shared/config';
import type {
  CatalogSetReview,
  CatalogSetReviewInput,
  CatalogSetReviewSummary,
} from '@lego-platform/reviews/util';
import styles from './reviews-ui.module.css';

function joinClassNames(
  ...classNames: Array<string | false | null | undefined>
): string | undefined {
  const className = classNames.filter(Boolean).join(' ');

  return className || undefined;
}

function formatAverageRating(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Nog geen score';
  }

  return value.toLocaleString('nl-NL', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function getReviewCountLabel(reviewCount: number): string {
  if (reviewCount === 0) {
    return 'Nog geen beoordelingen';
  }

  if (reviewCount === 1) {
    return '1 beoordeling';
  }

  return `${reviewCount} beoordelingen`;
}

function getReviewCountCompactLabel(reviewCount: number): string {
  return `(${reviewCount.toLocaleString('nl-NL')})`;
}

function formatReviewDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getRecommendPercentage(summary: CatalogSetReviewSummary): number {
  if (summary.reviewCount <= 0) {
    return 0;
  }

  return Math.round((summary.recommendCount / summary.reviewCount) * 100);
}

function getModerationStatusLabel(
  status: CatalogSetReview['moderationStatus'],
): string {
  switch (status) {
    case 'approved':
      return 'Goedgekeurd';
    case 'hidden':
      return 'Verborgen';
    case 'pending':
      return 'In controle';
    case 'rejected':
      return 'Afgewezen';
  }
}

const reviewSubratingLabels = [
  {
    key: 'buildExperienceRating',
    label: 'Bouwervaring',
    summaryKey: 'averageBuildExperienceRating',
  },
  {
    key: 'playExperienceRating',
    label: 'Speelervaring',
    summaryKey: 'averagePlayExperienceRating',
  },
  {
    key: 'valueForMoneyRating',
    label: 'Waar voor je geld',
    summaryKey: 'averageValueForMoneyRating',
  },
] as const;

type ReviewSubratingKey = (typeof reviewSubratingLabels)[number]['key'];
type ReviewSummarySubratingKey =
  (typeof reviewSubratingLabels)[number]['summaryKey'];
type RatingIconType = 'brick' | 'star';

function isDefined<T>(value: T | undefined): value is T {
  return typeof value !== 'undefined';
}

function formatOptionalRating(value: number): string {
  return value.toLocaleString('nl-NL', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function getReviewSubratingRows(review: CatalogSetReview) {
  return reviewSubratingLabels
    .map((subrating) => {
      const value = review[subrating.key];

      return typeof value === 'number'
        ? { label: subrating.label, value }
        : undefined;
    })
    .filter(isDefined);
}

function getSummarySubratingRows(summary: CatalogSetReviewSummary) {
  return reviewSubratingLabels
    .map((subrating) => {
      const value = summary[subrating.summaryKey];

      return typeof value === 'number'
        ? { label: subrating.label, value }
        : undefined;
    })
    .filter(isDefined);
}

function RatingStars({
  icon = 'star',
  label,
  value,
}: {
  icon?: RatingIconType;
  label?: string;
  value: number;
}) {
  const Icon = icon === 'brick' ? ToyBrick : Star;

  return (
    <span
      aria-label={label ?? `${value} van 5 sterren`}
      className={styles.ratingStars}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <Icon
          aria-hidden="true"
          className={joinClassNames(
            styles.ratingStar,
            rating <= Math.round(value) && styles.ratingStarFilled,
          )}
          key={rating}
        />
      ))}
    </span>
  );
}

function RatingInput({
  allowEmpty = false,
  disabled,
  icon = 'star',
  label,
  onChange,
  value,
}: {
  allowEmpty?: boolean;
  disabled?: boolean;
  icon?: RatingIconType;
  label: string;
  onChange: (value: number | null) => void;
  value: number | null;
}) {
  const Icon = icon === 'brick' ? ToyBrick : Star;

  return (
    <fieldset className={styles.ratingInputGroup}>
      <legend className={styles.inputLabel}>{label}</legend>
      <div className={styles.ratingInputOptions}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            aria-label={`${rating} van 5 sterren`}
            aria-pressed={value === rating}
            className={styles.ratingInputButton}
            disabled={disabled}
            key={rating}
            onClick={() =>
              allowEmpty && value === rating ? onChange(null) : onChange(rating)
            }
            type="button"
          >
            <Icon
              aria-hidden="true"
              className={joinClassNames(
                styles.ratingInputStar,
                typeof value === 'number' &&
                  rating <= value &&
                  styles.ratingInputStarSelected,
              )}
            />
          </button>
        ))}
        {allowEmpty ? (
          <button
            className={styles.ratingClearButton}
            disabled={disabled || value === null}
            onClick={() => onChange(null)}
            type="button"
          >
            Leeg laten
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

function ReviewSummary({
  onReviewAction,
  ownReview,
  summary,
}: {
  onReviewAction: () => void;
  ownReview?: CatalogSetReview;
  summary: CatalogSetReviewSummary;
}) {
  const recommendPercentage = getRecommendPercentage(summary);
  const subratingRows = getSummarySubratingRows(summary);
  const maxDistributionCount = Math.max(
    1,
    ...Object.values(summary.ratingDistribution),
  );

  return (
    <div className={styles.reviewSummary}>
      <div className={styles.reviewSummaryHeader}>
        <h3 className={styles.reviewSummaryTitle}>Algemene beoordeling</h3>
        <Button onClick={onReviewAction} variant="primary">
          {ownReview ? 'Recensie bewerken' : 'Recensie toevoegen'}
        </Button>
      </div>
      <div className={styles.reviewSummaryGrid}>
        <div className={styles.reviewScorePanel}>
          <div className={styles.reviewScoreBlock}>
            <span className={styles.reviewScore}>
              {formatAverageRating(summary.averageRating)}
            </span>
            {summary.reviewCount > 0 ? (
              <RatingStars value={summary.averageRating ?? 0} />
            ) : null}
          </div>
          <dl className={styles.reviewSummaryMetrics}>
            <div>
              <dt>Aantal reviews</dt>
              <dd>{summary.reviewCount.toLocaleString('nl-NL')}</dd>
            </div>
            <div>
              <dt>Aanbeveling</dt>
              <dd>
                {summary.reviewCount > 0
                  ? `${recommendPercentage}%`
                  : 'Nog geen score'}
              </dd>
            </div>
          </dl>
        </div>
        <div className={styles.ratingDistribution}>
          <h4 className={styles.reviewSubheading}>Beoordeling</h4>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count =
              summary.ratingDistribution[
                String(
                  rating,
                ) as keyof CatalogSetReviewSummary['ratingDistribution']
              ];
            const percentage =
              summary.reviewCount > 0
                ? Math.round((count / summary.reviewCount) * 100)
                : 0;
            const width = `${Math.round((count / maxDistributionCount) * 100)}%`;

            return (
              <div className={styles.ratingDistributionRow} key={rating}>
                <span>{rating} sterren</span>
                <span className={styles.ratingDistributionTrack}>
                  <span
                    className={styles.ratingDistributionFill}
                    style={{ inlineSize: width }}
                  />
                </span>
                <span>{percentage}%</span>
              </div>
            );
          })}
        </div>
        <div className={styles.reviewSubratings}>
          <h4 className={styles.reviewSubheading}>Subratings</h4>
          {subratingRows.length > 0 ? (
            subratingRows.map((row) => (
              <div className={styles.reviewSubratingRow} key={row.label}>
                <span>{row.label}</span>
                <span className={styles.reviewSubratingScore}>
                  <RatingStars icon="brick" value={row.value} />
                  {formatOptionalRating(row.value)}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.reviewMutedText}>Nog geen beoordelingen</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductReviewsSummaryLine({
  summary,
}: {
  summary: CatalogSetReviewSummary;
}) {
  return (
    <span className={styles.reviewsSummaryLine}>
      {summary.reviewCount > 0 ? (
        <RatingStars
          label={`${formatAverageRating(summary.averageRating)} van 5 sterren`}
          value={summary.averageRating ?? 0}
        />
      ) : (
        <span className={styles.reviewsNoScoreLabel}>Nog geen score</span>
      )}
      <span className={styles.reviewsCompactCount}>
        {getReviewCountCompactLabel(summary.reviewCount)}
      </span>
    </span>
  );
}

function ReviewCard({ review }: { review: CatalogSetReview }) {
  const formattedDate = formatReviewDate(review.updatedAt || review.createdAt);
  const subratingRows = getReviewSubratingRows(review);

  return (
    <article className={styles.reviewCard}>
      <header className={styles.reviewCardHeader}>
        <div>
          <RatingStars value={review.overallRating} />
          <p className={styles.reviewMeta}>
            {review.authorDisplayName}
            {formattedDate ? ` · ${formattedDate}` : ''}
          </p>
        </div>
        {review.recommends ? (
          <span className={styles.recommendBadge}>
            <CheckCircle2 aria-hidden="true" />
            Aanrader
          </span>
        ) : null}
      </header>
      {review.reviewText ? (
        <p className={styles.reviewText}>{review.reviewText}</p>
      ) : null}
      {subratingRows.length > 0 ? (
        <dl className={styles.reviewCardSubratings}>
          {subratingRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                <RatingStars icon="brick" value={row.value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function OwnReviewCard({
  onEdit,
  review,
}: {
  onEdit: () => void;
  review: CatalogSetReview;
}) {
  const formattedDate = formatReviewDate(review.updatedAt || review.createdAt);
  const subratingRows = getReviewSubratingRows(review);

  return (
    <section className={styles.ownReviewSection}>
      <div className={styles.reviewSectionHeader}>
        <h3>Jouw recensie</h3>
        <Button onClick={onEdit} variant="secondary">
          Bewerken
        </Button>
      </div>
      <article className={styles.ownReviewCard}>
        <div className={styles.ownReviewCardHeader}>
          <span
            className={joinClassNames(
              styles.statusBadge,
              styles[`statusBadge-${review.moderationStatus}`],
            )}
          >
            {getModerationStatusLabel(review.moderationStatus)}
          </span>
          {formattedDate ? (
            <span className={styles.reviewDate}>{formattedDate}</span>
          ) : null}
        </div>
        <RatingStars value={review.overallRating} />
        {review.reviewText ? (
          <p className={styles.reviewText}>{review.reviewText}</p>
        ) : (
          <p className={styles.reviewMutedText}>
            Je hebt nog geen reviewtekst toegevoegd.
          </p>
        )}
        {subratingRows.length > 0 ? (
          <dl className={styles.reviewCardSubratings}>
            {subratingRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <RatingStars icon="brick" value={row.value} />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </article>
    </section>
  );
}

function ReviewsList({
  onReviewAction,
  reviews,
}: {
  onReviewAction: () => void;
  reviews: readonly CatalogSetReview[];
}) {
  return (
    <section className={styles.reviewsListSection}>
      <div className={styles.reviewSectionHeader}>
        <h3>Beoordelingen</h3>
      </div>
      {reviews.length > 0 ? (
        <div className={styles.reviewList}>
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <div className={styles.noReviewsPrompt}>
          <p>
            <strong>Nog geen beoordelingen.</strong>
            <br />
            Help andere verzamelaars door als eerste een beoordeling te
            plaatsen.
          </p>
          <Button onClick={onReviewAction} variant="primary">
            Recensie toevoegen
          </Button>
        </div>
      )}
    </section>
  );
}

function ReviewForm({
  error,
  isSubmitting,
  onSubmit,
  ownReview,
}: {
  error?: string;
  isSubmitting?: boolean;
  onSubmit: (input: CatalogSetReviewInput) => Promise<void>;
  ownReview?: CatalogSetReview;
}) {
  const [overallRating, setOverallRating] = useState<number | null>(
    ownReview?.overallRating ?? null,
  );
  const [buildExperienceRating, setBuildExperienceRating] = useState<
    number | null
  >(ownReview?.buildExperienceRating ?? null);
  const [playExperienceRating, setPlayExperienceRating] = useState<
    number | null
  >(ownReview?.playExperienceRating ?? null);
  const [valueForMoneyRating, setValueForMoneyRating] = useState<number | null>(
    ownReview?.valueForMoneyRating ?? null,
  );
  const [recommends, setRecommends] = useState<boolean | null>(
    ownReview?.recommends ?? null,
  );
  const [reviewText, setReviewText] = useState(ownReview?.reviewText ?? '');
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    setOverallRating(ownReview?.overallRating ?? null);
    setBuildExperienceRating(ownReview?.buildExperienceRating ?? null);
    setPlayExperienceRating(ownReview?.playExperienceRating ?? null);
    setValueForMoneyRating(ownReview?.valueForMoneyRating ?? null);
    setRecommends(ownReview?.recommends ?? null);
    setReviewText(ownReview?.reviewText ?? '');
    setValidationError(undefined);
  }, [ownReview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (overallRating === null) {
      setValidationError('Kies een beoordeling van 1 tot en met 5 sterren.');
      return;
    }

    setValidationError(undefined);
    await onSubmit({
      buildExperienceRating,
      overallRating,
      playExperienceRating,
      recommends,
      reviewText,
      valueForMoneyRating,
    });
  }

  return (
    <form
      className={styles.reviewForm}
      id="product-review-form"
      onSubmit={handleSubmit}
    >
      <RatingInput
        disabled={isSubmitting}
        label="Algemene beoordeling *"
        onChange={(value) => {
          if (typeof value === 'number') {
            setOverallRating(value);
          }
        }}
        value={overallRating}
      />
      <div className={styles.optionalRatingsGroup}>
        <h3>Meer details (optioneel)</h3>
        <RatingInput
          allowEmpty
          disabled={isSubmitting}
          icon="brick"
          label="Bouwervaring"
          onChange={setBuildExperienceRating}
          value={buildExperienceRating}
        />
        <RatingInput
          allowEmpty
          disabled={isSubmitting}
          icon="brick"
          label="Speelervaring"
          onChange={setPlayExperienceRating}
          value={playExperienceRating}
        />
        <RatingInput
          allowEmpty
          disabled={isSubmitting}
          icon="brick"
          label="Waar voor je geld"
          onChange={setValueForMoneyRating}
          value={valueForMoneyRating}
        />
      </div>
      <fieldset className={styles.recommendGroup}>
        <legend className={styles.inputLabel}>Zou je deze set aanraden?</legend>
        <div className={styles.segmentedControl}>
          {[
            { label: 'Ja', value: true },
            { label: 'Nee', value: false },
          ].map((option) => (
            <button
              aria-pressed={recommends === option.value}
              className={styles.segmentedButton}
              disabled={isSubmitting}
              key={option.label}
              onClick={() => setRecommends(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
          <button
            aria-pressed={recommends === null}
            className={styles.segmentedButton}
            disabled={isSubmitting}
            onClick={() => setRecommends(null)}
            type="button"
          >
            Overslaan
          </button>
        </div>
      </fieldset>
      <label className={styles.textareaLabel}>
        Reviewtekst
        <textarea
          className={styles.reviewTextarea}
          disabled={isSubmitting}
          maxLength={4000}
          onChange={(event) => setReviewText(event.target.value)}
          placeholder="Wat valt op tijdens het bouwen, spelen of neerzetten?"
          value={reviewText}
        />
      </label>
      <p className={styles.formHint}>
        Reviews met tekst worden eerst gecontroleerd. Een beoordeling zonder
        tekst is direct zichtbaar.
      </p>
      {ownReview?.moderationStatus === 'pending' ? (
        <p className={styles.pendingNotice}>
          Je beoordeling staat klaar voor controle.
        </p>
      ) : null}
      {validationError || error ? (
        <p className={styles.formError} role="alert">
          {validationError ?? error}
        </p>
      ) : null}
      <Button isLoading={isSubmitting} type="submit" variant="primary">
        {ownReview ? 'Recensie opslaan' : 'Recensie verzenden'}
      </Button>
    </form>
  );
}

function ReviewEditorDialog({
  error,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
  ownReview,
}: {
  error?: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CatalogSetReviewInput) => Promise<void>;
  ownReview?: CatalogSetReview;
}) {
  return (
    <ResponsiveDialog
      description="Geef je score en voeg eventueel toe wat tijdens het bouwen of neerzetten opvalt."
      isOpen={isOpen}
      onClose={onClose}
      title="Schrijf je recensie"
    >
      <ReviewForm
        error={error}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        ownReview={ownReview}
      />
    </ResponsiveDialog>
  );
}

export function ProductReviewsSection({
  accountHref,
  canReview,
  error,
  isAuthPromptOpen,
  isAuthLoading,
  isSubmitting,
  onAuthPromptClose,
  onReviewSubmit,
  onStartReview,
  ownReview,
  reviews,
  summary,
}: {
  accountHref: string;
  canReview: boolean;
  error?: string;
  isAuthPromptOpen: boolean;
  isAuthLoading?: boolean;
  isSubmitting?: boolean;
  onAuthPromptClose: () => void;
  onReviewSubmit: (input: CatalogSetReviewInput) => Promise<void>;
  onStartReview: () => void;
  ownReview?: CatalogSetReview;
  reviews: readonly CatalogSetReview[];
  summary: CatalogSetReviewSummary;
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const publicReviews = useMemo(
    () =>
      ownReview
        ? reviews.filter((review) => review.id !== ownReview.id)
        : reviews,
    [ownReview, reviews],
  );

  useEffect(() => {
    function getProductReviewsSummary() {
      return document
        .getElementById(PRODUCT_REVIEWS_SECTION_ID)
        ?.querySelector<HTMLElement>('summary');
    }

    function getProductReviewsDetails() {
      return document
        .getElementById(PRODUCT_REVIEWS_SECTION_ID)
        ?.querySelector<HTMLDetailsElement>('details');
    }

    function focusSummary() {
      const summaryElement = getProductReviewsSummary();

      if (summaryElement && summaryElement.tabIndex < 0) {
        summaryElement.tabIndex = 0;
      }

      summaryElement?.focus();
    }

    function scheduleSummaryFocus() {
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(() => focusSummary());
      }

      window.setTimeout(focusSummary, 0);
    }

    function openProductReviews() {
      const detailsElement = getProductReviewsDetails();

      if (detailsElement) {
        detailsElement.open = true;
      }

      setIsAccordionOpen(true);
      scheduleSummaryFocus();
    }

    function openForReviewsHash() {
      if (window.location.hash !== `#${PRODUCT_REVIEWS_SECTION_ID}`) {
        return;
      }

      openProductReviews();
    }

    function handleProductReviewsAnchorClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>(
        `a[href="#${PRODUCT_REVIEWS_SECTION_ID}"]`,
      );

      if (!anchor) {
        return;
      }

      openProductReviews();
    }

    openForReviewsHash();
    document.addEventListener('click', handleProductReviewsAnchorClick, true);
    window.addEventListener('hashchange', openForReviewsHash);
    window.addEventListener(OPEN_PRODUCT_REVIEWS_EVENT, openProductReviews);

    return () => {
      document.removeEventListener(
        'click',
        handleProductReviewsAnchorClick,
        true,
      );
      window.removeEventListener('hashchange', openForReviewsHash);
      window.removeEventListener(
        OPEN_PRODUCT_REVIEWS_EVENT,
        openProductReviews,
      );
    };
  }, []);

  function handleReviewAction() {
    if (!canReview) {
      onStartReview();
      return;
    }

    setIsEditorOpen(true);
  }

  async function handleEditorSubmit(input: CatalogSetReviewInput) {
    await onReviewSubmit(input);
    setIsEditorOpen(false);
  }

  return (
    <DetailAccordionSection
      className={styles.productReviewsSection}
      contentClassName={styles.productReviewsLayout}
      id={PRODUCT_REVIEWS_SECTION_ID}
      onToggle={(event) => {
        setIsAccordionOpen(event.currentTarget.open);
      }}
      open={isAccordionOpen}
      summaryMeta={<ProductReviewsSummaryLine summary={summary} />}
      title="Productbeoordelingen"
      titleId="product-reviews-title"
    >
      <ReviewSummary
        onReviewAction={handleReviewAction}
        ownReview={ownReview}
        summary={summary}
      />
      {isAuthLoading ? (
        <div className={styles.reviewAuthLoadingPanel}>
          <p>We controleren je account.</p>
        </div>
      ) : null}
      {error && canReview && !isEditorOpen ? (
        <p className={styles.formError}>{error}</p>
      ) : null}

      {ownReview ? (
        <OwnReviewCard onEdit={handleReviewAction} review={ownReview} />
      ) : null}
      <ReviewsList
        onReviewAction={handleReviewAction}
        reviews={publicReviews}
      />

      <ReviewEditorDialog
        error={error}
        isOpen={isEditorOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsEditorOpen(false)}
        onSubmit={handleEditorSubmit}
        ownReview={ownReview}
      />

      <ResponsiveDialog
        description="Maak een gratis account of log in om jouw ervaring met deze set te delen."
        footer={
          <>
            <ActionLink href={accountHref} variant="primary">
              Inloggen
            </ActionLink>
            <ActionLink href={accountHref} variant="secondary">
              Account maken
            </ActionLink>
          </>
        }
        isOpen={isAuthPromptOpen}
        onClose={onAuthPromptClose}
        title="Log in om je beoordeling te plaatsen"
      >
        <p className={styles.authPromptText}>
          Met een Brickhunt-account kun je één beoordeling per set achterlaten.
        </p>
      </ResponsiveDialog>
    </DetailAccordionSection>
  );
}
