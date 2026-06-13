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

export type HeroDealState =
  | 'exceptional_deal'
  | 'strong_deal'
  | 'good_deal'
  | 'market_price'
  | 'wait'
  | 'price_building'
  | 'no_reliable_offer';

export type HeroAdviceCategory =
  | 'buy_now'
  | 'buy_if_you_want_it'
  | 'neutral'
  | 'wait'
  | 'follow';

export type HeroPrimaryAction = 'merchant' | 'follow';

export type HeroCommerceIntent =
  | 'balanced'
  | 'block_merchant'
  | 'push_follow'
  | 'push_merchant';

export type HeroMerchantCtaIntent =
  | 'availability_check'
  | 'deal'
  | 'price_check';

export type HeroFollowIntent =
  | 'save_decision'
  | 'track_new_set'
  | 'wait_for_drop'
  | 'watch_availability';

export type HeroRiskFlag =
  | 'limited_history'
  | 'new_set'
  | 'out_of_stock'
  | 'single_merchant'
  | 'stale_price'
  | 'volatile_price';

export type HeroPriceTrend = 'down' | 'flat' | 'up';
export type HeroSetLifecycle =
  | 'available'
  | 'new'
  | 'retired'
  | 'retiring_soon';

export interface HeroDealSignals {
  currentPriceMinor?: number;
  historyDays: number;
  historyPointCount: number;
  lowest30dMinor?: number;
  lowestEverMinor?: number;
  merchantCount: number;
  observedAt?: string;
  referencePriceMinor?: number;
}

export interface HeroDealPresentation {
  advice: string;
  adviceCategory: HeroAdviceCategory;
  commerceIntent: HeroCommerceIntent;
  confidenceScore: number;
  dealScore: number;
  evidence: string[];
  followIntent: HeroFollowIntent;
  hasPurchasableOffer: boolean;
  isBestCurrentOffer?: boolean;
  isPremiumDeal?: boolean;
  merchantCtaIntent?: HeroMerchantCtaIntent;
  primaryAction: HeroPrimaryAction;
  reasonCodes: string[];
  riskFlags: HeroRiskFlag[];
  secondaryAction?: HeroPrimaryAction;
  signals: HeroDealSignals;
  state: HeroDealState;
  title: string;
}

export interface HeroDealDecisionInput {
  availability?: PricingAvailability;
  currencyCode?: PricingCurrencyCode;
  currentPriceMinor?: number | null;
  dataQualityIssueCount?: number;
  hasMerchantOffer?: boolean;
  hasReliableCurrentPrice?: boolean;
  historyDays?: number;
  historyPointCount?: number;
  isBestCurrentOffer?: boolean;
  isPremiumDeal?: boolean;
  isTrustedMerchant?: boolean;
  lowest30dMinor?: number | null;
  lowestEverMinor?: number | null;
  merchantCount?: number;
  now?: Date;
  observedAt?: string;
  priceTrend?: HeroPriceTrend;
  priceVolatilityRatio?: number;
  referenceLabel?: string;
  referencePriceMinor?: number | null;
  setAgeDays?: number;
  setLifecycle?: HeroSetLifecycle;
}

