import { CollectionShelf } from '@lego-platform/collection/util';
import { MetricCard } from '@lego-platform/shared/types';

export function CollectionMetricCard({
  metricCard,
}: {
  metricCard: MetricCard;
}) {
  return (
    <article className="metric-card">
      <p className="eyebrow">{metricCard.label}</p>
      <h3 className="metric-value">{metricCard.value}</h3>
      {metricCard.detail ? <p className="muted">{metricCard.detail}</p> : null}
    </article>
  );
}

export function CollectionShelfCard({
  collectionShelf,
}: {
  collectionShelf: CollectionShelf;
}) {
  return (
    <article className="surface stack">
      <div className="split-row">
        <h3 className="surface-title">{collectionShelf.name}</h3>
        <span className="pill">{collectionShelf.completion}</span>
      </div>
      <p>{collectionShelf.focus}</p>
      <p className="muted">{collectionShelf.notes}</p>
    </article>
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
    <article className="surface split-card">
      <div className="stack">
        <p className="eyebrow">Owned status</p>
        <h2 className="surface-title">{title}</h2>
        <p className="muted">
          Set {setId} keeps an independent owned flag, separate from wanted
          state.
        </p>
        {errorMessage ? <p className="muted">{errorMessage}</p> : null}
      </div>
      <button
        className="action-button"
        disabled={Boolean(isLoading || isPending)}
        type="button"
        onClick={onToggle}
      >
        {isLoading ? 'Checking owned state...' : isPending ? 'Saving...' : actionLabel}
      </button>
    </article>
  );
}

export function CollectionUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">Collection UI</p>
      <h2 className="surface-title">
        Display metrics, shelves, and curation surfaces without embedding
        business rules.
      </h2>
    </section>
  );
}

export default CollectionUi;
