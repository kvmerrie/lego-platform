import {
  formatPriceMinor,
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
      <p className="eyebrow">Set {pricePanelSnapshot.setId}</p>
      <h3 className="metric-value">
        {formatPriceMinor({
          currencyCode: pricePanelSnapshot.currencyCode,
          minorUnits: pricePanelSnapshot.headlinePriceMinor,
        })}
      </h3>
      <p className="muted">
        Lowest merchant {pricePanelSnapshot.lowestMerchantId} · {pricePanelSnapshot.merchantCount} offers
      </p>
      {typeof pricePanelSnapshot.referencePriceMinor === 'number' ? (
        <p>
          Reference{' '}
          {formatPriceMinor({
            currencyCode: pricePanelSnapshot.currencyCode,
            minorUnits: pricePanelSnapshot.referencePriceMinor,
          })}
        </p>
      ) : null}
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
        Presentational cards and rows for Dutch-market current-price guidance.
      </h2>
    </section>
  );
}

export default PricingUi;
