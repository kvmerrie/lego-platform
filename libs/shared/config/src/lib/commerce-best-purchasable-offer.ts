import {
  compareCommerceCommercialUnitPreference,
  type CommerceCommercialUnitType,
} from './commerce-commercial-unit';
import { getCommerceMerchantReliabilityTier } from './commerce-merchant-reliability';
import {
  resolvePublicMerchantDisplayName,
  type AppCurrencyCode,
} from './config';

export type BestPurchasableOfferAvailability =
  | 'in_stock'
  | 'out_of_stock'
  | 'unknown';

export interface CommerceOfferLike {
  availability: BestPurchasableOfferAvailability;
  checkedAt: string;
  commercialUnitType?: CommerceCommercialUnitType;
  currency: AppCurrencyCode;
  merchant: string;
  merchantName: string;
  merchantSlug?: string;
  priceCents: number;
  setId: string;
  url: string;
}

export type BestPurchasableOfferSelectionReason =
  | 'lowest_price'
  | 'trusted_tiebreak'
  | 'strategic_tiebreak'
  | 'availability_override'
  | 'none';

export type BestPurchasableOfferRejectionReason =
  | 'out_of_stock'
  | 'stale'
  | 'unavailable';

export interface BestPurchasableOfferDebugSignals {
  staleFilteredCount: number;
  outOfStockFilteredCount: number;
  unavailableFilteredCount: number;
  tiedOfferCount: number;
  winningMerchant?: string;
  winningMerchantSlug?: string;
  winningPriceMinor?: number;
}

export interface BestPurchasableOfferResult<
  Offer extends CommerceOfferLike = CommerceOfferLike,
> {
  offer: Offer | null;
  merchantSlug?: string;
  priceMinor?: number;
  isPurchasable: boolean;
  merchantCount: number;
  selectionReason: BestPurchasableOfferSelectionReason;
  rankedOffers: Offer[];
  debugSignals: BestPurchasableOfferDebugSignals;
}

export interface SelectBestPurchasableOfferOptions<
  Offer extends CommerceOfferLike = CommerceOfferLike,
> {
  maxOfferAgeDays?: number;
  now?: Date;
  strategicTieBreakerOffer?: Offer | null;
}

export const DEFAULT_BEST_PURCHASABLE_OFFER_MAX_AGE_DAYS = 7;

function getCommerceOfferAvailabilityRank(
  availability: BestPurchasableOfferAvailability,
): number {
  if (availability === 'in_stock') {
    return 0;
  }

  if (availability === 'unknown') {
    return 1;
  }

  return 2;
}

function getCommerceOfferCheckedAtMs(commerceOffer: CommerceOfferLike): number {
  const checkedAtMs = Date.parse(commerceOffer.checkedAt);

  return Number.isFinite(checkedAtMs) ? checkedAtMs : 0;
}

function isCommerceOfferRecentEnough({
  commerceOffer,
  maxOfferAgeDays,
  now,
}: {
  commerceOffer: CommerceOfferLike;
  maxOfferAgeDays: number;
  now: Date;
}): boolean {
  const checkedAtMs = getCommerceOfferCheckedAtMs(commerceOffer);

  if (checkedAtMs <= 0) {
    return false;
  }

  const ageMs = now.getTime() - checkedAtMs;

  if (ageMs < 0) {
    return true;
  }

  return ageMs <= maxOfferAgeDays * 86_400_000;
}

export function getCommerceOfferMerchantSlug(
  commerceOffer?: CommerceOfferLike | null,
): string | undefined {
  return commerceOffer?.merchantSlug?.trim() || undefined;
}

export function getCommerceOfferPublicMerchantName(
  commerceOffer: CommerceOfferLike,
): string {
  return resolvePublicMerchantDisplayName({
    merchantName: commerceOffer.merchantName,
    merchantSlug: getCommerceOfferMerchantSlug(commerceOffer),
  });
}

