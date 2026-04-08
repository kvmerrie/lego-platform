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
  type SetDealVerdict,
  type SetPriceInsight,
  type TrackedPriceSummary,
  formatPriceMinor,
  getPriceDealSummary,
} from '@lego-platform/pricing/util';
import {
  getDefaultFormattingLocale,
  hasBrowserSupabaseConfig,
} from '@lego-platform/shared/config';
import { getBrowserSupabaseClient } from '@lego-platform/shared/data-access-auth';
import { pricePanelSnapshots } from './price-panel-snapshots.generated';
import { pricingObservations } from './pricing-observations.generated';

const pricePanelSnapshotBySetId = new Map(
  pricePanelSnapshots.map((pricePanelSnapshot) => [
    pricePanelSnapshot.setId,
    pricePanelSnapshot,
  ]),
);

export interface ReviewedPriceSummary {
  availabilityLabel?: string;
  coverageLabel: string;
  coverageNote?: string;
  currentPrice: string;
  dealLabel: string;
  merchantLabel: string;
  pricePositionLabel?: string;
  reviewedLabel: string;
}

export interface WishlistPriceAlert {
  detail: string;
  kind: 'new-best-price' | 'price-improved-since-save' | 'strong-deal-now';
  label: string;
  tone: 'accent' | 'positive';
}

export interface WishlistPriceAlertSummary {
  activeCount: number;
  newBestPriceCount: number;
  priceImprovedSinceSaveCount: number;
  strongDealCount: number;
}

export interface WishlistAlertNotificationState {
  lastNotifiedAt?: string;
  lastNotifiedKind?: WishlistPriceAlert['kind'];
}

export interface WishlistAlertNotificationCandidate extends WishlistPriceAlert {
  cooldownDays: number;
  cooldownEndsAt?: string;
  dedupeKey: string;
  evaluatedAt: string;
  isNewlyNotifiable: boolean;
  notificationReason?:
    | 'cooldown-expired'
    | 'first-signal'
    | 'higher-priority-signal';
  priority: 1 | 2 | 3;
  signalObservedAt?: string;
  setId: string;
  suppressionReason?: 'cooldown-active';
  supersedesPreviousKind?: WishlistPriceAlert['kind'];
}

export const DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS = 14;

export interface WishlistNewAlertSummary {
  newCount: number;
  newBestPriceCount: number;
  priceImprovedSinceSaveCount: number;
  strongDealCount: number;
}

export interface SetDecisionSupportItem {
  id:
    | 'best-price-now'
    | 'brickhunt-alerts'
    | 'brickhunt-guidance'
    | 'brickhunt-monitoring'
    | 'limited-data'
    | 'merchant-coverage'
    | 'price-above-normal'
    | 'price-below-normal'
    | 'price-normal';
  text: string;
}

function formatReviewedOn(observedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(observedAt));
}

function getReviewedOfferLabel(merchantCount: number): string {
  return `${merchantCount} reviewed aanbieding${merchantCount === 1 ? '' : 'en'}`;
}

function getPricePositionLabel({
  currencyCode,
  deltaMinor,
}: {
  currencyCode: string;
  deltaMinor?: number;
}): string | undefined {
  if (typeof deltaMinor !== 'number') {
    return undefined;
  }

  if (deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} onder referentie`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} boven referentie`;
  }

  return 'Op referentie';
}

function getAlertCoverageLabel(pricePanelSnapshot: PricePanelSnapshot): string {
  return (
    pricePanelSnapshot.lowestAvailabilityLabel ??
    getReviewedOfferLabel(pricePanelSnapshot.merchantCount)
  );
}

function getCurrentPriceLabel(pricePanelSnapshot: PricePanelSnapshot): string {
  return formatPriceMinor({
    currencyCode: pricePanelSnapshot.currencyCode,
    minorUnits: pricePanelSnapshot.headlinePriceMinor,
  });
}

