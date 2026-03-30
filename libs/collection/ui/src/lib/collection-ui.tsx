import { type ReactNode } from 'react';
import { CollectionShelf } from '@lego-platform/collection/util';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  ActionLink,
  Button,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import { MetricCard } from '@lego-platform/shared/types';
import styles from './collection-ui.module.css';

export function CollectionMetricCard({
  metricCard,
}: {
  metricCard: MetricCard;
}) {
  return (
    <Surface
      as="article"
      className={styles.metricCard}
      elevation="rested"
      tone={metricCard.tone === 'positive' ? 'accent' : 'default'}
    >
      <Badge
        tone={
          metricCard.tone === 'positive'
            ? 'positive'
            : metricCard.tone === 'warning'
              ? 'warning'
              : metricCard.tone === 'accent'
                ? 'accent'
                : 'neutral'
        }
      >
        {metricCard.label}
      </Badge>
      <h3 className={styles.metricValue}>{metricCard.value}</h3>
      {metricCard.detail ? (
        <p className={styles.description}>{metricCard.detail}</p>
      ) : null}
    </Surface>
  );
}

export function CollectionShelfCard({
  collectionShelf,
}: {
  collectionShelf: CollectionShelf;
}) {
  return (
    <Surface as="article" className={styles.shelfCard} tone="muted">
      <div className={styles.shelfHeader}>
        <h3 className={styles.title}>{collectionShelf.name}</h3>
        <Badge tone="info">{collectionShelf.completion}</Badge>
      </div>
      <p>{collectionShelf.focus}</p>
      <p className={styles.description}>{collectionShelf.notes}</p>
    </Surface>
  );
}

export function OwnedSetToggleCard({
  errorMessage,
  hasResolvedState,
  isLoading,
  isOwned,
  isPending,
  onToggle,
  setId,
  successMessage,
  variant = 'default',
}: {
  errorMessage?: string;
  hasResolvedState: boolean;
  isLoading?: boolean;
  isOwned: boolean;
  isPending?: boolean;
  onToggle: () => void;
  setId: string;
  successMessage?: string;
  variant?: 'default' | 'product';
}) {
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? 'Checking owned save.'
    : isUnavailable
      ? 'Owned save unavailable.'
      : isOwned
        ? 'Owned saved.'
        : 'Save to owned.';
  const description = isLoading
    ? 'Checking your private owned save for this set.'
    : isUnavailable
      ? 'We could not load the private owned save right now.'
      : isOwned
        ? 'Saved in your private collection.'
        : 'Save this set to your private collection.';
  const actionLabel = isUnavailable
    ? 'Owned status unavailable'
    : isOwned
      ? 'Remove from owned'
      : 'Save as owned';
  const statusTone = isLoading
    ? 'info'
    : isUnavailable
      ? 'error'
      : isOwned
        ? 'positive'
        : 'neutral';
  const statusLabel = isLoading
    ? 'Syncing'
    : isUnavailable
      ? 'State unavailable'
      : isOwned
        ? 'Owned saved'
        : 'Not saved yet';

  if (variant === 'product') {
    return (
      <article className={styles.productToggle}>
        {errorMessage ? (
          <p aria-live="polite" className={styles.errorText}>
            {errorMessage}
          </p>
        ) : null}
        <Button
          className={`${styles.productToggleButton} ${
            isOwned
              ? styles.productToggleButtonActive
              : styles.productToggleButtonIdle
          }`}
          disabled={isUnavailable}
          isLoading={Boolean(isLoading || isPending)}
          tone="ghost"
          type="button"
          onClick={onToggle}
        >
          {isLoading
            ? 'Syncing...'
            : isPending
              ? 'Saving...'
              : isUnavailable
                ? 'Owned unavailable'
                : isOwned
                  ? 'Remove owned'
                  : 'Save as owned'}
        </Button>
      </article>
    );
  }

  return (
    <Surface
      as="article"
      className={styles.toggleCard}
      elevation="rested"
      tone={
        isLoading || isUnavailable ? 'muted' : isOwned ? 'accent' : 'default'
      }
    >
      <div className={styles.toggleMeta}>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      <SectionHeading description={description} title={title} titleAs="h2" />
      <p className={styles.metaText}>Private to you. Set facts stay public.</p>
      {errorMessage ? (
        <p aria-live="polite" className={styles.errorText}>
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p aria-live="polite" className={styles.successText}>
          {successMessage}
        </p>
      ) : null}
      <Button
        className={styles.toggleButton}
        disabled={isUnavailable}
        isLoading={Boolean(isLoading || isPending)}
        tone={isOwned ? 'secondary' : 'accent'}
        type="button"
        onClick={onToggle}
      >
        {isLoading
          ? 'Syncing owned state...'
          : isPending
            ? 'Saving...'
            : actionLabel}
      </Button>
    </Surface>
  );
}

