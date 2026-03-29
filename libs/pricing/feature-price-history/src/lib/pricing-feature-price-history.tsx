'use client';

import { listPriceHistory } from '@lego-platform/pricing/data-access';
import {
  PriceHistoryCard,
  PriceHistoryEmptyCard,
} from '@lego-platform/pricing/ui';
import type { PriceHistoryPoint } from '@lego-platform/pricing/util';
import { useEffect, useState } from 'react';

export function PricingFeaturePriceHistory({ setId }: { setId: string }) {
  const [priceHistoryPoints, setPriceHistoryPoints] = useState<
    readonly PriceHistoryPoint[] | undefined
  >(undefined);

  useEffect(() => {
    let isActive = true;

    void listPriceHistory(setId)
      .then((nextPriceHistoryPoints) => {
        if (isActive) {
          setPriceHistoryPoints(nextPriceHistoryPoints);
        }
      })
      .catch(() => {
        if (isActive) {
          setPriceHistoryPoints([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [setId]);

  if (!priceHistoryPoints) {
    return <PriceHistoryEmptyCard id="pricing-history" isLoading />;
  }

  if (priceHistoryPoints.length === 0) {
    return <PriceHistoryEmptyCard id="pricing-history" />;
  }

  return (
    <PriceHistoryCard
      id="pricing-history"
      priceHistoryPoints={priceHistoryPoints}
    />
  );
}

export default PricingFeaturePriceHistory;
