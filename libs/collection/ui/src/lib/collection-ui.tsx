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
