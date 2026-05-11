import {
  getDefaultFormattingLocale,
  type AppCurrencyCode,
  type AppMarketCode,
  type CommerceCommercialUnitType,
} from '@lego-platform/shared/config';

export const DUTCH_REGION_CODE = 'NL';
export const EURO_CURRENCY_CODE = 'EUR';
export const NEW_OFFER_CONDITION = 'new';
export const PRICING_HISTORY_TABLE = 'pricing_daily_set_history';
export const PRICE_HISTORY_WINDOW_DAYS = 30;

export type PricingRegionCode = AppMarketCode;
export type PricingCurrencyCode = AppCurrencyCode;
export type PricingCondition = typeof NEW_OFFER_CONDITION;
export type PricingAvailability =
  | 'in_stock'
  | 'limited'
  | 'out_of_stock'
  | 'preorder'
  | 'unknown';

export interface PricingObservation {
  availability: PricingAvailability;
  condition: PricingCondition;
  currencyCode: PricingCurrencyCode;
  commercialUnitType?: CommerceCommercialUnitType;
  merchantId: string;
  observedAt: string;
  regionCode: PricingRegionCode;
  setId: string;
  totalPriceMinor: number;
}

export interface PricePanelSnapshot {
  condition: PricingCondition;
  currencyCode: PricingCurrencyCode;
  deltaMinor?: number;
  headlinePriceMinor: number;
  lowestAvailabilityLabel?: string;
  lowestMerchantId: string;
  lowestMerchantName: string;
  merchantCount: number;
  observedAt: string;
  referencePriceMinor?: number;
  regionCode: PricingRegionCode;
  setId: string;
}

export interface FeaturedSetPriceContext {
  availabilityLabel?: string;
  currencyCode: PricingCurrencyCode;
  deltaMinor?: number;
  headlinePriceMinor: number;
  merchantCount: number;
  merchantName: string;
  observedAt: string;
  referencePriceMinor?: number;
  setId: string;
}

export interface PricingSyncManifest {
  generatedAt: string;
  notes?: string;
  observationCount: number;
  setCount: number;
  source: string;
}

export interface PriceHistoryPoint {
  condition: PricingCondition;
  currencyCode: PricingCurrencyCode;
  headlinePriceMinor: number;
  lowestMerchantId?: string;
  observedAt: string;
  recordedOn: string;
  referencePriceMinor?: number;
  regionCode: PricingRegionCode;
  setId: string;
}

export interface PriceHistorySummary {
  averagePriceMinor: number;
  currencyCode: PricingCurrencyCode;
  currentHeadlinePriceMinor: number;
  deltaVsAverageMinor: number;
  highPriceMinor: number;
  lowPriceMinor: number;
  pointCount: number;
}

export interface TrackedPriceSummary {
  currencyCode: PricingCurrencyCode;
  currentHeadlinePriceMinor: number;
  deltaVsTrackedHighMinor: number;
  deltaVsTrackedLowMinor: number;
  pointCount: number;
  trackedHighPriceMinor: number;
  trackedLowPriceMinor: number;
  trackedSinceRecordedOn: string;
}

export interface PriceDealSummary {
  coverageNote?: string;
  label: string;
}

export interface SetDealVerdict {
  explanation: string;
  label:
    | 'Actuele prijzen binnen'
    | 'Goede deal'
    | 'Prijsdata nog beperkt'
    | 'Prima prijs'
    | 'Wachten loont';
  tone: 'info' | 'neutral' | 'positive' | 'warning';
}

export const EFFECTIVE_SET_DEAL_DISCOVERY_MINIMUM_MERCHANTS = 2;
export const EFFECTIVE_SET_DEAL_MINIMUM_ABSOLUTE_DISCOUNT_MINOR = 2500;
export const EFFECTIVE_SET_DEAL_MINIMUM_DISCOUNT_PERCENTAGE = 15;

export interface EffectiveSetDealCurrentOfferInput {
  availabilityLabel?: string;
  condition: PricePanelSnapshot['condition'];
  currencyCode: PricePanelSnapshot['currencyCode'];
  merchantCount?: number;
  merchantId: string;
  merchantName: string;
  observedAt: string;
  priceMinor: number;
  regionCode: PricePanelSnapshot['regionCode'];
  setId: string;
}

