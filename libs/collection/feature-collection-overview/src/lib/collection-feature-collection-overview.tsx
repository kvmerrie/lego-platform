import {
  getCollectionSnapshot,
  listCollectionShelves,
} from '@lego-platform/collection/data-access';
import { buildCollectionMetrics } from '@lego-platform/collection/util';
import {
  CollectionMetricCard,
  CollectionShelfCard,
} from '@lego-platform/collection/ui';

export function CollectionFeatureCollectionOverview() {
  const collectionSnapshot = getCollectionSnapshot();
  const collectionMetrics = buildCollectionMetrics(collectionSnapshot);
  const collectionShelves = listCollectionShelves();

  return (
    <section id="collection" className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Collection overview</p>
        <h2>Collection health lives in libraries, not page files.</h2>
        <p className="section-copy">
          Metrics, shelf summaries, and valuation posture are surfaced through
          domain-owned libraries so future native and admin clients can reuse
          the same contracts.
        </p>
      </header>
      <div className="metric-grid">
        {collectionMetrics.map((collectionMetric) => (
          <CollectionMetricCard
            key={collectionMetric.label}
            metricCard={collectionMetric}
          />
        ))}
      </div>
      <div className="surface-grid">
        {collectionShelves.map((collectionShelf) => (
          <CollectionShelfCard
            key={collectionShelf.name}
            collectionShelf={collectionShelf}
          />
        ))}
      </div>
    </section>
  );
}

export default CollectionFeatureCollectionOverview;
