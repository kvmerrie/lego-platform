'use client';

import {
  buildSetPriceInsights,
  getPriceHistorySummaryState,
  getPricePanelSnapshot,
  listPriceHistory,
} from '@lego-platform/pricing/data-access';
import {
  PriceHistoryCard,
  PriceDecisionSummaryCard,
  PriceHistoryEmptyCard,
} from '@lego-platform/pricing/ui';
import type { PriceHistoryPoint } from '@lego-platform/pricing/util';
import { useEffect, useState } from 'react';

export function PricingFeaturePriceHistory({
  hasCurrentOffer = false,
  merchantCount,
  setId,
  variant = 'default',
}: {
  hasCurrentOffer?: boolean;
  merchantCount?: number;
  setId: string;
  variant?: 'default' | 'set-detail';
}) {
  const [priceHistoryPoints, setPriceHistoryPoints] = useState<
    readonly PriceHistoryPoint[] | undefined
  >(undefined);
  const [priceHistorySummaryState, setPriceHistorySummaryState] =
    useState<Awaited<ReturnType<typeof getPriceHistorySummaryState>>>(
      undefined,
    );

  useEffect(() => {
    let isActive = true;

    void Promise.all([
      listPriceHistory(setId),
      getPriceHistorySummaryState(setId),
    ])
      .then(([nextPriceHistoryPoints, nextPriceHistorySummaryState]) => {
        if (!isActive) {
          return;
        }

        setPriceHistoryPoints(nextPriceHistoryPoints);
        setPriceHistorySummaryState(nextPriceHistorySummaryState);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setPriceHistoryPoints([]);
        setPriceHistorySummaryState(undefined);
      });

    return () => {
      isActive = false;
    };
  }, [setId]);

  if (variant === 'set-detail') {
    const insights = buildSetPriceInsights({
      hasCurrentOffer,
      merchantCount,
      priceHistorySummaryState: priceHistorySummaryState ?? undefined,
      pricePanelSnapshot: getPricePanelSnapshot(setId),
    });

    return (
      <>
        <PriceDecisionSummaryCard insights={insights} />
        {!priceHistoryPoints ? (
          <PriceHistoryEmptyCard id="pricing-history" isLoading />
        ) : priceHistoryPoints.length === 0 ? (
          <PriceHistoryEmptyCard id="pricing-history" />
        ) : (
          <PriceHistoryCard
            id="pricing-history"
            priceHistoryPoints={priceHistoryPoints}
          />
        )}
      </>
    );
  }

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
