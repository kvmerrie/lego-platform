import {
  DUTCH_REGION_CODE,
  EURO_CURRENCY_CODE,
  NEW_OFFER_CONDITION,
  PRICING_HISTORY_TABLE,
  type PriceHistoryPoint,
  type PriceHistorySummary,
  type PricePanelSnapshot,
  type PricingObservation,
  type FeaturedSetPriceContext,
  type TrackedPriceSummary,
} from '@lego-platform/pricing/util';
import { hasBrowserSupabaseConfig } from '@lego-platform/shared/config';
import { getBrowserSupabaseClient } from '@lego-platform/shared/data-access-auth';
import { pricePanelSnapshots } from './price-panel-snapshots.generated';
import { pricingObservations } from './pricing-observations.generated';

const pricePanelSnapshotBySetId = new Map(
  pricePanelSnapshots.map((pricePanelSnapshot) => [
    pricePanelSnapshot.setId,
    pricePanelSnapshot,
  ]),
);

function getCandidateRank(
  setId: string,
  candidateSetIds?: readonly string[],
): number {
  if (!candidateSetIds?.length) {
    return Number.MAX_SAFE_INTEGER;
  }

  const rank = candidateSetIds.indexOf(setId);

  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

interface PriceHistoryRowRecord {
  condition: string;
  currency_code: string;
  headline_price_minor: number;
  lowest_merchant_id: string | null;
  observed_at: string;
  recorded_on: string;
  reference_price_minor: number | null;
  region_code: string;
  set_id: string;
}

export interface PriceHistorySummaryState {
  pointCount: number;
  priceHistorySummary?: PriceHistorySummary;
  trackedPriceSummary?: TrackedPriceSummary;
}

export function getPricePanelSnapshot(
  setId: string,
): PricePanelSnapshot | undefined {
  return pricePanelSnapshotBySetId.get(setId);
}

export function getFeaturedSetPriceContext(
  setId: string,
): FeaturedSetPriceContext | undefined {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return undefined;
  }

  return {
    setId: pricePanelSnapshot.setId,
    currencyCode: pricePanelSnapshot.currencyCode,
    headlinePriceMinor: pricePanelSnapshot.headlinePriceMinor,
    referencePriceMinor: pricePanelSnapshot.referencePriceMinor,
    deltaMinor: pricePanelSnapshot.deltaMinor,
    merchantName: pricePanelSnapshot.lowestMerchantName,
    merchantCount: pricePanelSnapshot.merchantCount,
    availabilityLabel: pricePanelSnapshot.lowestAvailabilityLabel,
    observedAt: pricePanelSnapshot.observedAt,
  };
}

export function listReviewedPriceSetIds(): string[] {
  return [
    ...new Set(
      pricePanelSnapshots.map((pricePanelSnapshot) => pricePanelSnapshot.setId),
    ),
  ];
}