function getCommerceOfferPublicMerchantKey(
  commerceOffer: CommerceOfferLike,
): string {
  return getCommerceOfferPublicMerchantName(commerceOffer)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getCommerceOfferTieBreakerKey(
  commerceOffer?: CommerceOfferLike | null,
): string | undefined {
  if (!commerceOffer) {
    return undefined;
  }

  return [
    getCommerceOfferMerchantSlug(commerceOffer) ?? commerceOffer.merchant,
    commerceOffer.url,
  ].join('|');
}

function compareCommercePublicMerchantDuplicatePreference<
  Offer extends CommerceOfferLike,
>(left: Offer, right: Offer): number {
  return (
    getCommerceOfferCheckedAtMs(right) - getCommerceOfferCheckedAtMs(left) ||
    left.priceCents - right.priceCents ||
    getCommerceOfferAvailabilityRank(left.availability) -
      getCommerceOfferAvailabilityRank(right.availability)
  );
}

export function dedupeCommerceOffersByPublicMerchant<
  Offer extends CommerceOfferLike,
>(commerceOffers: readonly Offer[]): Offer[] {
  const selectedOfferByPublicMerchantKey = new Map<string, Offer>();

  for (const commerceOffer of commerceOffers) {
    const publicMerchantKey = getCommerceOfferPublicMerchantKey(commerceOffer);
    const selectedOffer =
      selectedOfferByPublicMerchantKey.get(publicMerchantKey);

    if (
      !selectedOffer ||
      compareCommercePublicMerchantDuplicatePreference(
        commerceOffer,
        selectedOffer,
      ) < 0
    ) {
      selectedOfferByPublicMerchantKey.set(publicMerchantKey, commerceOffer);
    }
  }

  return [...selectedOfferByPublicMerchantKey.values()];
}

function getCommerceOfferReliabilityRank(
  commerceOffer: CommerceOfferLike,
): number {
  return getCommerceMerchantReliabilityTier(
    getCommerceOfferMerchantSlug(commerceOffer) ?? commerceOffer.merchant,
  ) === 'production_feed'
    ? 0
    : 1;
}

export function getCommercePurchasableOfferRejectionReason({
  commerceOffer,
  maxOfferAgeDays = DEFAULT_BEST_PURCHASABLE_OFFER_MAX_AGE_DAYS,
  now = new Date(),
}: {
  commerceOffer: CommerceOfferLike;
  maxOfferAgeDays?: number;
  now?: Date;
}): BestPurchasableOfferRejectionReason | undefined {
  if (
    !commerceOffer.url ||
    commerceOffer.priceCents <= 0 ||
    commerceOffer.currency !== 'EUR'
  ) {
    return 'unavailable';
  }

  if (commerceOffer.availability === 'out_of_stock') {
    return 'out_of_stock';
  }

  if (
    !isCommerceOfferRecentEnough({
      commerceOffer,
      maxOfferAgeDays,
      now,
    })
  ) {
    return 'stale';
  }

  return undefined;
}

function getBestPurchasableOfferSelectionReason<
  Offer extends CommerceOfferLike,
>({
  rankedOffers,
  strategicTieBreakerOffer,
}: {
  rankedOffers: readonly Offer[];
  strategicTieBreakerOffer?: Offer | null;
}): BestPurchasableOfferSelectionReason {
  const [winner, runnerUp] = rankedOffers;

  if (!winner) {
    return 'none';
  }

  if (!runnerUp) {
    return 'lowest_price';
  }

  if (
    winner.availability === 'in_stock' &&
    runnerUp.availability !== 'in_stock'
  ) {
    return 'availability_override';
  }

  if (winner.priceCents !== runnerUp.priceCents) {
    return 'lowest_price';
  }

  if (
    getCommerceOfferReliabilityRank(winner) <
    getCommerceOfferReliabilityRank(runnerUp)
  ) {
    return 'trusted_tiebreak';
  }

  if (
    strategicTieBreakerOffer &&
    getCommerceOfferTieBreakerKey(winner) ===
      getCommerceOfferTieBreakerKey(strategicTieBreakerOffer)
  ) {
    return 'strategic_tiebreak';
  }

  return 'lowest_price';
}

export function selectBestPurchasableOffer<Offer extends CommerceOfferLike>(
  commerceOffers: readonly Offer[],
  options: SelectBestPurchasableOfferOptions<Offer> = {},
): BestPurchasableOfferResult<Offer> {
  const maxOfferAgeDays =
    options.maxOfferAgeDays ?? DEFAULT_BEST_PURCHASABLE_OFFER_MAX_AGE_DAYS;
  const now = options.now ?? new Date();
  const debugSignals: BestPurchasableOfferDebugSignals = {
    staleFilteredCount: 0,
    outOfStockFilteredCount: 0,
    unavailableFilteredCount: 0,
    tiedOfferCount: 0,
  };
  const dedupedOffers = dedupeCommerceOffersByPublicMerchant(commerceOffers);
  const purchasableOffers = dedupedOffers.filter((commerceOffer) => {
    const rejectionReason = getCommercePurchasableOfferRejectionReason({
      commerceOffer,
      maxOfferAgeDays,
      now,
    });

    if (rejectionReason === 'stale') {
      debugSignals.staleFilteredCount += 1;
      return false;
    }

    if (rejectionReason === 'out_of_stock') {
      debugSignals.outOfStockFilteredCount += 1;
      return false;
    }

    if (rejectionReason === 'unavailable') {
      debugSignals.unavailableFilteredCount += 1;
      return false;
    }

    return true;
  });
  const strategicTieBreakerKey = getCommerceOfferTieBreakerKey(
    options.strategicTieBreakerOffer,
  );
  const rankedOffers = [...purchasableOffers].sort((left, right) => {
    const availabilityDelta =
      getCommerceOfferAvailabilityRank(left.availability) -
      getCommerceOfferAvailabilityRank(right.availability);

    if (availabilityDelta !== 0) {
      return availabilityDelta;
    }

    const commercialUnitDelta = compareCommerceCommercialUnitPreference(
      left.commercialUnitType,
      right.commercialUnitType,
    );

    if (commercialUnitDelta !== 0) {
      return commercialUnitDelta;
    }

    const priceDelta = left.priceCents - right.priceCents;

    if (priceDelta !== 0) {
      return priceDelta;
    }

    const reliabilityDelta =
      getCommerceOfferReliabilityRank(left) -
      getCommerceOfferReliabilityRank(right);

    if (reliabilityDelta !== 0) {
      return reliabilityDelta;
    }

    if (strategicTieBreakerKey) {
      const leftMatchesStrategic =
        getCommerceOfferTieBreakerKey(left) === strategicTieBreakerKey;
      const rightMatchesStrategic =
        getCommerceOfferTieBreakerKey(right) === strategicTieBreakerKey;

      if (leftMatchesStrategic !== rightMatchesStrategic) {
        return leftMatchesStrategic ? -1 : 1;
      }
    }

    return (
      getCommerceOfferCheckedAtMs(right) - getCommerceOfferCheckedAtMs(left) ||
      getCommerceOfferPublicMerchantName(left).localeCompare(
        getCommerceOfferPublicMerchantName(right),
      )
    );
  });
  const [offer] = rankedOffers;

  if (offer) {
    debugSignals.tiedOfferCount = rankedOffers.filter(
      (candidateOffer) => candidateOffer.priceCents === offer.priceCents,
    ).length;
    debugSignals.winningMerchant = getCommerceOfferPublicMerchantName(offer);
    debugSignals.winningMerchantSlug = getCommerceOfferMerchantSlug(offer);
    debugSignals.winningPriceMinor = offer.priceCents;
  }

  return {
    offer: offer ?? null,
    merchantSlug: offer ? getCommerceOfferMerchantSlug(offer) : undefined,
    priceMinor: offer?.priceCents,
    isPurchasable: Boolean(offer),
    merchantCount: dedupedOffers.length,
    selectionReason: getBestPurchasableOfferSelectionReason({
      rankedOffers,
      strategicTieBreakerOffer: options.strategicTieBreakerOffer,
    }),
    rankedOffers,
    debugSignals,
  };
}
