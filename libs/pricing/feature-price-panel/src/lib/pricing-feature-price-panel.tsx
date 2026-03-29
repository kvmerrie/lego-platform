import { getPricePanelSnapshot } from '@lego-platform/pricing/data-access';
import {
  PriceSummaryCard,
  PricingUnavailableCard,
} from '@lego-platform/pricing/ui';
import { PricingFeaturePricePanelSummary } from './pricing-feature-price-panel-summary';

export function PricingFeaturePricePanel({ setId }: { setId: string }) {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return <PricingUnavailableCard id="pricing" />;
  }

  return (
    <PriceSummaryCard id="pricing" pricePanelSnapshot={pricePanelSnapshot}>
      <PricingFeaturePricePanelSummary setId={setId} />
    </PriceSummaryCard>
  );
}

export default PricingFeaturePricePanel;
