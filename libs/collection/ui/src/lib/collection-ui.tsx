import { CollectionShelf } from '@lego-platform/collection/util';
import { Button, Badge, SectionHeading, Surface } from '@lego-platform/shared/ui';
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
      {metricCard.detail ? <p className={styles.description}>{metricCard.detail}</p> : null}
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
        ? `Set ${setId} is currently saved as owned on your collector account. This stays independent from wanted state.`
        : `Save set ${setId} as owned so it stays attached to your collector account without affecting wanted state.`;
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
      tone={isLoading || isUnavailable ? 'muted' : isOwned ? 'accent' : 'default'}
    >
      <div className={styles.toggleMeta}>
        <Badge tone={statusTone}>{statusLabel}</Badge>
        <Badge tone="info">Set {setId}</Badge>
        {isPending ? <Badge tone="info">Saving</Badge> : null}
      </div>
      <SectionHeading description={description} title={title} titleAs="h2" />
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