export function listDealSpotlightPriceContexts({
  candidateSetIds,
  limit = 4,
}: {
  candidateSetIds?: readonly string[];
  limit?: number;
} = {}): FeaturedSetPriceContext[] {
  return pricePanelSnapshots
    .flatMap((pricePanelSnapshot) => {
      if (
        typeof pricePanelSnapshot.deltaMinor !== 'number' ||
        pricePanelSnapshot.deltaMinor >= 0
      ) {
        return [];
      }

      if (
        candidateSetIds?.length &&
        !candidateSetIds.includes(pricePanelSnapshot.setId)
      ) {
        return [];
      }

      return [
        {
          setId: pricePanelSnapshot.setId,
          currencyCode: pricePanelSnapshot.currencyCode,
          headlinePriceMinor: pricePanelSnapshot.headlinePriceMinor,
          referencePriceMinor: pricePanelSnapshot.referencePriceMinor,
          deltaMinor: pricePanelSnapshot.deltaMinor,
          merchantName: pricePanelSnapshot.lowestMerchantName,
          merchantCount: pricePanelSnapshot.merchantCount,
          availabilityLabel: pricePanelSnapshot.lowestAvailabilityLabel,
          observedAt: pricePanelSnapshot.observedAt,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.deltaMinor - right.deltaMinor ||
        right.merchantCount - left.merchantCount ||
        getCandidateRank(left.setId, candidateSetIds) -
          getCandidateRank(right.setId, candidateSetIds) ||
        right.headlinePriceMinor - left.headlinePriceMinor ||
        left.setId.localeCompare(right.setId),
    )
    .slice(0, limit);
}

export function listPricingObservations(setId: string): PricingObservation[] {
  return pricingObservations.filter(
    (pricingObservation) => pricingObservation.setId === setId,
  );
}

export function buildPriceHistorySummary({
  currentHeadlinePriceMinor,
  priceHistoryPoints,
}: {
  currentHeadlinePriceMinor: number;
  priceHistoryPoints: readonly PriceHistoryPoint[];
}): PriceHistorySummary | undefined {
  if (priceHistoryPoints.length < 2) {
    return undefined;
  }

  const values = priceHistoryPoints.map(
    (priceHistoryPoint) => priceHistoryPoint.headlinePriceMinor,
  );
  const averagePriceMinor = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  const firstPriceHistoryPoint = priceHistoryPoints[0];

  if (!firstPriceHistoryPoint) {
    return undefined;
  }

  return {
    currencyCode: firstPriceHistoryPoint.currencyCode,
    currentHeadlinePriceMinor,
    averagePriceMinor,
    deltaVsAverageMinor: currentHeadlinePriceMinor - averagePriceMinor,
    lowPriceMinor: Math.min(...values),
    highPriceMinor: Math.max(...values),
    pointCount: priceHistoryPoints.length,
  };
}

export function buildTrackedPriceSummary({
  currentHeadlinePriceMinor,
  priceHistoryPoints,
}: {
  currentHeadlinePriceMinor: number;
  priceHistoryPoints: readonly PriceHistoryPoint[];
}): TrackedPriceSummary | undefined {
  const firstPriceHistoryPoint = priceHistoryPoints[0];

  if (!firstPriceHistoryPoint) {
    return undefined;
  }

  const values = priceHistoryPoints.map(
    (priceHistoryPoint) => priceHistoryPoint.headlinePriceMinor,
  );
  const trackedLowPriceMinor = Math.min(...values);
  const trackedHighPriceMinor = Math.max(...values);

  return {
    currencyCode: firstPriceHistoryPoint.currencyCode,
    currentHeadlinePriceMinor,
    deltaVsTrackedLowMinor: currentHeadlinePriceMinor - trackedLowPriceMinor,
    deltaVsTrackedHighMinor: currentHeadlinePriceMinor - trackedHighPriceMinor,
    pointCount: priceHistoryPoints.length,
    trackedHighPriceMinor,
    trackedLowPriceMinor,
    trackedSinceRecordedOn: firstPriceHistoryPoint.recordedOn,
  };
}

function normalizePriceHistoryRowRecord(
  priceHistoryRowRecord: PriceHistoryRowRecord,
): PriceHistoryPoint | undefined {
  if (
    priceHistoryRowRecord.region_code !== DUTCH_REGION_CODE ||
    priceHistoryRowRecord.currency_code !== EURO_CURRENCY_CODE ||
    priceHistoryRowRecord.condition !== NEW_OFFER_CONDITION
  ) {
    return undefined;
  }

  if (
    !priceHistoryRowRecord.set_id ||
    !Number.isInteger(priceHistoryRowRecord.headline_price_minor) ||
    priceHistoryRowRecord.headline_price_minor <= 0 ||
    !priceHistoryRowRecord.recorded_on ||
    !priceHistoryRowRecord.observed_at
  ) {
    return undefined;
  }

  return {
    setId: priceHistoryRowRecord.set_id,
    regionCode: DUTCH_REGION_CODE,
    currencyCode: EURO_CURRENCY_CODE,
    condition: NEW_OFFER_CONDITION,
    headlinePriceMinor: priceHistoryRowRecord.headline_price_minor,
    referencePriceMinor:
      typeof priceHistoryRowRecord.reference_price_minor === 'number'
        ? priceHistoryRowRecord.reference_price_minor
        : undefined,
    lowestMerchantId: priceHistoryRowRecord.lowest_merchant_id ?? undefined,
    observedAt: priceHistoryRowRecord.observed_at,
    recordedOn: priceHistoryRowRecord.recorded_on,
  };
}

export async function listPriceHistory(
  setId: string,
): Promise<PriceHistoryPoint[]> {
  if (!hasBrowserSupabaseConfig()) {
    return [];
  }

  const { data, error } = await getBrowserSupabaseClient()
    .from(PRICING_HISTORY_TABLE)
    .select(
      'set_id, region_code, currency_code, condition, headline_price_minor, reference_price_minor, lowest_merchant_id, observed_at, recorded_on',
    )
    .eq('set_id', setId)
    .eq('region_code', DUTCH_REGION_CODE)
    .eq('currency_code', EURO_CURRENCY_CODE)
    .eq('condition', NEW_OFFER_CONDITION)
    .order('recorded_on', { ascending: false })
    .limit(30);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((priceHistoryRowRecord) =>
      normalizePriceHistoryRowRecord(
        priceHistoryRowRecord as PriceHistoryRowRecord,
      ),
    )
    .filter(
      (priceHistoryPoint): priceHistoryPoint is PriceHistoryPoint =>
        priceHistoryPoint !== undefined,
    )
    .reverse();
}

export async function listTrackedPriceHistory(
  setId: string,
): Promise<PriceHistoryPoint[]> {
  if (!hasBrowserSupabaseConfig()) {
    return [];
  }

  const { data, error } = await getBrowserSupabaseClient()
    .from(PRICING_HISTORY_TABLE)
    .select(
      'set_id, region_code, currency_code, condition, headline_price_minor, reference_price_minor, lowest_merchant_id, observed_at, recorded_on',
    )
    .eq('set_id', setId)
    .eq('region_code', DUTCH_REGION_CODE)
    .eq('currency_code', EURO_CURRENCY_CODE)
    .eq('condition', NEW_OFFER_CONDITION)
    .order('recorded_on', { ascending: true })
    .limit(5000);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((priceHistoryRowRecord) =>
      normalizePriceHistoryRowRecord(
        priceHistoryRowRecord as PriceHistoryRowRecord,
      ),
    )
    .filter(
      (priceHistoryPoint): priceHistoryPoint is PriceHistoryPoint =>
        priceHistoryPoint !== undefined,
    );
}

export async function getPriceHistorySummary(
  setId: string,
): Promise<PriceHistorySummary | undefined> {
  const priceHistorySummaryState = await getPriceHistorySummaryState(setId);

  return priceHistorySummaryState?.priceHistorySummary;
}

export async function getPriceHistorySummaryState(
  setId: string,
): Promise<PriceHistorySummaryState | undefined> {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return undefined;
  }

  const trackedPriceHistoryPoints = await listTrackedPriceHistory(setId);
  const priceHistoryPoints = trackedPriceHistoryPoints.slice(-30);

  return {
    pointCount: priceHistoryPoints.length,
    priceHistorySummary: buildPriceHistorySummary({
      currentHeadlinePriceMinor: pricePanelSnapshot.headlinePriceMinor,
      priceHistoryPoints,
    }),
    trackedPriceSummary: buildTrackedPriceSummary({
      currentHeadlinePriceMinor: pricePanelSnapshot.headlinePriceMinor,
      priceHistoryPoints: trackedPriceHistoryPoints,
    }),
  };
}