const HERO_STALE_PRICE_MAX_AGE_DAYS = 7;
const HERO_LIMITED_HISTORY_POINT_COUNT = 10;
const HERO_LIMITED_HISTORY_DAYS = 30;
const HERO_CLEAR_REFERENCE_DISCOUNT_MINOR = 2000;
const HERO_CLEAR_REFERENCE_DISCOUNT_RATIO = 0.1;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isPositiveMinor(value?: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function formatHeroEvidenceAmount({
  currencyCode,
  minorUnits,
}: {
  currencyCode: string;
  minorUnits: number;
}): string {
  const absoluteMinorUnits = Math.abs(Math.round(minorUnits));
  const wholeMinorUnits = Math.floor(absoluteMinorUnits / 100) * 100;

  return new Intl.NumberFormat(getDefaultFormattingLocale(), {
    currency: currencyCode,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  })
    .format(wholeMinorUnits / 100)
    .replace(/\s+/gu, '');
}

function getObservedAtAgeDays({
  now,
  observedAt,
}: {
  now: Date;
  observedAt?: string;
}): number | undefined {
  if (!observedAt) {
    return undefined;
  }

  const observedAtMs = Date.parse(observedAt);

  if (!Number.isFinite(observedAtMs)) {
    return undefined;
  }

  return Math.max(0, (now.getTime() - observedAtMs) / 86_400_000);
}

function scoreReferenceDiscount({
  currentPriceMinor,
  referencePriceMinor,
}: {
  currentPriceMinor?: number;
  referencePriceMinor?: number;
}): number {
  if (!currentPriceMinor || !referencePriceMinor) {
    return 10;
  }

  const discountRatio =
    (referencePriceMinor - currentPriceMinor) / referencePriceMinor;

  if (discountRatio >= 0.3) {
    return 30;
  }

  if (discountRatio >= 0.2) {
    return 26;
  }

  if (discountRatio >= 0.1) {
    return 21;
  }

  if (discountRatio >= 0.05) {
    return 16;
  }

  if (discountRatio >= 0) {
    return 11;
  }

  if (discountRatio >= -0.05) {
    return 6;
  }

  return 0;
}

function scoreCurrentPriceVsLow({
  currentPriceMinor,
  lowPriceMinor,
  maxScore,
}: {
  currentPriceMinor?: number;
  lowPriceMinor?: number;
  maxScore: number;
}): number {
  if (!currentPriceMinor || !lowPriceMinor) {
    return Math.round(maxScore * 0.35);
  }

  if (currentPriceMinor <= lowPriceMinor) {
    return maxScore;
  }

  const ratioAboveLow = (currentPriceMinor - lowPriceMinor) / lowPriceMinor;

  if (ratioAboveLow <= 0.02) {
    return Math.round(maxScore * 0.9);
  }

  if (ratioAboveLow <= 0.05) {
    return Math.round(maxScore * 0.72);
  }

  if (ratioAboveLow <= 0.1) {
    return Math.round(maxScore * 0.48);
  }

  if (ratioAboveLow <= 0.2) {
    return Math.round(maxScore * 0.22);
  }

  return 0;
}

function scorePriceTrend(priceTrend?: HeroPriceTrend): number {
  if (priceTrend === 'down') {
    return 10;
  }

  if (priceTrend === 'up') {
    return 0;
  }

  if (priceTrend === 'flat') {
    return 6;
  }

  return 5;
}

function scoreMerchantCompetition(merchantCount: number): number {
  if (merchantCount >= 5) {
    return 10;
  }

  if (merchantCount >= 3) {
    return 8;
  }

  if (merchantCount >= 2) {
    return 6;
  }

  if (merchantCount === 1) {
    return 2;
  }

  return 0;
}

function scoreSetLifecycle({
  setAgeDays,
  setLifecycle,
}: {
  setAgeDays?: number;
  setLifecycle?: HeroSetLifecycle;
}): number {
  if (setLifecycle === 'retiring_soon') {
    return 5;
  }

  if (setLifecycle === 'retired') {
    return 1;
  }

  if (
    setLifecycle === 'new' ||
    (typeof setAgeDays === 'number' && setAgeDays < 60)
  ) {
    return 2;
  }

  return 4;
}

function buildHeroRiskFlags({
  availability,
  historyDays,
  historyPointCount,
  merchantCount,
  observedAtAgeDays,
  priceVolatilityRatio,
  setAgeDays,
  setLifecycle,
}: {
  availability?: PricingAvailability;
  historyDays: number;
  historyPointCount: number;
  merchantCount: number;
  observedAtAgeDays?: number;
  priceVolatilityRatio?: number;
  setAgeDays?: number;
  setLifecycle?: HeroSetLifecycle;
}): HeroRiskFlag[] {
  const flags: HeroRiskFlag[] = [];

  if (
    historyPointCount < HERO_LIMITED_HISTORY_POINT_COUNT ||
    historyDays < HERO_LIMITED_HISTORY_DAYS
  ) {
    flags.push('limited_history');
  }

  if (merchantCount <= 1) {
    flags.push('single_merchant');
  }

  if (
    typeof observedAtAgeDays === 'number' &&
    observedAtAgeDays > HERO_STALE_PRICE_MAX_AGE_DAYS
  ) {
    flags.push('stale_price');
  }

  if (
    typeof priceVolatilityRatio === 'number' &&
    priceVolatilityRatio >= 0.15
  ) {
    flags.push('volatile_price');
  }

  if (
    setLifecycle === 'new' ||
    (typeof setAgeDays === 'number' && setAgeDays < 60)
  ) {
    flags.push('new_set');
  }

  if (availability === 'out_of_stock') {
    flags.push('out_of_stock');
  }

  return flags;
}

function calculateHeroDealScore({
  currentPriceMinor,
  lowest30dMinor,
  lowestEverMinor,
  merchantCount,
  priceTrend,
  referencePriceMinor,
  setAgeDays,
  setLifecycle,
}: {
  currentPriceMinor?: number;
  lowest30dMinor?: number;
  lowestEverMinor?: number;
  merchantCount: number;
  priceTrend?: HeroPriceTrend;
  referencePriceMinor?: number;
  setAgeDays?: number;
  setLifecycle?: HeroSetLifecycle;
}): number {
  if (!currentPriceMinor) {
    return 0;
  }

  const rawScore =
    scoreReferenceDiscount({ currentPriceMinor, referencePriceMinor }) +
    scoreCurrentPriceVsLow({
      currentPriceMinor,
      lowPriceMinor: lowest30dMinor,
      maxScore: 25,
    }) +
    scoreCurrentPriceVsLow({
      currentPriceMinor,
      lowPriceMinor: lowestEverMinor,
      maxScore: 20,
    }) +
    scorePriceTrend(priceTrend) +
    scoreMerchantCompetition(merchantCount) +
    scoreSetLifecycle({ setAgeDays, setLifecycle });

  const onlyReferencePriceSignal =
    isPositiveMinor(referencePriceMinor) &&
    !isPositiveMinor(lowest30dMinor) &&
    !isPositiveMinor(lowestEverMinor);

  return clampScore(
    onlyReferencePriceSignal ? Math.min(rawScore, 74) : rawScore,
  );
}

function calculateHeroConfidenceScore({
  availability,
  dataQualityIssueCount,
  historyDays,
  historyPointCount,
  merchantCount,
  observedAtAgeDays,
  priceVolatilityRatio,
}: {
  availability?: PricingAvailability;
  dataQualityIssueCount: number;
  historyDays: number;
  historyPointCount: number;
  merchantCount: number;
  observedAtAgeDays?: number;
  priceVolatilityRatio?: number;
}): number {
  const historyDaysScore = Math.min(25, (historyDays / 365) * 25);
  const historyPointScore = Math.min(25, (historyPointCount / 30) * 25);
  const merchantScore =
    merchantCount >= 5
      ? 20
      : merchantCount >= 3
        ? 16
        : merchantCount >= 2
          ? 12
          : merchantCount === 1
            ? 5
            : 0;
  const recencyScore =
    typeof observedAtAgeDays !== 'number'
      ? 5
      : observedAtAgeDays <= 1
        ? 15
        : observedAtAgeDays <= HERO_STALE_PRICE_MAX_AGE_DAYS
          ? 10
          : 0;
  const volatilityScore =
    typeof priceVolatilityRatio !== 'number'
      ? 5
      : priceVolatilityRatio <= 0.05
        ? 10
        : priceVolatilityRatio <= 0.15
          ? 6
          : 2;
  const qualityScore =
    availability === 'out_of_stock'
      ? 0
      : Math.max(0, 5 - Math.max(0, dataQualityIssueCount));

  return clampScore(
    historyDaysScore +
      historyPointScore +
      merchantScore +
      recencyScore +
      volatilityScore +
      qualityScore,
  );
}

function getRawHeroDealState(dealScore: number): HeroDealState {
  if (dealScore >= 90) {
    return 'exceptional_deal';
  }

  if (dealScore >= 75) {
    return 'strong_deal';
  }

  if (dealScore >= 60) {
    return 'good_deal';
  }

  if (dealScore >= 45) {
    return 'market_price';
  }

  return 'wait';
}

function hasClearReferenceDiscount({
  currentPriceMinor,
  referencePriceMinor,
}: {
  currentPriceMinor?: number;
  referencePriceMinor?: number;
}): boolean {
  if (!currentPriceMinor || !referencePriceMinor) {
    return false;
  }

  const savingsMinor = referencePriceMinor - currentPriceMinor;

  if (savingsMinor <= 0) {
    return false;
  }

  return (
    savingsMinor >= HERO_CLEAR_REFERENCE_DISCOUNT_MINOR ||
    savingsMinor / referencePriceMinor >= HERO_CLEAR_REFERENCE_DISCOUNT_RATIO
  );
}

function resolveHasPurchasableOffer({
  hasCurrentPrice,
  hasMerchantOffer,
  riskFlags,
}: {
  hasCurrentPrice: boolean;
  hasMerchantOffer: boolean;
  riskFlags: readonly HeroRiskFlag[];
}): boolean {
  return (
    hasCurrentPrice &&
    hasMerchantOffer &&
    !riskFlags.includes('out_of_stock') &&
    !riskFlags.includes('stale_price')
  );
}

function resolveHeroDealState({
  confidenceScore,
  dealScore,
  hasClearReferenceDiscount,
  hasCurrentPrice,
  hasMerchantOffer,
  hasPurchasableOffer,
  isBestCurrentOffer,
  isPremiumDeal,
  merchantCount,
  riskFlags,
}: {
  confidenceScore: number;
  dealScore: number;
  hasClearReferenceDiscount: boolean;
  hasCurrentPrice: boolean;
  hasMerchantOffer: boolean;
  hasPurchasableOffer: boolean;
  isBestCurrentOffer: boolean;
  isPremiumDeal: boolean;
  merchantCount: number;
  riskFlags: readonly HeroRiskFlag[];
}): HeroDealState {
  if (
    !hasCurrentPrice ||
    riskFlags.includes('out_of_stock') ||
    !hasMerchantOffer
  ) {
    return !hasCurrentPrice && !riskFlags.includes('out_of_stock')
      ? 'price_building'
      : 'no_reliable_offer';
  }

  const rawState = getRawHeroDealState(dealScore);

  if (
    confidenceScore < 60 &&
    (rawState === 'exceptional_deal' || rawState === 'strong_deal')
  ) {
    return 'good_deal';
  }

  if (hasPurchasableOffer && isPremiumDeal) {
    return rawState === 'exceptional_deal' || rawState === 'strong_deal'
      ? rawState
      : 'good_deal';
  }

  if (hasPurchasableOffer && hasClearReferenceDiscount) {
    return rawState === 'exceptional_deal' || rawState === 'strong_deal'
      ? rawState
      : 'good_deal';
  }

  if (hasPurchasableOffer && isBestCurrentOffer && rawState !== 'wait') {
    return rawState;
  }

  if (hasPurchasableOffer && merchantCount >= 2) {
    return rawState;
  }

  if (confidenceScore < 40 && rawState !== 'wait') {
    return 'price_building';
  }

  return rawState;
}

function guardHeroDealStateForCommerce({
  hasClearReferenceDiscount,
  hasPurchasableOffer,
  isBestCurrentOffer,
  isPremiumDeal,
  merchantCount,
  state,
}: {
  hasClearReferenceDiscount: boolean;
  hasPurchasableOffer: boolean;
  isBestCurrentOffer: boolean;
  isPremiumDeal: boolean;
  merchantCount: number;
  state: HeroDealState;
}): HeroDealState {
  if (!hasPurchasableOffer || state !== 'price_building') {
    return state;
  }

  if (isPremiumDeal || hasClearReferenceDiscount) {
    return 'good_deal';
  }

  if (isBestCurrentOffer || merchantCount >= 2) {
    return 'market_price';
  }

  return state;
}

function getAdviceCategory(state: HeroDealState): HeroAdviceCategory {
  switch (state) {
    case 'exceptional_deal':
    case 'strong_deal':
      return 'buy_now';
    case 'good_deal':
      return 'buy_if_you_want_it';
    case 'market_price':
      return 'neutral';
    case 'wait':
      return 'wait';
    case 'no_reliable_offer':
    case 'price_building':
      return 'follow';
  }
}

function hasReliableMerchantAction({
  hasPurchasableOffer,
}: {
  hasPurchasableOffer: boolean;
}): boolean {
  return hasPurchasableOffer;
}

function resolveHeroCommerceIntent({
  dealScore,
  hasClearReferenceDiscount,
  hasPurchasableOffer,
  isBestCurrentOffer,
  isPremiumDeal,
  state,
}: {
  dealScore: number;
  hasClearReferenceDiscount: boolean;
  hasPurchasableOffer: boolean;
  isBestCurrentOffer: boolean;
  isPremiumDeal: boolean;
  state: HeroDealState;
}): HeroCommerceIntent {
  if (!hasPurchasableOffer) {
    return state === 'no_reliable_offer' ? 'block_merchant' : 'push_follow';
  }

  if (
    isPremiumDeal ||
    hasClearReferenceDiscount ||
    isBestCurrentOffer ||
    dealScore >= 60 ||
    state === 'exceptional_deal' ||
    state === 'strong_deal' ||
    state === 'good_deal'
  ) {
    return 'push_merchant';
  }

  if (state === 'price_building' || state === 'wait') {
    return 'balanced';
  }

  return 'balanced';
}

function ensurePurchasableOfferInvariant({
  commerceIntent,
  hasPurchasableOffer,
}: {
  commerceIntent: HeroCommerceIntent;
  hasPurchasableOffer: boolean;
}): HeroCommerceIntent {
  if (hasPurchasableOffer && commerceIntent === 'block_merchant') {
    return 'balanced';
  }

  return commerceIntent;
}

function resolveHeroPrimaryAction({
  commerceIntent,
  hasPurchasableOffer,
}: {
  commerceIntent: HeroCommerceIntent;
  hasPurchasableOffer: boolean;
}): HeroPrimaryAction {
  if (!hasPurchasableOffer) {
    return 'follow';
  }

  if (commerceIntent === 'push_merchant' || commerceIntent === 'balanced') {
    return 'merchant';
  }

  return 'merchant';
}

function getHeroMerchantCtaIntent({
  commerceIntent,
  state,
}: {
  commerceIntent: HeroCommerceIntent;
  state: HeroDealState;
}): HeroMerchantCtaIntent {
  if (state === 'no_reliable_offer') {
    return 'availability_check';
  }

  if (commerceIntent === 'push_merchant') {
    return 'deal';
  }

  if (
    state === 'exceptional_deal' ||
    state === 'strong_deal' ||
    state === 'good_deal'
  ) {
    return 'deal';
  }

  return 'price_check';
}

function getHeroFollowIntent({
  riskFlags,
  state,
}: {
  riskFlags: readonly HeroRiskFlag[];
  state: HeroDealState;
}): HeroFollowIntent {
  if (state === 'no_reliable_offer' || riskFlags.includes('out_of_stock')) {
    return 'watch_availability';
  }

  if (state === 'price_building' || riskFlags.includes('new_set')) {
    return 'track_new_set';
  }

  if (state === 'wait') {
    return 'wait_for_drop';
  }

  return 'save_decision';
}

function getHeroCopy({
  confidenceScore,
  hasClearReferenceDiscount,
  hasPurchasableOffer,
  isBestCurrentOffer,
  riskFlags,
  state,
}: {
  confidenceScore: number;
  hasClearReferenceDiscount: boolean;
  hasPurchasableOffer: boolean;
  isBestCurrentOffer: boolean;
  riskFlags: readonly HeroRiskFlag[];
  state: HeroDealState;
}): Pick<HeroDealPresentation, 'advice' | 'title'> {
  if (
    confidenceScore < 60 &&
    state === 'good_deal' &&
    hasPurchasableOffer &&
    hasClearReferenceDiscount
  ) {
    return {
      advice:
        'Nog beperkte historie, maar deze actuele prijs ligt duidelijk onder de referentie.',
      title: 'Goede prijs',
    };
  }

  if (confidenceScore < 60 && state === 'good_deal' && hasPurchasableOffer) {
    return {
      advice: 'Nog beperkte historie, maar deze aanbieding is nu wel koopbaar.',
      title: 'Goede prijs',
    };
  }

  if (confidenceScore < 60 && state === 'good_deal') {
    return {
      advice:
        'De prijs lijkt scherp, maar we willen meer data voordat we hard koopadvies geven.',
      title: 'Lijkt een goede prijs',
    };
  }

  if (state === 'market_price' && hasPurchasableOffer && isBestCurrentOffer) {
    return {
      advice: 'Nog beperkte historie, maar dit is nu de beste gevonden prijs.',
      title: 'Beste actuele prijs',
    };
  }

  if (
    (state === 'exceptional_deal' || state === 'strong_deal') &&
    riskFlags.includes('stale_price')
  ) {
    return {
      advice:
        'De prijs lijkt scherp, maar de laatste check is te oud voor hard koopadvies.',
      title: 'Lijkt een sterke prijs',
    };
  }

  if (
    (state === 'exceptional_deal' || state === 'strong_deal') &&
    riskFlags.includes('single_merchant')
  ) {
    return {
      advice:
        'Scherpe prijs, maar gezien bij één winkel. Volgen geeft extra zekerheid.',
      title: 'Lijkt een sterke prijs',
    };
  }

  if (
    (state === 'exceptional_deal' ||
      state === 'strong_deal' ||
      state === 'good_deal') &&
    riskFlags.includes('volatile_price')
  ) {
    return {
      advice:
        'De prijs beweegt sterk. Kopen kan, maar volgen geeft meer zekerheid.',
      title: 'Lijkt een goede prijs',
    };
  }

  switch (state) {
    case 'exceptional_deal':
      return {
        advice:
          'Dit is een van de beste prijzen die we voor deze set hebben gezien.',
        title: 'Uitzonderlijke deal',
      };
    case 'strong_deal':
      return {
        advice: 'Deze prijs ligt duidelijk onder het normale niveau.',
        title: 'Sterke deal',
      };
    case 'good_deal':
      return {
        advice: 'Een nette prijs, maar geen uitzonderlijke aanbieding.',
        title: 'Goede prijs',
      };
    case 'market_price':
      return {
        advice: 'Deze prijs ligt rond het huidige marktbeeld.',
        title: 'Normale prijs',
      };
    case 'wait':
      return {
        advice:
          'De prijs lag recent lager. Volgen is waarschijnlijk slimmer dan nu kopen.',
        title: 'Wachten kan lonen',
      };
    case 'price_building':
      if (hasPurchasableOffer && hasClearReferenceDiscount) {
        return {
          advice:
            'Prijsbeeld bouwt nog op, maar deze actuele aanbieding ligt onder de referentie.',
          title: 'Goede actuele prijs',
        };
      }

      if (hasPurchasableOffer && isBestCurrentOffer) {
        return {
          advice:
            'Prijsbeeld bouwt nog op, maar dit is nu de beste gevonden prijs.',
          title: 'Beste actuele prijs',
        };
      }

      if (hasPurchasableOffer) {
        return {
          advice:
            'Prijsbeeld bouwt nog op, maar deze aanbieding is nu koopbaar.',
          title: 'Actuele aanbieding',
        };
      }

      return {
        advice:
          'We verzamelen nog prijsdata. Volg deze set om meldingen te krijgen bij prijsdalingen.',
        title: 'Prijsbeeld bouwt op',
      };
    case 'no_reliable_offer':
      return {
        advice: 'We hebben nog geen actuele betrouwbare aanbieding gevonden.',
        title: 'Geen betrouwbare prijs',
      };
  }
}

function buildHeroEvidence({
  currencyCode,
  currentPriceMinor,
  historyDays,
  lowest30dMinor,
  lowestEverMinor,
  merchantCount,
  now,
  observedAt,
  referenceLabel,
  referencePriceMinor,
}: {
  currencyCode: string;
  currentPriceMinor?: number;
  historyDays: number;
  lowest30dMinor?: number;
  lowestEverMinor?: number;
  merchantCount: number;
  now: Date;
  observedAt?: string;
  referenceLabel: string;
  referencePriceMinor?: number;
}): string[] {
  const evidence: string[] = [];

  if (currentPriceMinor && referencePriceMinor) {
    const referenceDeltaMinor = referencePriceMinor - currentPriceMinor;

    if (referenceDeltaMinor > 0) {
      evidence.push(
        `${formatHeroEvidenceAmount({
          currencyCode,
          minorUnits: referenceDeltaMinor,
        })} goedkoper dan ${referenceLabel}`,
      );
    } else if (referenceDeltaMinor < 0) {
      evidence.push(
        `${formatHeroEvidenceAmount({
          currencyCode,
          minorUnits: referenceDeltaMinor,
        })} boven ${referenceLabel}`,
      );
    }
  }

  if (currentPriceMinor && lowestEverMinor) {
    if (currentPriceMinor <= lowestEverMinor) {
      evidence.push('Laagste prijs ooit');
    } else {
      evidence.push(
        `${formatHeroEvidenceAmount({
          currencyCode,
          minorUnits: currentPriceMinor - lowestEverMinor,
        })} boven laagste prijs ooit`,
      );
    }
  }

  if (currentPriceMinor && lowest30dMinor) {
    if (currentPriceMinor <= lowest30dMinor) {
      evidence.push('Laagste prijs in 30 dagen');
    } else {
      evidence.push(
        `${formatHeroEvidenceAmount({
          currencyCode,
          minorUnits: currentPriceMinor - lowest30dMinor,
        })} boven laagste prijs in 30 dagen`,
      );
    }
  }

  if (observedAt) {
    const observedAtDate = new Date(observedAt);
    const isSameDay =
      Number.isFinite(observedAtDate.getTime()) &&
      observedAtDate.toDateString() === now.toDateString();

    evidence.push(isSameDay ? 'Vandaag gecontroleerd' : 'Recent gecontroleerd');
  }

  if (merchantCount > 0) {
    evidence.push(
      `${merchantCount} winkel${merchantCount === 1 ? '' : 's'} vergeleken`,
    );
  }

  if (historyDays >= 60) {
    const monthCount = Math.max(2, Math.round(historyDays / 30));

    evidence.push(`Gebaseerd op ${monthCount} maanden prijshistorie`);
  }

  return evidence.slice(0, 5);
}

function buildHeroReasonCodes({
  commerceIntent,
  confidenceScore,
  currentPriceMinor,
  dealScore,
  hasPurchasableOffer,
  isBestCurrentOffer,
  isPremiumDeal,
  lowest30dMinor,
  lowestEverMinor,
  primaryAction,
  referencePriceMinor,
  riskFlags,
  state,
}: {
  commerceIntent: HeroCommerceIntent;
  confidenceScore: number;
  currentPriceMinor?: number;
  dealScore: number;
  hasPurchasableOffer: boolean;
  isBestCurrentOffer: boolean;
  isPremiumDeal: boolean;
  lowest30dMinor?: number;
  lowestEverMinor?: number;
  primaryAction: HeroPrimaryAction;
  referencePriceMinor?: number;
  riskFlags: readonly HeroRiskFlag[];
  state: HeroDealState;
}): string[] {
  const reasonCodes: string[] = [
    `state:${state}`,
    `primary:${primaryAction}`,
    `commerce:${commerceIntent}`,
  ];

  if (hasPurchasableOffer) {
    reasonCodes.push('offer:purchasable');
  }

  if (dealScore >= 75) {
    reasonCodes.push('deal-score:strong');
  }

  if (isBestCurrentOffer) {
    reasonCodes.push('offer:best-current');
  }

  if (isPremiumDeal) {
    reasonCodes.push('surface:premium-deal');
  }

  if (confidenceScore < 60) {
    reasonCodes.push('confidence:cautious');
  } else {
    reasonCodes.push('confidence:usable');
  }

  if (currentPriceMinor && referencePriceMinor) {
    reasonCodes.push(
      currentPriceMinor < referencePriceMinor
        ? 'price:below-reference'
        : currentPriceMinor > referencePriceMinor
          ? 'price:above-reference'
          : 'price:on-reference',
    );
  }

  if (
    currentPriceMinor &&
    lowest30dMinor &&
    currentPriceMinor <= lowest30dMinor
  ) {
    reasonCodes.push('price:at-30d-low');
  }

  if (
    currentPriceMinor &&
    lowestEverMinor &&
    currentPriceMinor <= lowestEverMinor
  ) {
    reasonCodes.push('price:at-tracked-low');
  }

  reasonCodes.push(...riskFlags.map((riskFlag) => `risk:${riskFlag}`));

  return reasonCodes;
}

export function buildHeroDealPresentation({
  availability,
  currencyCode = EURO_CURRENCY_CODE,
  currentPriceMinor,
  dataQualityIssueCount = 0,
  hasMerchantOffer = true,
  hasReliableCurrentPrice = true,
  historyDays = 0,
  historyPointCount = 0,
  isBestCurrentOffer = false,
  isPremiumDeal = false,
  lowest30dMinor,
  lowestEverMinor,
  merchantCount = 0,
  now = new Date(),
  observedAt,
  priceTrend,
  priceVolatilityRatio,
  referenceLabel = 'referentie',
  referencePriceMinor,
  setAgeDays,
  setLifecycle,
}: HeroDealDecisionInput): HeroDealPresentation {
  const safeCurrentPriceMinor = isPositiveMinor(currentPriceMinor)
    ? currentPriceMinor
    : undefined;
  const safeReferencePriceMinor = isPositiveMinor(referencePriceMinor)
    ? referencePriceMinor
    : undefined;
  const safeLowest30dMinor = isPositiveMinor(lowest30dMinor)
    ? lowest30dMinor
    : undefined;
  const safeLowestEverMinor = isPositiveMinor(lowestEverMinor)
    ? lowestEverMinor
    : undefined;
  const safeMerchantCount = Math.max(0, Math.floor(merchantCount));
  const safeHistoryPointCount = Math.max(0, Math.floor(historyPointCount));
  const safeHistoryDays = Math.max(0, Math.floor(historyDays));
  const hasCurrentPrice =
    hasReliableCurrentPrice &&
    Boolean(safeCurrentPriceMinor) &&
    availability !== 'out_of_stock';
  const observedAtAgeDays = getObservedAtAgeDays({ now, observedAt });
  const riskFlags = buildHeroRiskFlags({
    availability,
    historyDays: safeHistoryDays,
    historyPointCount: safeHistoryPointCount,
    merchantCount: safeMerchantCount,
    observedAtAgeDays,
    priceVolatilityRatio,
    setAgeDays,
    setLifecycle,
  });
  const hasPurchasableOffer = resolveHasPurchasableOffer({
    hasCurrentPrice,
    hasMerchantOffer,
    riskFlags,
  });
  const hasClearReferenceDiscountSignal = hasClearReferenceDiscount({
    currentPriceMinor: safeCurrentPriceMinor,
    referencePriceMinor: safeReferencePriceMinor,
  });
  const dealScore = calculateHeroDealScore({
    currentPriceMinor: safeCurrentPriceMinor,
    lowest30dMinor: safeLowest30dMinor,
    lowestEverMinor: safeLowestEverMinor,
    merchantCount: safeMerchantCount,
    priceTrend,
    referencePriceMinor: safeReferencePriceMinor,
    setAgeDays,
    setLifecycle,
  });
  const confidenceScore = calculateHeroConfidenceScore({
    availability,
    dataQualityIssueCount,
    historyDays: safeHistoryDays,
    historyPointCount: safeHistoryPointCount,
    merchantCount: safeMerchantCount,
    observedAtAgeDays,
    priceVolatilityRatio,
  });
  const selectedState = resolveHeroDealState({
    confidenceScore,
    dealScore,
    hasClearReferenceDiscount: hasClearReferenceDiscountSignal,
    hasCurrentPrice,
    hasMerchantOffer,
    hasPurchasableOffer,
    isBestCurrentOffer,
    isPremiumDeal,
    merchantCount: safeMerchantCount,
    riskFlags,
  });
  const state = guardHeroDealStateForCommerce({
    hasClearReferenceDiscount: hasClearReferenceDiscountSignal,
    hasPurchasableOffer,
    isBestCurrentOffer,
    isPremiumDeal,
    merchantCount: safeMerchantCount,
    state: selectedState,
  });
  const commerceIntent = ensurePurchasableOfferInvariant({
    commerceIntent: resolveHeroCommerceIntent({
      dealScore,
      hasClearReferenceDiscount: hasClearReferenceDiscountSignal,
      hasPurchasableOffer,
      isBestCurrentOffer,
      isPremiumDeal,
      state,
    }),
    hasPurchasableOffer,
  });
  const primaryAction = resolveHeroPrimaryAction({
    commerceIntent,
    hasPurchasableOffer,
  });
  const reliableMerchantAction = hasReliableMerchantAction({
    hasPurchasableOffer,
  });
  const secondaryAction: HeroPrimaryAction | undefined =
    primaryAction === 'merchant'
      ? 'follow'
      : reliableMerchantAction
        ? 'merchant'
        : undefined;
  const safeSecondaryAction: HeroPrimaryAction | undefined =
    hasPurchasableOffer && primaryAction === 'follow'
      ? 'merchant'
      : secondaryAction;
  const merchantCtaIntent =
    primaryAction === 'merchant' || safeSecondaryAction === 'merchant'
      ? getHeroMerchantCtaIntent({ commerceIntent, state })
      : undefined;
  const followIntent = getHeroFollowIntent({ riskFlags, state });
  const { advice, title } = getHeroCopy({
    confidenceScore,
    hasClearReferenceDiscount: hasClearReferenceDiscountSignal,
    hasPurchasableOffer,
    isBestCurrentOffer,
    riskFlags,
    state,
  });
  const evidence = buildHeroEvidence({
    currencyCode,
    currentPriceMinor: safeCurrentPriceMinor,
    historyDays: safeHistoryDays,
    lowest30dMinor: safeLowest30dMinor,
    lowestEverMinor: safeLowestEverMinor,
    merchantCount: safeMerchantCount,
    now,
    observedAt,
    referenceLabel,
    referencePriceMinor: safeReferencePriceMinor,
  });
  const reasonCodes = buildHeroReasonCodes({
    commerceIntent,
    confidenceScore,
    currentPriceMinor: safeCurrentPriceMinor,
    dealScore,
    hasPurchasableOffer,
    isBestCurrentOffer,
    isPremiumDeal,
    lowest30dMinor: safeLowest30dMinor,
    lowestEverMinor: safeLowestEverMinor,
    primaryAction,
    referencePriceMinor: safeReferencePriceMinor,
    riskFlags,
    state,
  });

  return {
    advice,
    adviceCategory: getAdviceCategory(state),
    commerceIntent,
    confidenceScore,
    dealScore,
    evidence,
    followIntent,
    hasPurchasableOffer,
    ...(isBestCurrentOffer ? { isBestCurrentOffer } : {}),
    ...(isPremiumDeal ? { isPremiumDeal } : {}),
    ...(merchantCtaIntent ? { merchantCtaIntent } : {}),
    primaryAction,
    reasonCodes,
    riskFlags,
    ...(safeSecondaryAction ? { secondaryAction: safeSecondaryAction } : {}),
    signals: {
      ...(safeCurrentPriceMinor
        ? { currentPriceMinor: safeCurrentPriceMinor }
        : {}),
      historyDays: safeHistoryDays,
      historyPointCount: safeHistoryPointCount,
      ...(safeLowest30dMinor ? { lowest30dMinor: safeLowest30dMinor } : {}),
      ...(safeLowestEverMinor ? { lowestEverMinor: safeLowestEverMinor } : {}),
      merchantCount: safeMerchantCount,
      ...(observedAt ? { observedAt } : {}),
      ...(safeReferencePriceMinor
        ? { referencePriceMinor: safeReferencePriceMinor }
        : {}),
    },
    state,
    title,
  };
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
