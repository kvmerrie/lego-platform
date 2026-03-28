import { listPriceHistory } from '@lego-platform/pricing/data-access';
import { PriceHistoryRow } from '@lego-platform/pricing/ui';

export function PricingFeaturePriceHistory() {
  const priceHistory = listPriceHistory();

  return (
    <section className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Price history</p>
        <h2>
          Small, typed time-series slices that can later be swapped for
          persisted history.
        </h2>
      </header>
      <article className="surface stack">
        <ul className="list">
          {priceHistory.map((priceHistoryPoint) => (
            <PriceHistoryRow
              key={priceHistoryPoint.label}
              priceHistoryPoint={priceHistoryPoint}
            />
          ))}
        </ul>
      </article>
    </section>
  );
}

export default PricingFeaturePriceHistory;
