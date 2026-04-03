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
    ? 'Checking owned save'
    : isUnavailable
      ? 'Owned save unavailable'
      : isOwned
        ? 'Owned'
        : 'Mark as owned';
  const description = isLoading
    ? 'Checking whether this set is already in your collection.'
    : isUnavailable
      ? 'We could not load your owned save right now.'
      : isOwned
        ? 'This set is in your private collection.'
        : 'Keep this set in your private collection.';
  const actionLabel = isUnavailable
    ? 'Collection status unavailable'
    : isOwned
      ? 'Remove from collection'
      : 'Mark as owned';
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
        ? 'Owned'
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
                  ? 'Remove from collection'
                  : 'Mark as owned'}
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
      <p className={styles.metaText}>Private save. Set facts stay public.</p>
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
          ? 'Syncing collection...'
          : isPending
            ? 'Saving...'
            : actionLabel}
      </Button>
    </Surface>
  );
}

export function CollectorCollectionPanel({
  children,
  controls,
  errorMessage,
  hiddenOwnedCount = 0,
  ownedCount = 0,
  statusMessage,
  state,
}: {
  children?: ReactNode;
  collectorName?: string;
  controls?: ReactNode;
  errorMessage?: string;
  hiddenOwnedCount?: number;
  ownedCount?: number;
  statusMessage?: string;
  state: 'empty' | 'loading' | 'populated' | 'signed-out';
}) {
  const title =
    state === 'loading'
      ? 'Loading your collection'
      : state === 'signed-out'
        ? 'Sign in to see your collection'
        : state === 'empty'
          ? 'Nothing in your collection yet'
          : 'Your collection';
  const description =
    state === 'loading'
      ? 'Loading the sets in your collection.'
      : state === 'signed-out'
        ? 'Sign in to see the sets in your collection.'
        : state === 'empty'
          ? hiddenOwnedCount > 0
            ? `You have ${hiddenOwnedCount} saved outside the sets currently shown on Brickhunt. Save any visible set and it will show up here too.`
            : 'Mark a set as owned from any set page, then use this space to keep your collection tidy.'
          : hiddenOwnedCount > 0
            ? `Showing ${ownedCount} here today. ${hiddenOwnedCount} stay saved outside the current catalog.`
            : `${ownedCount} saved.`;

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
          titleAs="h1"
        />
        <p className={styles.collectionMeta}>
          {state === 'loading'
            ? 'Loading saves'
            : state === 'signed-out'
              ? 'Sign in to save privately'
              : `${ownedCount} in collection`}
          {hiddenOwnedCount > 0
            ? ` · ${hiddenOwnedCount} outside today's catalog`
            : ''}
        </p>
      </div>
      <p className={styles.metaText}>
        Your saves stay private. Set pages and price checks stay public.
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
          <ActionLink href={buildWebPath(webPathnames.themes)} tone="secondary">
            Browse themes
          </ActionLink>
        </div>
      </div>
      {controls ? (
        <div className={styles.collectionToolbar}>{controls}</div>
      ) : null}
      {statusMessage ? (
        <p aria-live="polite" className={styles.successText}>
          {statusMessage}
        </p>
      ) : null}
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
          <ActionLink href={buildWebPath(webPathnames.themes)} tone="secondary">
            Browse themes
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
