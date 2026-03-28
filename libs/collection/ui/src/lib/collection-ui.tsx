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
  isLoading,
  isOwned,
  isPending,
  onToggle,
  setId,
}: {
  errorMessage?: string;
  isLoading?: boolean;
  isOwned: boolean;
  isPending?: boolean;
  onToggle: () => void;
  setId: string;
}) {
  const title = isOwned
    ? 'This set is already in your owned ledger.'
    : 'Mark this set as owned when it is part of your collection.';
  const actionLabel = isOwned ? 'Remove from owned' : 'Mark as owned';

  return (
    <Surface
      as="article"
      className={styles.toggleCard}
      elevation="rested"
      tone={isOwned ? 'accent' : 'default'}
    >
      <div className={styles.toggleMeta}>
        <Badge tone={isOwned ? 'positive' : 'neutral'}>Owned status</Badge>
        <Badge tone="info">Set {setId}</Badge>
      </div>
      <SectionHeading
        description={`Set ${setId} keeps an independent owned flag, separate from wanted state.`}
        title={title}
        titleAs="h2"
      />
      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      <Button
        className={styles.toggleButton}
        isLoading={Boolean(isLoading || isPending)}
        tone={isOwned ? 'secondary' : 'accent'}
        type="button"
        onClick={onToggle}
      >
        {isLoading ? 'Checking owned state...' : isPending ? 'Saving...' : actionLabel}
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
