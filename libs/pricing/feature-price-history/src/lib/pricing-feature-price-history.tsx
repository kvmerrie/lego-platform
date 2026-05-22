'use client';

import {
  alignPriceHistoryWithCurrentOffer,
  buildSetPriceInsights,
  type CurrentOfferPriceHistoryPointInput,
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
  currentOffer,
  hasCurrentOffer = false,
  merchantCount,
  setId,
  variant = 'default',
}: {
  currentOffer?: CurrentOfferPriceHistoryPointInput;
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

        const alignedPriceHistory = alignPriceHistoryWithCurrentOffer({
          currentOffer,
          priceHistoryPoints: nextPriceHistoryPoints,
          priceHistorySummaryState: nextPriceHistorySummaryState,
        });

        if (shouldLogPriceHistoryAlignment(alignedPriceHistory.diagnostics)) {
          console.info('[price-history-alignment]', {
            action: alignedPriceHistory.diagnostics.action,
            currentBestOfferMerchantId:
              alignedPriceHistory.diagnostics.currentBestOfferMerchantId,
            currentBestOfferPriceMinor:
              alignedPriceHistory.diagnostics.currentBestOfferPriceMinor,
            latestHistoryMerchantId:
              alignedPriceHistory.diagnostics.latestHistoryMerchantId,
            latestHistoryPriceMinor:
              alignedPriceHistory.diagnostics.latestHistoryPriceMinor,
            latestHistoryRecordedOn:
              alignedPriceHistory.diagnostics.latestHistoryRecordedOn,
            set_id: alignedPriceHistory.diagnostics.setId,
          });
        }

        setPriceHistoryPoints(alignedPriceHistory.priceHistoryPoints);
        setPriceHistorySummaryState(
          alignedPriceHistory.priceHistorySummaryState,
        );
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
  }, [currentOffer, setId]);

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

function shouldLogPriceHistoryAlignment(
  diagnostics: ReturnType<
    typeof alignPriceHistoryWithCurrentOffer
  >['diagnostics'],
): boolean {
  if (diagnostics.action === 'unchanged') {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return (
      window.localStorage.getItem('brickhunt:debug-price-history-alignment') ===
      'true'
    );
  } catch {
    return false;
  }
}

export default PricingFeaturePriceHistory;
