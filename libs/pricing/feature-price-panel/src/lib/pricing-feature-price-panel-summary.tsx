'use client';

import {
  getPriceHistorySummaryState,
  type PriceHistorySummaryState,
} from '@lego-platform/pricing/data-access';
import { PriceHistorySummaryCallout } from '@lego-platform/pricing/ui';
import { useEffect, useState } from 'react';

export function PricingFeaturePricePanelSummary({ setId }: { setId: string }) {
  const [priceHistorySummaryState, setPriceHistorySummaryState] = useState<
    PriceHistorySummaryState | null | undefined
  >(undefined);

  useEffect(() => {
    let isDisposed = false;

    void getPriceHistorySummaryState(setId)
      .then((nextPriceHistorySummaryState) => {
        if (!isDisposed) {
          setPriceHistorySummaryState(nextPriceHistorySummaryState ?? null);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setPriceHistorySummaryState(null);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [setId]);

  if (priceHistorySummaryState === undefined) {
    return null;
  }

  return (
    <PriceHistorySummaryCallout
      historyPointCount={priceHistorySummaryState?.pointCount}
      priceHistorySummary={priceHistorySummaryState?.priceHistorySummary}
      trackedPriceSummary={priceHistorySummaryState?.trackedPriceSummary}
    />
  );
}
