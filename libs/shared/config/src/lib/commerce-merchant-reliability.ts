export const commerceMerchantReliabilityTiers = [
  'production_feed',
  'strategic_manual',
] as const;

export type CommerceMerchantReliabilityTier =
  (typeof commerceMerchantReliabilityTiers)[number];

export const STRATEGIC_MANUAL_BEST_OFFER_MIN_ADVANTAGE_MINOR = 2500;
export const STRATEGIC_MANUAL_BEST_OFFER_MIN_ADVANTAGE_RATIO = 0.15;

const productionFeedMerchantSlugs = [
  'goodbricks',
  'mediamarkt',
  'alternate',
  'coolblue',
  'misterbricks',
  'lidl',
] as const;

const strategicManualMerchantSlugs = [
  'coppenswarenhuis',
  'lego-nl',
  'bol',
  'intertoys',
  'wehkamp',
  'amazon-nl',
  'proshop',
  'smyths-toys',
  'top1toys',
] as const;

export const commerceProductionFeedMerchantSlugs = [
  ...productionFeedMerchantSlugs,
] as readonly string[];

export const commerceStrategicManualMerchantSlugs = [
  ...strategicManualMerchantSlugs,
] as readonly string[];

function normalizeMerchantSlug(merchantSlug?: string): string {
  return (merchantSlug ?? '').trim().toLowerCase();
}

export function getCommerceMerchantReliabilityTier(
  merchantSlug?: string,
): CommerceMerchantReliabilityTier {
  const normalizedMerchantSlug = normalizeMerchantSlug(merchantSlug);

  if (commerceProductionFeedMerchantSlugs.includes(normalizedMerchantSlug)) {
    return 'production_feed';
  }

  return 'strategic_manual';
}

export function isCommerceMerchantProductionFeed(
  merchantSlug?: string,
): boolean {
  return getCommerceMerchantReliabilityTier(merchantSlug) === 'production_feed';
}

export function isCommerceMerchantStrategicManual(
  merchantSlug?: string,
): boolean {
  return (
    getCommerceMerchantReliabilityTier(merchantSlug) === 'strategic_manual'
  );
}

export function canStrategicManualOfferBeatProductionFeed({
  productionFeedPriceMinor,
  strategicManualPriceMinor,
}: {
  productionFeedPriceMinor: number;
  strategicManualPriceMinor: number;
}): boolean {
  if (
    !Number.isFinite(productionFeedPriceMinor) ||
    !Number.isFinite(strategicManualPriceMinor) ||
    productionFeedPriceMinor <= 0 ||
    strategicManualPriceMinor <= 0 ||
    strategicManualPriceMinor >= productionFeedPriceMinor
  ) {
    return false;
  }

  const advantageMinor = productionFeedPriceMinor - strategicManualPriceMinor;
  const advantageRatio = advantageMinor / productionFeedPriceMinor;

  return (
    advantageMinor >= STRATEGIC_MANUAL_BEST_OFFER_MIN_ADVANTAGE_MINOR &&
    advantageRatio >= STRATEGIC_MANUAL_BEST_OFFER_MIN_ADVANTAGE_RATIO
  );
}
