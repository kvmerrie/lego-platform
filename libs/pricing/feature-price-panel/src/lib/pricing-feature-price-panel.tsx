import { getPricePanelSnapshot } from '@lego-platform/pricing/data-access';
import { formatPriceMinor, getPriceDirection } from '@lego-platform/pricing/util';
import { PriceSummaryCard } from '@lego-platform/pricing/ui';

export function PricingFeaturePricePanel({ setId }: { setId: string }) {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return null;
  }

  const priceDirection = getPriceDirection(pricePanelSnapshot.deltaMinor);

  return (
    <section id="pricing" className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Price panel</p>
        <h2>
          Pricing intelligence is isolated behind reusable data-access and UI
          boundaries.
        </h2>
        <p className="section-copy">
          Today this is a generated Dutch current-price snapshot. History and
          broader market coverage remain intentionally out of scope.
        </p>
      </header>
      <div className="surface-grid">
        <PriceSummaryCard pricePanelSnapshot={pricePanelSnapshot} />
        <article className="surface stack">
          <p className="eyebrow">Signal</p>
          <h3 className="surface-title">Direction: {priceDirection}</h3>
          {typeof pricePanelSnapshot.deltaMinor === 'number' ? (
            <p className="muted">
              Delta reference:{' '}
              {formatPriceMinor({
                currencyCode: pricePanelSnapshot.currencyCode,
                minorUnits: Math.abs(pricePanelSnapshot.deltaMinor),
              })}
            </p>
          ) : (
            <p className="muted">Reference pricing is not configured yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}

export default PricingFeaturePricePanel;
