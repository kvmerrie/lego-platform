import { getPricePanelSnapshot } from '@lego-platform/pricing/data-access';
import {
  ProductPricingUnavailableCard,
  PriceSummaryCard,
  PricingUnavailableCard,
} from '@lego-platform/pricing/ui';
import { PricingFeaturePricePanelSummary } from './pricing-feature-price-panel-summary';

export function PricingFeaturePricePanel({
  setId,
  variant = 'default',
}: {
  setId: string;
  variant?: 'default' | 'product';
}) {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return variant === 'product' ? (
      <ProductPricingUnavailableCard id="pricing" />
    ) : (
      <PricingUnavailableCard id="pricing" />
    );
  }

  if (variant === 'product') {
    return (
      <PriceSummaryCard
        id="pricing"
        pricePanelSnapshot={pricePanelSnapshot}
        variant="product"
      />
    );
  }

  return (
    <PriceSummaryCard id="pricing" pricePanelSnapshot={pricePanelSnapshot}>
      <PricingFeaturePricePanelSummary setId={setId} />
    </PriceSummaryCard>
  );
}

export default PricingFeaturePricePanel;