function getWishlistAlertPriority(kind: WishlistPriceAlert['kind']): 1 | 2 | 3 {
  switch (kind) {
    case 'new-best-price':
      return 3;
    case 'price-improved-since-save':
      return 2;
    case 'strong-deal-now':
      return 1;
  }
}

function parseTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function addDaysToTimestamp(timestamp: number, days: number): string {
  return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString();
}

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

export function buildSetDealVerdict(
  pricePanelSnapshot?: Pick<PricePanelSnapshot, 'deltaMinor'>,
): SetDealVerdict {
  if (
    !pricePanelSnapshot ||
    typeof pricePanelSnapshot.deltaMinor !== 'number'
  ) {
    return {
      explanation:
        'We volgen nog te weinig prijzen om te zeggen of dit een slim koopmoment is.',
      label: 'Nog te weinig data',
      tone: 'neutral',
    };
  }

  if (pricePanelSnapshot.deltaMinor < 0) {
    return {
      explanation:
        'Deze set zit onder wat we meestal zien. Kopen is nu logisch als je hem wilt hebben.',
      label: 'Nu interessant geprijsd',
      tone: 'positive',
    };
  }

  if (pricePanelSnapshot.deltaMinor > 0) {
    return {
      explanation:
        'Deze prijs ligt boven wat we meestal zien. Volgen en wachten is slimmer.',
      label: 'Nog niet bijzonder',
      tone: 'warning',
    };
  }

  return {
    explanation:
      'Prima prijs, maar niet opvallend laag. Alleen kopen als je nu wilt instappen.',
    label: 'Rond normaal',
    tone: 'info',
  };
}

export function buildSetDecisionSupportItems({
  hasCurrentOffer = false,
  merchantCount,
  pricePanelSnapshot,
}: {
  hasCurrentOffer?: boolean;
  merchantCount?: number;
  pricePanelSnapshot?: Pick<PricePanelSnapshot, 'deltaMinor' | 'merchantCount'>;
}): SetDecisionSupportItem[] {
  const trackedMerchantCount =
    merchantCount ?? pricePanelSnapshot?.merchantCount;
  const items: SetDecisionSupportItem[] = [];

  if (!pricePanelSnapshot) {
    items.push({
      id: 'limited-data',
      text: hasCurrentOffer
        ? 'We hebben nog beperkte data, maar dit is nu de beste deal die we zien.'
        : 'We hebben nog weinig prijsdata voor deze set.',
    });

    if (typeof trackedMerchantCount === 'number' && trackedMerchantCount > 0) {
      items.push({
        id: 'merchant-coverage',
        text: `We volgen ${trackedMerchantCount} Nederlandse winkel${
          trackedMerchantCount === 1 ? '' : 's'
        } voor deze set.`,
      });
    }

    items.push({
      id: 'brickhunt-guidance',
      text: 'Met meer data wordt dit advies scherper.',
    });

    return items.slice(0, 3);
  }

  if (typeof pricePanelSnapshot.deltaMinor === 'number') {
    if (pricePanelSnapshot.deltaMinor < 0) {
      items.push({
        id: 'price-below-normal',
        text: 'Deze prijs ligt onder wat we meestal zien.',
      });
    } else if (pricePanelSnapshot.deltaMinor > 0) {
      items.push({
        id: 'price-above-normal',
        text: 'Deze prijs ligt boven wat we meestal zien.',
      });
    } else {
      items.push({
        id: 'price-normal',
        text: 'Deze prijs zit rond wat we meestal zien.',
      });
    }
  } else {
    items.push({
      id: 'limited-data',
      text: 'We hebben nog beperkte data, maar dit is nu de beste deal die we zien.',
    });
  }

  if (hasCurrentOffer) {
    items.push({
      id: 'best-price-now',
      text:
        typeof trackedMerchantCount === 'number' && trackedMerchantCount > 1
          ? 'Dit is momenteel de scherpste prijs die we volgen.'
          : 'Dit is nu de beste prijs die we zien.',
    });
  }

  if (typeof trackedMerchantCount === 'number' && trackedMerchantCount > 0) {
    items.push({
      id: 'merchant-coverage',
      text: `We volgen ${trackedMerchantCount} Nederlandse winkel${
        trackedMerchantCount === 1 ? '' : 's'
      } voor deze set.`,
    });
  } else if (items.length < 3) {
    items.push({
      id: 'brickhunt-guidance',
      text: 'Met meer data wordt dit advies scherper.',
    });
  }

  return items.slice(0, 3);
}

