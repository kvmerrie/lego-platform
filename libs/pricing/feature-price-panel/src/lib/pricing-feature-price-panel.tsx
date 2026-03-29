import { getPricePanelSnapshot } from '@lego-platform/pricing/data-access';
import {
  PriceSummaryCard,
  PricingUnavailableCard,
} from '@lego-platform/pricing/ui';

export function PricingFeaturePricePanel({ setId }: { setId: string }) {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return <PricingUnavailableCard id="pricing" />;
  }

  return <PriceSummaryCard id="pricing" pricePanelSnapshot={pricePanelSnapshot} />;
}

export default PricingFeaturePricePanel;