function formatOwnedSetCount(count: number): string {
  return `${count} owned set${count === 1 ? '' : 's'}`;
}

export function CollectorCollectionPanel({
  children,
  collectorName,
  errorMessage,
  hiddenOwnedCount = 0,
  ownedCount = 0,
  state,
}: {
  children?: ReactNode;
  collectorName?: string;
  errorMessage?: string;
  hiddenOwnedCount?: number;
  ownedCount?: number;
  state: 'empty' | 'loading' | 'populated' | 'signed-out';
}) {
  const title =
    state === 'loading'
      ? 'Loading your collection'
      : state === 'signed-out'
        ? 'Sign in to open your private collection'
        : state === 'empty'
          ? collectorName
            ? `${collectorName}, your collection is ready for its first set`
            : 'Your collection is ready for its first set'
          : collectorName
            ? `${collectorName}, here is your collection`
            : 'Your collection';
  const description =
    state === 'loading'
      ? 'Loading the sets saved as owned on your account.'
      : state === 'signed-out'
        ? 'This page shows the sets you have saved as owned.'
        : state === 'empty'
          ? hiddenOwnedCount > 0
            ? `You have ${formatOwnedSetCount(
                hiddenOwnedCount,
              )} saved outside the current public catalog. Save a featured set to start the visible collection.`
            : 'Save an owned set from any set page and it will appear here.'
          : hiddenOwnedCount > 0
            ? `Showing ${formatOwnedSetCount(
                ownedCount,
              )} from the current public catalog. ${formatOwnedSetCount(
                hiddenOwnedCount,
              )} stay saved outside it.`
            : `Showing ${formatOwnedSetCount(ownedCount)}.`;

  return (
    <Surface
      as="section"
      className={styles.collectionPagePanel}
      elevation="rested"
      tone={state === 'populated' ? 'default' : 'muted'}
    >
      <div className={styles.collectionHeader}>
        <SectionHeading
          description={description}
          eyebrow="Collector collection"
          title={title}
          titleAs="h2"
        />
        <p className={styles.collectionMeta}>
          {state === 'loading'
            ? 'Loading private state'
            : state === 'signed-out'
              ? 'Private account area'
              : `${ownedCount} visible`}
          {hiddenOwnedCount > 0
            ? ` · ${hiddenOwnedCount} outside public catalog`
            : ''}
        </p>
      </div>
      <p className={styles.metaText}>
        Private to you. Set facts and pricing stay public.
      </p>
      <div className={styles.destinationPanel}>
        <div className={styles.destinationLinks}>
          <ActionLink
            href={buildWebPath(webPathnames.account)}
            tone="secondary"
          >
            Open account
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.wishlist)}
            tone="secondary"
          >
            Open wishlist
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Browse catalog
          </ActionLink>
        </div>
      </div>
      {errorMessage ? (
        <p aria-live="polite" className={styles.errorText}>
          {errorMessage}
        </p>
      ) : null}
      {state === 'populated' ? (
        <div className={styles.collectionGrid}>{children}</div>
      ) : (
        <div className={styles.collectionEmptyActions}>
          <ActionLink
            href={buildWebPath(webPathnames.account)}
            tone="secondary"
          >
            Open account
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Browse catalog
          </ActionLink>
        </div>
      )}
    </Surface>
  );
}

export function CollectionUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Display metrics, shelves, and curation surfaces without embedding business rules."
        eyebrow="Collection UI"
        title="Collector-state surfaces with crisp status and action treatment."
      />
    </Surface>
  );
}

export default CollectionUi;