export interface EffectiveSetDealDiscoveryInput {
  bestPriceMinor: number;
  merchantCount: number;
  referenceDeltaMinor?: number;
}

export interface EffectiveSetDealSnapshotResult {
  reason:
    | 'current_offer_missing'
    | 'discount_below_threshold'
    | 'discovery_price_mismatch'
    | 'discovery_reference_missing'
    | 'insufficient_merchant_coverage'
    | 'price_panel_delta_available'
    | 'strong_discovery_discount';
  snapshot?: PricePanelSnapshot;
  source: 'discovery_reference_fallback' | 'none' | 'price_panel_snapshot';
}

export interface SetPriceInsight {
  id:
    | 'coverage'
    | 'current-vs-normal'
    | 'limited-data'
    | 'limited-history'
    | 'more-data'
    | 'recent-low'
    | 'tracked-low';
  text: string;
}

function getReferencePriceMinorFromDiscoveryInput(
  discoveryInput?: EffectiveSetDealDiscoveryInput,
): number | undefined {
  if (
    typeof discoveryInput?.bestPriceMinor !== 'number' ||
    discoveryInput.bestPriceMinor <= 0 ||
    typeof discoveryInput.referenceDeltaMinor !== 'number'
  ) {
    return undefined;
  }

  const referencePriceMinor =
    discoveryInput.bestPriceMinor - discoveryInput.referenceDeltaMinor;

  return Number.isInteger(referencePriceMinor) && referencePriceMinor > 0
    ? referencePriceMinor
    : undefined;
}

function getFallbackSource(
  pricePanelSnapshot?: PricePanelSnapshot,
): 'none' | 'price_panel_snapshot' {
  return pricePanelSnapshot ? 'price_panel_snapshot' : 'none';
}

export function buildEffectiveSetDealSnapshot({
  currentOffer,
  discoveryInput,
  pricePanelSnapshot,
}: {
  currentOffer?: EffectiveSetDealCurrentOfferInput;
  discoveryInput?: EffectiveSetDealDiscoveryInput;
  pricePanelSnapshot?: PricePanelSnapshot;
}): EffectiveSetDealSnapshotResult {
  if (typeof pricePanelSnapshot?.deltaMinor === 'number') {
    return {
      reason: 'price_panel_delta_available',
      snapshot: pricePanelSnapshot,
      source: 'price_panel_snapshot',
    };
  }

  if (!currentOffer) {
    return {
      reason: 'current_offer_missing',
      snapshot: pricePanelSnapshot,
      source: getFallbackSource(pricePanelSnapshot),
    };
  }

  const discoveryReferencePriceMinor =
    getReferencePriceMinorFromDiscoveryInput(discoveryInput);

  if (typeof discoveryReferencePriceMinor !== 'number') {
    return {
      reason: 'discovery_reference_missing',
      snapshot: pricePanelSnapshot,
      source: getFallbackSource(pricePanelSnapshot),
    };
  }

  if (discoveryInput?.bestPriceMinor !== currentOffer.priceMinor) {
    return {
      reason: 'discovery_price_mismatch',
      snapshot: pricePanelSnapshot,
      source: getFallbackSource(pricePanelSnapshot),
    };
  }

  if (
    discoveryInput.merchantCount <
    EFFECTIVE_SET_DEAL_DISCOVERY_MINIMUM_MERCHANTS
  ) {
    return {
      reason: 'insufficient_merchant_coverage',
      snapshot: pricePanelSnapshot,
      source: getFallbackSource(pricePanelSnapshot),
    };
  }

  const discoveryDeltaMinor =
    currentOffer.priceMinor - discoveryReferencePriceMinor;
  const discoveryDiscountPercentage = Math.round(
    (Math.abs(discoveryDeltaMinor) / discoveryReferencePriceMinor) * 100,
  );
  const hasStrongDiscoveryDiscount =
    discoveryDeltaMinor < 0 &&
    Math.abs(discoveryDeltaMinor) >=
      EFFECTIVE_SET_DEAL_MINIMUM_ABSOLUTE_DISCOUNT_MINOR &&
    discoveryDiscountPercentage >=
      EFFECTIVE_SET_DEAL_MINIMUM_DISCOUNT_PERCENTAGE;

  if (!hasStrongDiscoveryDiscount) {
    return {
      reason: 'discount_below_threshold',
      snapshot: pricePanelSnapshot,
      source: getFallbackSource(pricePanelSnapshot),
    };
  }

  return {
    reason: 'strong_discovery_discount',
    snapshot: {
      condition: currentOffer.condition,
      currencyCode: currentOffer.currencyCode,
      deltaMinor: discoveryDeltaMinor,
      headlinePriceMinor: currentOffer.priceMinor,
      lowestAvailabilityLabel: currentOffer.availabilityLabel,
      lowestMerchantId: currentOffer.merchantId,
      lowestMerchantName: currentOffer.merchantName,
      merchantCount: Math.max(
        currentOffer.merchantCount ?? 0,
        discoveryInput.merchantCount,
        pricePanelSnapshot?.merchantCount ?? 0,
      ),
      observedAt: currentOffer.observedAt,
      referencePriceMinor: discoveryReferencePriceMinor,
      regionCode: currentOffer.regionCode,
      setId: currentOffer.setId,
    },
    source: 'discovery_reference_fallback',
  };
}

