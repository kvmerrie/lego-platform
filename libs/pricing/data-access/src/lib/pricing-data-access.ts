import {
  type PriceHistoryPoint,
  type PricePanelSnapshot,
  type PricingObservation,
} from '@lego-platform/pricing/util';
import { pricePanelSnapshots } from './price-panel-snapshots.generated';
import { pricingObservations } from './pricing-observations.generated';

const pricePanelSnapshotBySetId = new Map(
  pricePanelSnapshots.map((pricePanelSnapshot) => [
    pricePanelSnapshot.setId,
    pricePanelSnapshot,
  ]),
);

const placeholderPriceHistory: readonly PriceHistoryPoint[] = [
  { label: 'Jan', value: 0, annotation: 'Pricing history is intentionally out of scope for this phase.' },
];

export function getPricePanelSnapshot(
  setId: string,
): PricePanelSnapshot | undefined {
  return pricePanelSnapshotBySetId.get(setId);
}

export function listPricingObservations(setId: string): PricingObservation[] {
  return pricingObservations.filter(
    (pricingObservation) => pricingObservation.setId === setId,
  );
}

export function listPriceHistory(): PriceHistoryPoint[] {
  return [...placeholderPriceHistory];
}
