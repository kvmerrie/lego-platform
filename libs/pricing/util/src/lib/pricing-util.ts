import { TimelinePoint } from '@lego-platform/shared/types';

export interface PricePanelSnapshot {
  setName: string;
  currentMarketValue: string;
  msrp: string;
  delta: string;
  confidence: string;
}

export type PriceHistoryPoint = TimelinePoint;

export function getPriceDirection(delta: string): 'up' | 'down' | 'flat' {
  if (delta.startsWith('+')) {
    return 'up';
  }

  if (delta.startsWith('-')) {
    return 'down';
  }

  return 'flat';
}
