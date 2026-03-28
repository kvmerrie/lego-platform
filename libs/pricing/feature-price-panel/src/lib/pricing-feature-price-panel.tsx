import { getPricePanelSnapshot } from '@lego-platform/pricing/data-access';
import { getPriceDirection } from '@lego-platform/pricing/util';
import { PriceSummaryCard } from '@lego-platform/pricing/ui';

export function PricingFeaturePricePanel() {
  const pricePanelSnapshot = getPricePanelSnapshot();
  const priceDirection = getPriceDirection(pricePanelSnapshot.delta);

  return (
    <section id="pricing" className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Price panel</p>
        <h2>
          Pricing intelligence is isolated behind reusable data-access and UI
          boundaries.
        </h2>
        <p className="section-copy">
          Today this is static reference data. Tomorrow it can become
          Supabase-backed history without changing the public-facing composition
          layer.
        </p>
      </header>
      <div className="surface-grid">
        <PriceSummaryCard pricePanelSnapshot={pricePanelSnapshot} />
        <article className="surface stack">
          <p className="eyebrow">Signal</p>
          <h3 className="surface-title">Direction: {priceDirection}</h3>
          <p className="muted">Delta reference: {pricePanelSnapshot.delta}</p>
        </article>
      </div>
    </section>
  );
}

export default PricingFeaturePricePanel;