export function buildBrickhuntValueItems({
  merchantCount,
}: {
  merchantCount?: number;
} = {}): SetDecisionSupportItem[] {
  return [
    {
      id: 'brickhunt-monitoring',
      text:
        typeof merchantCount === 'number' && merchantCount > 0
          ? `We vergelijken echte prijzen bij ${merchantCount} Nederlandse winkel${
              merchantCount === 1 ? '' : 's'
            } zolang die vergelijking iets zegt.`
          : 'We vergelijken echte winkelprijzen zolang die vergelijking iets zegt.',
    },
    {
      id: 'brickhunt-guidance',
      text: 'Je ziet of deze prijs echt opvalt of gewoon normaal is.',
    },
    {
      id: 'brickhunt-alerts',
      text: 'Nog niet kopen? Volg de prijs en laat Brickhunt meekijken.',
    },
  ];
}

export function getPricePanelSnapshot(
  setId: string,
): PricePanelSnapshot | undefined {
  return pricePanelSnapshotBySetId.get(setId);
}

export function getSetDealVerdict(setId: string): SetDealVerdict {
  return buildSetDealVerdict(getPricePanelSnapshot(setId));
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

export function getReviewedPriceSummary(
  setId: string,
): ReviewedPriceSummary | undefined {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return undefined;
  }

  const priceDealSummary = getPriceDealSummary(pricePanelSnapshot);

  return {
    availabilityLabel: pricePanelSnapshot.lowestAvailabilityLabel,
    coverageLabel: pricePanelSnapshot.lowestAvailabilityLabel
      ? `${pricePanelSnapshot.lowestAvailabilityLabel} · ${getReviewedOfferLabel(pricePanelSnapshot.merchantCount)}`
      : getReviewedOfferLabel(pricePanelSnapshot.merchantCount),
    coverageNote: priceDealSummary.coverageNote,
    currentPrice: getCurrentPriceLabel(pricePanelSnapshot),
    dealLabel: priceDealSummary.label,
    merchantLabel: `Laagste reviewed prijs bij ${pricePanelSnapshot.lowestMerchantName}`,
    pricePositionLabel: getPricePositionLabel({
      currencyCode: pricePanelSnapshot.currencyCode,
      deltaMinor: pricePanelSnapshot.deltaMinor,
    }),
    reviewedLabel: `Gecheckt ${formatReviewedOn(pricePanelSnapshot.observedAt)}`,
  };
}

