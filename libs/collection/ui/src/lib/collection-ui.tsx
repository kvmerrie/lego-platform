import { type ReactNode } from 'react';
import { CollectionShelf } from '@lego-platform/collection/util';
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
}: {
  errorMessage?: string;
  hasResolvedState: boolean;
  isLoading?: boolean;
  isOwned: boolean;
  isPending?: boolean;
  onToggle: () => void;
  setId: string;
  successMessage?: string;
}) {
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? 'Checking your owned save for this set.'
    : isUnavailable
      ? 'Owned status is unavailable right now.'
      : isOwned
        ? 'Saved to your owned collection.'
        : 'Add this set to your owned collection.';
  const description = isLoading
    ? `Loading whether set ${setId} is already attached to your signed-in collector account as owned.`
    : isUnavailable
      ? `Set ${setId} cannot be updated until the owned-state query succeeds.`
      : isOwned
        ? `Set ${setId} is privately saved as owned on your collector account. This stays independent from wanted state and does not change public catalog information.`
        : `Save set ${setId} as privately owned on your collector account without affecting wanted state or public catalog information.`;
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
        <Badge>Private collector state</Badge>
        <Badge tone="info">Set {setId}</Badge>
        {isPending ? <Badge tone="info">Saving</Badge> : null}
      </div>
      <SectionHeading description={description} title={title} titleAs="h2" />
      <p className={styles.metaText}>
        Personal to your collector account. Public set facts and reviewed buying
        guidance stay unchanged for other visitors.
      </p>
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
      ? 'Loading your collector collection'
      : state === 'signed-out'
        ? 'Sign in to view your private owned collection'
        : state === 'empty'
          ? collectorName
            ? `${collectorName}, your collection is ready for its first saved set`
            : 'Your collection is ready for its first saved set'
          : collectorName
            ? `${collectorName}, here is your owned collection`
            : 'Your owned collection';
  const description =
    state === 'loading'
      ? 'Checking the sets privately saved as owned on your collector account.'
      : state === 'signed-out'
        ? 'This page only shows sets saved to your signed-in collector account. Public catalog browsing still works for everyone.'
        : state === 'empty'
          ? hiddenOwnedCount > 0
            ? `You have ${formatOwnedSetCount(
                hiddenOwnedCount,
              )} saved outside the current public catalog slice. Save a featured set as owned to start building the visible collection here.`
            : 'Save sets as owned from their detail pages and they will appear here as your private collection ledger.'
          : hiddenOwnedCount > 0
            ? `Showing ${formatOwnedSetCount(
                ownedCount,
              )} from the current public catalog slice. ${formatOwnedSetCount(
                hiddenOwnedCount,
              )} stay saved on your account but sit outside the public curated catalog right now.`
            : `This page shows ${formatOwnedSetCount(
                ownedCount,
              )} privately saved on your collector account.`;

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
        <div className={styles.collectionMeta}>
          <Badge tone={state === 'populated' ? 'positive' : 'info'}>
            {state === 'loading'
              ? 'Loading private state'
              : state === 'signed-out'
                ? 'Private collector page'
                : `${ownedCount} visible`}
          </Badge>
          <Badge>Owned ledger</Badge>
          {hiddenOwnedCount > 0 ? (
            <Badge tone="warning">
              {hiddenOwnedCount} outside public slice
            </Badge>
          ) : null}
        </div>
      </div>
      <p className={styles.metaText}>
        Private to your collector account. Public set facts, reviewed pricing,
        and curated buying guidance remain shared catalog information.
      </p>
      <div className={styles.destinationPanel}>
        <p className={styles.metaText}>
          This private collection extends the public browse flow, so owned sets
          stay distinct from the sets you still want next.
        </p>
        <div className={styles.destinationLinks}>
          <ActionLink href="/wishlist" tone="secondary">
            Open wishlist
          </ActionLink>
          <ActionLink href="/#featured-sets" tone="secondary">
            Browse featured sets
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
          <ActionLink href="/#featured-sets" tone="secondary">
            Browse featured sets
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
