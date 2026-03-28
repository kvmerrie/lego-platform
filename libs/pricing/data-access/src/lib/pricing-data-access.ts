import {
  PriceHistoryPoint,
  PricePanelSnapshot,
} from '@lego-platform/pricing/util';

const pricePanelSnapshot: PricePanelSnapshot = {
  setName: 'Rivendell',
  currentMarketValue: '$541',
  msrp: '$499',
  delta: '+8.4%',
  confidence: 'High confidence from direct-to-consumer and reseller blends.',
};

const priceHistory: readonly PriceHistoryPoint[] = [
  { label: 'Jan', value: 498, annotation: 'Launch floor' },
  { label: 'Feb', value: 504, annotation: 'Early secondary demand' },
  { label: 'Mar', value: 517, annotation: 'Collector content lift' },
  { label: 'Apr', value: 541, annotation: 'Current reference point' },
];

export function getPricePanelSnapshot(): PricePanelSnapshot {
  return pricePanelSnapshot;
}

export function listPriceHistory(): PriceHistoryPoint[] {
  return [...priceHistory];
}