export function buildSetPriceInsights({
  priceHistorySummaryState,
  pricePanelSnapshot,
}: {
  priceHistorySummaryState?: PriceHistorySummaryState;
  pricePanelSnapshot?: PricePanelSnapshot;
}): SetPriceInsight[] {
  if (!pricePanelSnapshot) {
    return [
      {
        id: 'limited-data',
        text: 'We volgen deze set nog te kort voor scherp prijsadvies.',
      },
      {
        id: 'more-data',
        text: 'Met meer data wordt dit advies scherper.',
      },
    ];
  }

  const insights: SetPriceInsight[] = [];
  const { priceHistorySummary, trackedPriceSummary } =
    priceHistorySummaryState ?? {};

  if (priceHistorySummary) {
    insights.push({
      id: 'current-vs-normal',
      text:
        priceHistorySummary.deltaVsAverageMinor < 0
          ? 'De huidige prijs ligt laag vergeleken met wat we meestal zien.'
          : priceHistorySummary.deltaVsAverageMinor > 0
            ? 'De huidige prijs ligt hoog vergeleken met wat we meestal zien.'
            : 'De huidige prijs zit rond wat we meestal zien.',
    });
    insights.push({
      id: 'recent-low',
      text: `Laagste prijs in 30 dagen: ${formatPriceMinor({
        currencyCode: priceHistorySummary.currencyCode,
        minorUnits: priceHistorySummary.lowPriceMinor,
      })}`,
    });
  } else {
    insights.push({
      id: 'limited-history',
      text: 'We hebben nog beperkt prijsverloop voor deze set.',
    });
  }

  if (trackedPriceSummary) {
    const nearTrackedLow =
      trackedPriceSummary.pointCount >= 14 &&
      trackedPriceSummary.deltaVsTrackedLowMinor <=
        Math.round(trackedPriceSummary.currentHeadlinePriceMinor * 0.05);

    insights.push({
      id: 'tracked-low',
      text:
        trackedPriceSummary.deltaVsTrackedLowMinor <= 0
          ? 'Dit is momenteel de laagste prijs die we volgen.'
          : nearTrackedLow
            ? 'Deze set zakt meestal niet veel lager dan dit.'
            : `We zagen deze set eerder al voor ${formatPriceMinor({
                currencyCode: trackedPriceSummary.currencyCode,
                minorUnits: trackedPriceSummary.trackedLowPriceMinor,
              })}`,
    });
  }

  if (!trackedPriceSummary && insights.length < 3) {
    insights.push({
      id: 'more-data',
      text: 'Met meer data wordt dit advies scherper.',
    });
  }

  if (insights.length < 3) {
    insights.push({
      id: 'coverage',
      text: `We volgen nu ${pricePanelSnapshot.merchantCount} winkel${
        pricePanelSnapshot.merchantCount === 1 ? '' : 's'
      } voor deze set.`,
    });
  }

  return insights.slice(0, 3);
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

export function buildWishlistPriceAlert({
  priceHistoryPoints = [],
  savedAt,
  setId,
}: {
  priceHistoryPoints?: readonly PriceHistoryPoint[];
  savedAt?: string;
  setId: string;
}): WishlistPriceAlert | undefined {
  const pricePanelSnapshot = getPricePanelSnapshot(setId);

  if (!pricePanelSnapshot) {
    return undefined;
  }

  const currentPriceLabel = getCurrentPriceLabel(pricePanelSnapshot);
  const coverageLabel = getAlertCoverageLabel(pricePanelSnapshot);
  const currentObservedAt = new Date(pricePanelSnapshot.observedAt).getTime();
  const priorTrackedLowMinor = priceHistoryPoints
    .filter(
      (priceHistoryPoint) =>
        new Date(priceHistoryPoint.observedAt).getTime() < currentObservedAt,
    )
    .reduce<number | undefined>((trackedLowMinor, priceHistoryPoint) => {
      if (trackedLowMinor === undefined) {
        return priceHistoryPoint.headlinePriceMinor;
      }

      return Math.min(trackedLowMinor, priceHistoryPoint.headlinePriceMinor);
    }, undefined);

  if (
    typeof priorTrackedLowMinor === 'number' &&
    pricePanelSnapshot.headlinePriceMinor < priorTrackedLowMinor
  ) {
    return {
      detail: `${currentPriceLabel} is ${formatPriceMinor({
        currencyCode: pricePanelSnapshot.currencyCode,
        minorUnits:
          priorTrackedLowMinor - pricePanelSnapshot.headlinePriceMinor,
      })} onder de vorige beste tracked prijs.`,
      kind: 'new-best-price',
      label: 'Nieuwe beste reviewed prijs',
      tone: 'positive',
    };
  }

  const savedAtTimestamp = savedAt ? new Date(savedAt).getTime() : undefined;
  const baselinePricePoint =
    typeof savedAtTimestamp === 'number' && Number.isFinite(savedAtTimestamp)
      ? [...priceHistoryPoints]
          .reverse()
          .find(
            (priceHistoryPoint) =>
              new Date(priceHistoryPoint.observedAt).getTime() <=
              savedAtTimestamp,
          )
      : undefined;

  if (
    baselinePricePoint &&
    typeof savedAtTimestamp === 'number' &&
    Number.isFinite(savedAtTimestamp) &&
    new Date(pricePanelSnapshot.observedAt).getTime() > savedAtTimestamp &&
    pricePanelSnapshot.headlinePriceMinor <
      baselinePricePoint.headlinePriceMinor
  ) {
    return {
      detail: `${currentPriceLabel} is ${formatPriceMinor({
        currencyCode: pricePanelSnapshot.currencyCode,
        minorUnits:
          baselinePricePoint.headlinePriceMinor -
          pricePanelSnapshot.headlinePriceMinor,
      })} lager dan toen je deze set opsloeg.`,
      kind: 'price-improved-since-save',
      label: 'Lager dan toen je hem opsloeg',
      tone: 'positive',
    };
  }

  const priceDealSummary = getPriceDealSummary(pricePanelSnapshot);
  const pricePositionLabel = getPricePositionLabel({
    currencyCode: pricePanelSnapshot.currencyCode,
    deltaMinor: pricePanelSnapshot.deltaMinor,
  });

  if (priceDealSummary.label === 'Beste deal nu') {
    return {
      detail: pricePositionLabel
        ? `${pricePositionLabel} · ${coverageLabel}`
        : `${currentPriceLabel} · ${coverageLabel}`,
      kind: 'strong-deal-now',
      label: 'Sterke deal nu',
      tone: 'accent',
    };
  }

  return undefined;
}

export async function listWishlistPriceAlerts({
  savedAtBySetId,
  setIds,
}: {
  savedAtBySetId?: Record<string, string | undefined>;
  setIds: readonly string[];
}): Promise<Record<string, WishlistPriceAlert | undefined>> {
  const uniqueSetIds = [...new Set(setIds)].filter((setId) =>
    Boolean(getPricePanelSnapshot(setId)),
  );

  if (uniqueSetIds.length === 0) {
    return {};
  }

  const buildAlertLookup = (
    groupedPriceHistoryPoints: Map<string, PriceHistoryPoint[]>,
  ) =>
    Object.fromEntries(
      uniqueSetIds.map((setId) => [
        setId,
        buildWishlistPriceAlert({
          priceHistoryPoints: groupedPriceHistoryPoints.get(setId),
          savedAt: savedAtBySetId?.[setId],
          setId,
        }),
      ]),
    );

  if (!hasBrowserSupabaseConfig()) {
    return buildAlertLookup(new Map());
  }

  const { data, error } = await getBrowserSupabaseClient()
    .from(PRICING_HISTORY_TABLE)
    .select(
      'set_id, region_code, currency_code, condition, headline_price_minor, reference_price_minor, lowest_merchant_id, observed_at, recorded_on',
    )
    .in('set_id', uniqueSetIds)
    .eq('region_code', DUTCH_REGION_CODE)
    .eq('currency_code', EURO_CURRENCY_CODE)
    .eq('condition', NEW_OFFER_CONDITION)
    .order('set_id', { ascending: true })
    .order('recorded_on', { ascending: true })
    .limit(5000);

  if (error || !Array.isArray(data)) {
    return buildAlertLookup(new Map());
  }

  const groupedPriceHistoryPoints = data.reduce<
    Map<string, PriceHistoryPoint[]>
  >((priceHistoryPointsBySetId, priceHistoryRowRecord) => {
    const priceHistoryPoint = normalizePriceHistoryRowRecord(
      priceHistoryRowRecord as PriceHistoryRowRecord,
    );

    if (!priceHistoryPoint) {
      return priceHistoryPointsBySetId;
    }

    const existingPriceHistoryPoints =
      priceHistoryPointsBySetId.get(priceHistoryPoint.setId) ?? [];

    priceHistoryPointsBySetId.set(priceHistoryPoint.setId, [
      ...existingPriceHistoryPoints,
      priceHistoryPoint,
    ]);

    return priceHistoryPointsBySetId;
  }, new Map());

  return buildAlertLookup(groupedPriceHistoryPoints);
}

export function summarizeWishlistPriceAlerts(
  wishlistPriceAlerts: Record<string, WishlistPriceAlert | undefined>,
): WishlistPriceAlertSummary | undefined {
  const activeWishlistAlerts = Object.values(wishlistPriceAlerts).filter(
    (wishlistPriceAlert): wishlistPriceAlert is WishlistPriceAlert =>
      wishlistPriceAlert !== undefined,
  );

  if (activeWishlistAlerts.length === 0) {
    return undefined;
  }

  return {
    activeCount: activeWishlistAlerts.length,
    newBestPriceCount: activeWishlistAlerts.filter(
      (wishlistPriceAlert) => wishlistPriceAlert.kind === 'new-best-price',
    ).length,
    priceImprovedSinceSaveCount: activeWishlistAlerts.filter(
      (wishlistPriceAlert) =>
        wishlistPriceAlert.kind === 'price-improved-since-save',
    ).length,
    strongDealCount: activeWishlistAlerts.filter(
      (wishlistPriceAlert) => wishlistPriceAlert.kind === 'strong-deal-now',
    ).length,
  };
}

export function buildWishlistAlertNotificationCandidate({
  alert,
  cooldownDays = DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
  now,
  previousNotificationState,
  setId,
}: {
  alert?: WishlistPriceAlert;
  cooldownDays?: number;
  now?: string;
  previousNotificationState?: WishlistAlertNotificationState;
  setId: string;
}): WishlistAlertNotificationCandidate | undefined {
  if (!alert) {
    return undefined;
  }

  const normalizedCooldownDays = Math.max(0, Math.trunc(cooldownDays));
  const evaluatedAt = now ?? new Date().toISOString();
  const evaluatedAtTimestamp = parseTimestamp(evaluatedAt) ?? Date.now();
  const priority = getWishlistAlertPriority(alert.kind);
  const signalObservedAt = getPricePanelSnapshot(setId)?.observedAt;
  const previousNotifiedAtTimestamp = parseTimestamp(
    previousNotificationState?.lastNotifiedAt,
  );
  const previousNotifiedKind = previousNotificationState?.lastNotifiedKind;
  const previousPriority = previousNotifiedKind
    ? getWishlistAlertPriority(previousNotifiedKind)
    : undefined;
  const cooldownEndsAt =
    previousNotifiedAtTimestamp === undefined
      ? undefined
      : addDaysToTimestamp(previousNotifiedAtTimestamp, normalizedCooldownDays);
  const cooldownEndsAtTimestamp = parseTimestamp(cooldownEndsAt);
  const cooldownActive =
    cooldownEndsAtTimestamp !== undefined &&
    cooldownEndsAtTimestamp > evaluatedAtTimestamp;
  const supersedesPreviousKind =
    previousPriority !== undefined && priority > previousPriority
      ? previousNotifiedKind
      : undefined;

  if (
    cooldownActive &&
    previousNotifiedKind !== undefined &&
    !supersedesPreviousKind
  ) {
    return {
      ...alert,
      cooldownDays: normalizedCooldownDays,
      cooldownEndsAt,
      dedupeKey: `${setId}:${alert.kind}`,
      evaluatedAt,
      isNewlyNotifiable: false,
      priority,
      signalObservedAt,
      setId,
      suppressionReason: 'cooldown-active',
    };
  }

  return {
    ...alert,
    cooldownDays: normalizedCooldownDays,
    cooldownEndsAt,
    dedupeKey: `${setId}:${alert.kind}`,
    evaluatedAt,
    isNewlyNotifiable: true,
    notificationReason:
      previousNotifiedKind === undefined
        ? 'first-signal'
        : supersedesPreviousKind
          ? 'higher-priority-signal'
          : 'cooldown-expired',
    priority,
    signalObservedAt,
    setId,
    supersedesPreviousKind,
  };
}

export function listWishlistAlertNotificationCandidates({
  cooldownDays = DEFAULT_WISHLIST_ALERT_NOTIFICATION_COOLDOWN_DAYS,
  now,
  previousNotificationStateBySetId,
  wishlistPriceAlerts,
}: {
  cooldownDays?: number;
  now?: string;
  previousNotificationStateBySetId?: Record<
    string,
    WishlistAlertNotificationState | undefined
  >;
  wishlistPriceAlerts: Record<string, WishlistPriceAlert | undefined>;
}): Record<string, WishlistAlertNotificationCandidate | undefined> {
  return Object.fromEntries(
    Object.entries(wishlistPriceAlerts).map(([setId, alert]) => [
      setId,
      buildWishlistAlertNotificationCandidate({
        alert,
        cooldownDays,
        now,
        previousNotificationState: previousNotificationStateBySetId?.[setId],
        setId,
      }),
    ]),
  );
}

export function isWishlistAlertNotificationCandidateNew({
  lastViewedAt,
  wishlistAlertNotificationCandidate,
}: {
  lastViewedAt?: string;
  wishlistAlertNotificationCandidate?: WishlistAlertNotificationCandidate;
}): boolean {
  if (
    !wishlistAlertNotificationCandidate ||
    !wishlistAlertNotificationCandidate.isNewlyNotifiable
  ) {
    return false;
  }

  const candidateTimestamp =
    parseTimestamp(wishlistAlertNotificationCandidate.signalObservedAt) ??
    parseTimestamp(wishlistAlertNotificationCandidate.evaluatedAt);

  if (candidateTimestamp === undefined) {
    return false;
  }

  const lastViewedTimestamp = parseTimestamp(lastViewedAt);

  if (lastViewedTimestamp === undefined) {
    return true;
  }

  return candidateTimestamp > lastViewedTimestamp;
}

export function summarizeNewWishlistAlertCandidates({
  lastViewedAt,
  wishlistAlertNotificationCandidates,
}: {
  lastViewedAt?: string;
  wishlistAlertNotificationCandidates: Record<
    string,
    WishlistAlertNotificationCandidate | undefined
  >;
}): WishlistNewAlertSummary | undefined {
  const newWishlistAlertCandidates = Object.values(
    wishlistAlertNotificationCandidates,
  ).filter((wishlistAlertNotificationCandidate) =>
    isWishlistAlertNotificationCandidateNew({
      lastViewedAt,
      wishlistAlertNotificationCandidate,
    }),
  ) as WishlistAlertNotificationCandidate[];

  if (newWishlistAlertCandidates.length === 0) {
    return undefined;
  }

  return {
    newCount: newWishlistAlertCandidates.length,
    newBestPriceCount: newWishlistAlertCandidates.filter(
      (wishlistAlertNotificationCandidate) =>
        wishlistAlertNotificationCandidate.kind === 'new-best-price',
    ).length,
    priceImprovedSinceSaveCount: newWishlistAlertCandidates.filter(
      (wishlistAlertNotificationCandidate) =>
        wishlistAlertNotificationCandidate.kind === 'price-improved-since-save',
    ).length,
    strongDealCount: newWishlistAlertCandidates.filter(
      (wishlistAlertNotificationCandidate) =>
        wishlistAlertNotificationCandidate.kind === 'strong-deal-now',
    ).length,
  };
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
