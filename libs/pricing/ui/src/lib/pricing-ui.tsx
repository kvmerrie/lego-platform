import {
  PriceHistoryPoint,
  PricePanelSnapshot,
} from '@lego-platform/pricing/util';

export function PriceSummaryCard({
  pricePanelSnapshot,
}: {
  pricePanelSnapshot: PricePanelSnapshot;
}) {
  return (
    <article className="surface stack">
      <p className="eyebrow">{pricePanelSnapshot.setName}</p>
      <h3 className="metric-value">{pricePanelSnapshot.currentMarketValue}</h3>
      <p className="muted">
        MSRP {pricePanelSnapshot.msrp} · Delta {pricePanelSnapshot.delta}
      </p>
      <p>{pricePanelSnapshot.confidence}</p>
    </article>
  );
}

export function PriceHistoryRow({
  priceHistoryPoint,
}: {
  priceHistoryPoint: PriceHistoryPoint;
}) {
  return (
    <li className="split-row dense-row">
      <span>{priceHistoryPoint.label}</span>
      <span className="mono">${priceHistoryPoint.value}</span>
      <span className="muted">{priceHistoryPoint.annotation}</span>
    </li>
  );
}

export function PricingUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">Pricing UI</p>
      <h2 className="surface-title">
        Presentational cards and history rows for market intelligence.
      </h2>
    </section>
  );
}

export default PricingUi;