export function getPriceDirection(deltaMinor?: number): 'up' | 'down' | 'flat' {
  if (typeof deltaMinor !== 'number' || deltaMinor === 0) {
    return 'flat';
  }

  return deltaMinor > 0 ? 'up' : 'down';
}

export function getPriceDealSummary({
  deltaMinor,
  merchantCount,
}: Pick<PricePanelSnapshot, 'deltaMinor' | 'merchantCount'>): PriceDealSummary {
  const coverageNote =
    merchantCount <= 2
      ? `Tot nu toe pas ${merchantCount} reviewed aanbieding${merchantCount === 1 ? '' : 'en'}`
      : undefined;

  if (typeof deltaMinor !== 'number') {
    return {
      label: 'Laagste reviewed aanbieding',
      coverageNote,
    };
  }

  if (deltaMinor < 0) {
    return {
      label: 'Beste deal nu',
      coverageNote,
    };
  }

  if (deltaMinor > 0) {
    return {
      label: 'Boven referentie',
      coverageNote,
    };
  }

  return {
    label: 'Precies op referentie',
    coverageNote,
  };
}

export function formatPriceMinor({
  currencyCode,
  locale = getDefaultFormattingLocale(),
  minorUnits,
}: {
  currencyCode: string;
  locale?: string;
  minorUnits: number;
}): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

function renderPricingGeneratedModule<
  T extends
    | PricingSyncManifest
    | readonly PricePanelSnapshot[]
    | readonly PricingObservation[],
>({
  exportName,
  importNames,
  typeAnnotation,
  payload,
}: {
  exportName:
    | 'pricePanelSnapshots'
    | 'pricingObservations'
    | 'pricingSyncManifest';
  importNames: string[];
  typeAnnotation: string;
  payload: T;
}): string {
  const payloadVariableName = `${exportName}Payload`;

  return `import type { ${importNames.join(', ')} } from '@lego-platform/pricing/util';

// Generated by apps/commerce-sync. Do not edit by hand.
const ${payloadVariableName} = String.raw\`${JSON.stringify(payload, null, 2)}\`;

export const ${exportName}: ${typeAnnotation} = JSON.parse(
  ${payloadVariableName},
) as ${typeAnnotation};
`;
}

export function renderPricingObservationsModule(
  pricingObservations: readonly PricingObservation[],
): string {
  return renderPricingGeneratedModule({
    exportName: 'pricingObservations',
    importNames: ['PricingObservation'],
    typeAnnotation: 'readonly PricingObservation[]',
    payload: pricingObservations,
  });
}

export function renderPricePanelSnapshotsModule(
  pricePanelSnapshots: readonly PricePanelSnapshot[],
): string {
  return renderPricingGeneratedModule({
    exportName: 'pricePanelSnapshots',
    importNames: ['PricePanelSnapshot'],
    typeAnnotation: 'readonly PricePanelSnapshot[]',
    payload: pricePanelSnapshots,
  });
}

export function renderPricingSyncManifestModule(
  pricingSyncManifest: PricingSyncManifest,
): string {
  return renderPricingGeneratedModule({
    exportName: 'pricingSyncManifest',
    importNames: ['PricingSyncManifest'],
    typeAnnotation: 'PricingSyncManifest',
    payload: pricingSyncManifest,
  });
}
