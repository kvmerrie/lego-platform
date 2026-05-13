import {
  PRICE_HISTORY_WINDOW_DAYS,
  PRICING_HISTORY_TABLE,
  DUTCH_REGION_CODE,
  EURO_CURRENCY_CODE,
  NEW_OFFER_CONDITION,
  type PriceHistoryPoint,
  type PricePanelSnapshot,
  type PricingAvailability,
  type PricingObservation,
  type PricingSyncManifest,
} from '@lego-platform/pricing/util';
import {
  compareCommerceCommercialUnitPreference,
  getCommerceCommercialUnitComparisonGroup,
  isCommerceCommercialUnitComparableForDeals,
  type CommerceCommercialUnitType,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  curatedDutchPricingObservationSeeds,
  type PricingObservationSeed,
} from './pricing-observation-seeds';
import {
  dutchPricingReferenceValues,
  type PricingReferenceValue,
} from './pricing-reference-values';

export interface ValidatedPricingOfferInput extends PricingObservation {
  merchantProductUrl: string;
}

export interface PricingMerchantSummary {
  displayName: string;
  merchantId: string;
}

export interface PricingGeneratedArtifacts {
  pricePanelSnapshots: readonly PricePanelSnapshot[];
  pricingObservations: readonly PricingObservation[];
  pricingSyncManifest: PricingSyncManifest;
}

export interface BuildPricingSyncArtifactsResult
  extends PricingGeneratedArtifacts {
  validatedOfferInputs: readonly ValidatedPricingOfferInput[];
}

export type PricingHistorySupabaseClient = Pick<SupabaseClient, 'from'>;

export interface BuildDailyPriceHistoryPointsOptions {
  now?: Date;
  pricePanelSnapshots: readonly PricePanelSnapshot[];
}

export interface UpsertDailyPriceHistoryPointsOptions
  extends BuildDailyPriceHistoryPointsOptions {
  supabaseClient?: PricingHistorySupabaseClient;
}

export interface CommerceLatestOfferHistoryInput {
  latestOffer?: {
    availability?: string;
    currencyCode?: string;
    fetchedAt?: string;
    fetchStatus?: string;
    observedAt?: string;
    priceMinor?: number;
  };
  merchant?: {
    isActive: boolean;
    reliabilityTier?: 'production_feed' | 'strategic_manual';
    slug: string;
    trustedForHistory?: boolean;
  };
  offerSeed: {
    commercialUnitType?: CommerceCommercialUnitType;
    isActive: boolean;
    notes?: string;
    productUrl?: string;
    setId: string;
    validationStatus: string;
  };
}

export interface CommerceLatestOfferHistorySkipCounts {
  inactiveSeedOrMerchant: number;
  invalidSeed: number;
  missingLatest: number;
  missingOrInvalidPrice: number;
  nonEur: number;
  staleOrError: number;
  unitMismatch: number;
  untrustedMerchant: number;
  unavailableForHeadline: number;
}

export interface CommerceLatestOfferHistorySummary {
  dailyHistoryPointsBuilt: number;
  eligibleLatestOfferRows: number;
  availabilityCounts?: Record<string, number>;
  fetchStatusCounts?: Record<string, number>;
  latestOfferRowsSeen: number;
  maxObservedAgeHours: number;
  missingLatestCount?: number;
  newestObservedAt?: string;
  oldestObservedAt?: string;
  merchantSlugCounts?: Record<string, number>;
  seedRowsLoaded?: number;
  strategicManualOfferCount?: number;
  skipped: CommerceLatestOfferHistorySkipCounts;
  excludedUnitMismatchCount?: number;
  trustedOfferCount?: number;
  historyPointsFromTrusted?: number;
  ignoredForConfidenceCount?: number;
  staleOrErrorSamples?: CommerceLatestOfferHistoryStaleSample[];
  unitTypeCounts?: Record<string, number>;
  validationStatusCounts?: Record<string, number>;
}

export interface CommerceLatestOfferHistoryStaleSample {
  fetchedAt?: string;
  fetchStatus?: string;
  merchantSlug?: string;
  observedAt?: string;
  reason: 'fetch_status' | 'observed_at_too_old';
  setId: string;
}

export interface BuildDailyPriceHistoryPointsFromCommerceLatestOffersResult {
  points: PriceHistoryPoint[];
  summary: CommerceLatestOfferHistorySummary;
}

export interface BuildDailyPriceHistoryPointsFromCommerceLatestOffersOptions {
  latestOffers: readonly CommerceLatestOfferHistoryInput[];
  maxObservedAgeHours?: number;
  now?: Date;
  pricingReferenceValues?: readonly PricingReferenceValue[];
}

export interface UpsertDailyPriceHistoryPointsFromCommerceLatestOffersOptions
  extends BuildDailyPriceHistoryPointsFromCommerceLatestOffersOptions {
  supabaseClient?: PricingHistorySupabaseClient;
}

interface PersistedPriceHistoryRow {
  condition: PriceHistoryPoint['condition'];
  currency_code: PriceHistoryPoint['currencyCode'];
  headline_price_minor: PriceHistoryPoint['headlinePriceMinor'];
  lowest_merchant_id: PriceHistoryPoint['lowestMerchantId'] | null;
  observed_at: PriceHistoryPoint['observedAt'];
  recorded_on: PriceHistoryPoint['recordedOn'];
  reference_price_minor: PriceHistoryPoint['referencePriceMinor'] | null;
  region_code: PriceHistoryPoint['regionCode'];
  set_id: PriceHistoryPoint['setId'];
}

interface CommerceLatestOfferHistoryCandidate {
  commercialUnitType?: CommerceCommercialUnitType;
  point: PriceHistoryPoint;
}

export const DEFAULT_COMMERCE_LATEST_OFFER_HISTORY_MAX_AGE_HOURS = 48;
const COMMERCE_LATEST_OFFER_HISTORY_STALE_SAMPLE_LIMIT = 12;

function toRecordedOn(now?: Date): string {
  return (now ?? new Date()).toISOString().slice(0, 10);
}

function createEmptyCommerceLatestOfferHistorySkipCounts(): CommerceLatestOfferHistorySkipCounts {
  return {
    inactiveSeedOrMerchant: 0,
    invalidSeed: 0,
    missingLatest: 0,
    missingOrInvalidPrice: 0,
    nonEur: 0,
    staleOrError: 0,
    unitMismatch: 0,
    untrustedMerchant: 0,
    unavailableForHeadline: 0,
  };
}

function appendCommerceLatestOfferHistoryStaleSample({
  latestOffer,
  merchantSlug,
  samples,
  reason,
  setId,
}: {
  latestOffer: NonNullable<CommerceLatestOfferHistoryInput['latestOffer']>;
  merchantSlug?: string;
  samples: CommerceLatestOfferHistoryStaleSample[];
  reason: CommerceLatestOfferHistoryStaleSample['reason'];
  setId: string;
}): void {
  if (samples.length >= COMMERCE_LATEST_OFFER_HISTORY_STALE_SAMPLE_LIMIT) {
    return;
  }

  samples.push({
    fetchedAt: latestOffer.fetchedAt,
    fetchStatus: latestOffer.fetchStatus,
    merchantSlug,
    observedAt: latestOffer.observedAt,
    reason,
    setId,
  });
}

function incrementCommerceHistoryCount(
  counts: Record<string, number>,
  value: string | undefined,
): void {
  const key = value?.trim() || 'missing';

  counts[key] = (counts[key] ?? 0) + 1;
}

function normalizeCommerceLatestOfferCurrencyCode(value?: string): string {
  return (value ?? '').trim().toUpperCase();
}

function isHeadlineHistoryAvailability(value?: string): boolean {
  return value === 'in_stock' || value === 'limited';
}

function isValidObservedAt(value?: string): value is string {
  if (!value) {
    return false;
  }

  return Number.isFinite(new Date(value).getTime());
}

function isObservedAtWithinMaxAge({
  maxObservedAgeHours,
  now,
  observedAt,
}: {
  maxObservedAgeHours: number;
  now: Date;
  observedAt: string;
}): boolean {
  const observedTime = new Date(observedAt).getTime();
  const maxAgeMs = maxObservedAgeHours * 60 * 60 * 1000;

  return now.getTime() - observedTime <= maxAgeMs;
}

function validateObservedAt(value: string, seedLabel: string): string {
  const observedAt = new Date(value);

  if (Number.isNaN(observedAt.getTime())) {
    throw new Error(`${seedLabel} has an invalid observedAt timestamp.`);
  }

  return observedAt.toISOString();
}

function validatePricingAvailability(
  availability: PricingAvailability,
  seedLabel: string,
): PricingAvailability {
  if (
    availability !== 'in_stock' &&
    availability !== 'limited' &&
    availability !== 'out_of_stock' &&
    availability !== 'preorder' &&
    availability !== 'unknown'
  ) {
    throw new Error(`${seedLabel} has an invalid availability value.`);
  }

  return availability;
}

function validatePricingObservationSeed(
  pricingObservationSeed: PricingObservationSeed,
): ValidatedPricingOfferInput {
  const seedLabel = `Pricing observation ${pricingObservationSeed.setId}/${pricingObservationSeed.merchantId}`;

  if (pricingObservationSeed.regionCode !== DUTCH_REGION_CODE) {
    throw new Error(`${seedLabel} must use the Dutch market region code.`);
  }

  if (pricingObservationSeed.currencyCode !== EURO_CURRENCY_CODE) {
    throw new Error(`${seedLabel} must use EUR pricing.`);
  }

  if (pricingObservationSeed.condition !== NEW_OFFER_CONDITION) {
    throw new Error(`${seedLabel} must use the new-condition pricing slice.`);
  }

  if (!pricingObservationSeed.setId.trim()) {
    throw new Error(`${seedLabel} must include a setId.`);
  }

  if (!pricingObservationSeed.merchantId.trim()) {
    throw new Error(`${seedLabel} must include a merchantId.`);
  }

  if (
    !Number.isInteger(pricingObservationSeed.totalPriceMinor) ||
    pricingObservationSeed.totalPriceMinor <= 0
  ) {
    throw new Error(
      `${seedLabel} must include a positive totalPriceMinor value.`,
    );
  }

  let merchantProductUrl: URL;

  try {
    merchantProductUrl = new URL(pricingObservationSeed.merchantProductUrl);
  } catch {
    throw new Error(`${seedLabel} must include a valid merchant product URL.`);
  }

  return {
    setId: pricingObservationSeed.setId.trim(),
    merchantId: pricingObservationSeed.merchantId.trim(),
    merchantProductUrl: merchantProductUrl.toString(),
    totalPriceMinor: pricingObservationSeed.totalPriceMinor,
    availability: validatePricingAvailability(
      pricingObservationSeed.availability,
      seedLabel,
    ),
    commercialUnitType: pricingObservationSeed.commercialUnitType ?? 'full_set',
    observedAt: validateObservedAt(
      pricingObservationSeed.observedAt,
      seedLabel,
    ),
    regionCode: pricingObservationSeed.regionCode,
    currencyCode: pricingObservationSeed.currencyCode,
    condition: pricingObservationSeed.condition,
  };
}

function isHeadlineEligibleAvailability(
  availability: PricingAvailability,
): boolean {
  return availability === 'in_stock' || availability === 'limited';
}

function toAvailabilityLabel(availability: PricingAvailability): string {
  switch (availability) {
    case 'in_stock':
      return 'In stock';
    case 'limited':
      return 'Limited stock';
    case 'out_of_stock':
      return 'Out of stock';
    case 'preorder':
      return 'Pre-order';
    default:
      return 'Availability unknown';
  }
}

function selectComparablePricingObservations<
  Observation extends Pick<
    PricingObservation,
    'commercialUnitType' | 'observedAt' | 'totalPriceMinor'
  >,
>(observations: readonly Observation[]): Observation[] {
  if (observations.length <= 1) {
    return [...observations];
  }

  const priorities = {
    set_package: 0,
    single_item: 1,
    accessory: 2,
    magazine_bonus: 3,
  } as const;
  const preferredGroup = observations
    .map((observation) =>
      getCommerceCommercialUnitComparisonGroup(observation.commercialUnitType),
    )
    .filter((group): group is keyof typeof priorities => group in priorities)
    .sort((left, right) => priorities[left] - priorities[right])[0];

  if (!preferredGroup) {
    return [...observations];
  }

  return observations.filter(
    (observation) =>
      getCommerceCommercialUnitComparisonGroup(
        observation.commercialUnitType,
      ) === preferredGroup,
  );
}

function buildPricePanelSnapshot({
  merchantNameById,
  pricingObservations,
  referencePriceBySetId,
  setId,
}: {
  merchantNameById: ReadonlyMap<string, string>;
  pricingObservations: readonly PricingObservation[];
  referencePriceBySetId: ReadonlyMap<string, number>;
  setId: string;
}): PricePanelSnapshot | undefined {
  const eligibleObservations = selectComparablePricingObservations(
    pricingObservations.filter(
      (pricingObservation) =>
        pricingObservation.setId === setId &&
        isHeadlineEligibleAvailability(pricingObservation.availability),
    ),
  ).sort(
    (left, right) =>
      left.totalPriceMinor - right.totalPriceMinor ||
      right.observedAt.localeCompare(left.observedAt) ||
      left.merchantId.localeCompare(right.merchantId),
  );

  const headlineObservation = eligibleObservations[0];

  if (!headlineObservation) {
    return undefined;
  }

  const referencePriceMinor = isCommerceCommercialUnitComparableForDeals(
    headlineObservation.commercialUnitType,
  )
    ? referencePriceBySetId.get(setId)
    : undefined;
  const deltaMinor =
    typeof referencePriceMinor === 'number'
      ? headlineObservation.totalPriceMinor - referencePriceMinor
      : undefined;

  return {
    setId,
    regionCode: headlineObservation.regionCode,
    currencyCode: headlineObservation.currencyCode,
    condition: headlineObservation.condition,
    headlinePriceMinor: headlineObservation.totalPriceMinor,
    lowestAvailabilityLabel: toAvailabilityLabel(
      headlineObservation.availability,
    ),
    lowestMerchantId: headlineObservation.merchantId,
    lowestMerchantName:
      merchantNameById.get(headlineObservation.merchantId) ??
      headlineObservation.merchantId,
    merchantCount: eligibleObservations.length,
    observedAt: headlineObservation.observedAt,
    referencePriceMinor,
    deltaMinor,
  };
}

function getGeneratedAt({
  now,
  validatedOfferInputs,
}: {
  now?: Date;
  validatedOfferInputs: readonly ValidatedPricingOfferInput[];
}): string {
  if (now) {
    return now.toISOString();
  }

  return (
    [...validatedOfferInputs]
      .map((validatedOfferInput) => validatedOfferInput.observedAt)
      .sort()
      .at(-1) ?? new Date(0).toISOString()
  );
}

export function buildDailyPriceHistoryPoints({
  now,
  pricePanelSnapshots,
}: BuildDailyPriceHistoryPointsOptions): PriceHistoryPoint[] {
  const recordedOn = toRecordedOn(now);

  return [...pricePanelSnapshots]
    .map((pricePanelSnapshot) => ({
      setId: pricePanelSnapshot.setId,
      regionCode: pricePanelSnapshot.regionCode,
      currencyCode: pricePanelSnapshot.currencyCode,
      condition: pricePanelSnapshot.condition,
      headlinePriceMinor: pricePanelSnapshot.headlinePriceMinor,
      referencePriceMinor: pricePanelSnapshot.referencePriceMinor,
      lowestMerchantId: pricePanelSnapshot.lowestMerchantId,
      observedAt: pricePanelSnapshot.observedAt,
      recordedOn,
    }))
    .sort((left, right) => left.setId.localeCompare(right.setId));
}

export function buildDailyPriceHistoryPointsFromCommerceLatestOffers({
  latestOffers,
  maxObservedAgeHours = DEFAULT_COMMERCE_LATEST_OFFER_HISTORY_MAX_AGE_HOURS,
  now,
  pricingReferenceValues = dutchPricingReferenceValues,
}: BuildDailyPriceHistoryPointsFromCommerceLatestOffersOptions): BuildDailyPriceHistoryPointsFromCommerceLatestOffersResult {
  const recordedOn = toRecordedOn(now);
  const runDate = now ?? new Date();
  const referencePriceMinorBySetId = new Map(
    pricingReferenceValues.map((pricingReferenceValue) => [
      pricingReferenceValue.setId,
      pricingReferenceValue.referencePriceMinor,
    ]),
  );
  const skipped = createEmptyCommerceLatestOfferHistorySkipCounts();
  const availabilityCounts: Record<string, number> = {};
  const fetchStatusCounts: Record<string, number> = {};
  const merchantSlugCounts: Record<string, number> = {};
  const staleOrErrorSamples: CommerceLatestOfferHistoryStaleSample[] = [];
  const unitTypeCounts: Record<string, number> = {};
  const validationStatusCounts: Record<string, number> = {};
  const bestCandidateBySetId = new Map<
    string,
    CommerceLatestOfferHistoryCandidate
  >();
  let excludedUnitMismatchCount = 0;
  let eligibleLatestOfferRows = 0;
  let ignoredForConfidenceCount = 0;
  let strategicManualOfferCount = 0;
  let trustedOfferCount = 0;
  let latestOfferRowsSeen = 0;
  let newestObservedAt: string | undefined;
  let oldestObservedAt: string | undefined;

  for (const latestOfferInput of latestOffers) {
    const latestOffer = latestOfferInput.latestOffer;
    const merchant = latestOfferInput.merchant;
    const offerSeed = latestOfferInput.offerSeed;

    if (latestOffer) {
      latestOfferRowsSeen += 1;
      if (
        merchant?.trustedForHistory === true ||
        merchant?.reliabilityTier === 'production_feed'
      ) {
        trustedOfferCount += 1;
      } else if (
        merchant?.trustedForHistory === false ||
        merchant?.reliabilityTier === 'strategic_manual'
      ) {
        strategicManualOfferCount += 1;
      }
      incrementCommerceHistoryCount(
        availabilityCounts,
        latestOffer.availability,
      );
      incrementCommerceHistoryCount(fetchStatusCounts, latestOffer.fetchStatus);
    }
    incrementCommerceHistoryCount(merchantSlugCounts, merchant?.slug);
    incrementCommerceHistoryCount(
      validationStatusCounts,
      offerSeed.validationStatus,
    );
    incrementCommerceHistoryCount(unitTypeCounts, offerSeed.commercialUnitType);

    const loadedObservedAtInput = latestOffer?.observedAt;

    if (isValidObservedAt(loadedObservedAtInput)) {
      const loadedObservedAt = new Date(loadedObservedAtInput).toISOString();

      if (!newestObservedAt || loadedObservedAt > newestObservedAt) {
        newestObservedAt = loadedObservedAt;
      }

      if (!oldestObservedAt || loadedObservedAt < oldestObservedAt) {
        oldestObservedAt = loadedObservedAt;
      }
    }

    if (!offerSeed.isActive || merchant?.isActive !== true) {
      skipped.inactiveSeedOrMerchant += 1;
      continue;
    }

    if (offerSeed.validationStatus !== 'valid') {
      skipped.invalidSeed += 1;
      continue;
    }

    if (!latestOffer) {
      skipped.missingLatest += 1;
      continue;
    }

    if (latestOffer.fetchStatus !== 'success') {
      skipped.staleOrError += 1;
      appendCommerceLatestOfferHistoryStaleSample({
        latestOffer,
        merchantSlug: merchant?.slug,
        reason: 'fetch_status',
        samples: staleOrErrorSamples,
        setId: offerSeed.setId,
      });
      continue;
    }

    if (
      normalizeCommerceLatestOfferCurrencyCode(latestOffer.currencyCode) !==
      EURO_CURRENCY_CODE
    ) {
      skipped.nonEur += 1;
      continue;
    }

    if (
      !Number.isInteger(latestOffer.priceMinor) ||
      (latestOffer.priceMinor ?? 0) <= 0 ||
      !isValidObservedAt(latestOffer.observedAt)
    ) {
      skipped.missingOrInvalidPrice += 1;
      continue;
    }

    const observedAt = new Date(latestOffer.observedAt).toISOString();

    if (
      !isObservedAtWithinMaxAge({
        maxObservedAgeHours,
        now: runDate,
        observedAt,
      })
    ) {
      skipped.staleOrError += 1;
      appendCommerceLatestOfferHistoryStaleSample({
        latestOffer,
        merchantSlug: merchant?.slug,
        reason: 'observed_at_too_old',
        samples: staleOrErrorSamples,
        setId: offerSeed.setId,
      });
      continue;
    }

    if (!isHeadlineHistoryAvailability(latestOffer.availability)) {
      skipped.unavailableForHeadline += 1;
      continue;
    }

    const trustedForHistory =
      merchant?.trustedForHistory === true ||
      merchant?.reliabilityTier === 'production_feed';

    if (!trustedForHistory) {
      skipped.untrustedMerchant += 1;
      ignoredForConfidenceCount += 1;
      continue;
    }

    eligibleLatestOfferRows += 1;

    const point: PriceHistoryPoint = {
      setId: offerSeed.setId,
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
      headlinePriceMinor: latestOffer.priceMinor,
      referencePriceMinor: isCommerceCommercialUnitComparableForDeals(
        offerSeed.commercialUnitType,
      )
        ? referencePriceMinorBySetId.get(offerSeed.setId)
        : undefined,
      lowestMerchantId: merchant.slug,
      observedAt,
      recordedOn,
    };
    const candidate = {
      commercialUnitType: offerSeed.commercialUnitType,
      point,
    };
    const previousCandidate = bestCandidateBySetId.get(point.setId);
    const unitPreferenceDelta = previousCandidate
      ? compareCommerceCommercialUnitPreference(
          candidate.commercialUnitType,
          previousCandidate.commercialUnitType,
        )
      : 0;

    if (
      !previousCandidate ||
      unitPreferenceDelta < 0 ||
      (unitPreferenceDelta === 0 &&
        (point.headlinePriceMinor <
          previousCandidate.point.headlinePriceMinor ||
          (point.headlinePriceMinor ===
            previousCandidate.point.headlinePriceMinor &&
            (point.observedAt > previousCandidate.point.observedAt ||
              (point.observedAt === previousCandidate.point.observedAt &&
                (point.lowestMerchantId ?? '').localeCompare(
                  previousCandidate.point.lowestMerchantId ?? '',
                ) < 0)))))
    ) {
      if (previousCandidate && unitPreferenceDelta < 0) {
        excludedUnitMismatchCount += 1;
        skipped.unitMismatch += 1;
      }
      bestCandidateBySetId.set(point.setId, candidate);
    } else if (unitPreferenceDelta > 0) {
      excludedUnitMismatchCount += 1;
      skipped.unitMismatch += 1;
    }
  }

  const points = [...bestCandidateBySetId.values()]
    .map((candidate) => candidate.point)
    .sort((left, right) => left.setId.localeCompare(right.setId));

  return {
    points,
    summary: {
      dailyHistoryPointsBuilt: points.length,
      eligibleLatestOfferRows,
      availabilityCounts,
      fetchStatusCounts,
      latestOfferRowsSeen,
      maxObservedAgeHours,
      missingLatestCount: skipped.missingLatest,
      newestObservedAt,
      oldestObservedAt,
      merchantSlugCounts,
      seedRowsLoaded: latestOffers.length,
      strategicManualOfferCount,
      skipped,
      excludedUnitMismatchCount,
      staleOrErrorSamples,
      trustedOfferCount,
      historyPointsFromTrusted: points.length,
      ignoredForConfidenceCount,
      unitTypeCounts,
      validationStatusCounts,
    },
  };
}

async function upsertPersistedDailyPriceHistoryRows({
  dailyPriceHistoryPoints,
  supabaseClient,
}: {
  dailyPriceHistoryPoints: readonly PriceHistoryPoint[];
  supabaseClient?: PricingHistorySupabaseClient;
}): Promise<void> {
  if (dailyPriceHistoryPoints.length === 0) {
    return;
  }

  const persistedPriceHistoryRows: PersistedPriceHistoryRow[] =
    dailyPriceHistoryPoints.map((dailyPriceHistoryPoint) => ({
      set_id: dailyPriceHistoryPoint.setId,
      region_code: dailyPriceHistoryPoint.regionCode,
      currency_code: dailyPriceHistoryPoint.currencyCode,
      condition: dailyPriceHistoryPoint.condition,
      headline_price_minor: dailyPriceHistoryPoint.headlinePriceMinor,
      reference_price_minor: dailyPriceHistoryPoint.referencePriceMinor ?? null,
      lowest_merchant_id: dailyPriceHistoryPoint.lowestMerchantId ?? null,
      observed_at: dailyPriceHistoryPoint.observedAt,
      recorded_on: dailyPriceHistoryPoint.recordedOn,
    }));
  const client = supabaseClient ?? getServerSupabaseAdminClient();
  const { error } = await client
    .from(PRICING_HISTORY_TABLE)
    .upsert(persistedPriceHistoryRows, {
      onConflict: 'set_id,region_code,currency_code,condition,recorded_on',
    });

  if (error) {
    throw new Error(
      `Unable to persist ${PRICE_HISTORY_WINDOW_DAYS}-day pricing history points.`,
    );
  }
}

export async function upsertDailyPriceHistoryPoints({
  now,
  pricePanelSnapshots,
  supabaseClient,
}: UpsertDailyPriceHistoryPointsOptions): Promise<PriceHistoryPoint[]> {
  const dailyPriceHistoryPoints = buildDailyPriceHistoryPoints({
    now,
    pricePanelSnapshots,
  });

  if (dailyPriceHistoryPoints.length === 0) {
    return [];
  }

  await upsertPersistedDailyPriceHistoryRows({
    dailyPriceHistoryPoints,
    supabaseClient,
  });

  return dailyPriceHistoryPoints;
}

export async function upsertDailyPriceHistoryPointsFromCommerceLatestOffers({
  latestOffers,
  now,
  pricingReferenceValues,
  supabaseClient,
}: UpsertDailyPriceHistoryPointsFromCommerceLatestOffersOptions): Promise<BuildDailyPriceHistoryPointsFromCommerceLatestOffersResult> {
  const result = buildDailyPriceHistoryPointsFromCommerceLatestOffers({
    latestOffers,
    now,
    pricingReferenceValues,
  });

  await upsertPersistedDailyPriceHistoryRows({
    dailyPriceHistoryPoints: result.points,
    supabaseClient,
  });

  return result;
}

export function validatePricingSyncArtifacts({
  enabledSetIds,
  pricePanelSnapshots,
  pricingObservations,
}: {
  enabledSetIds: readonly string[];
  pricePanelSnapshots: readonly PricePanelSnapshot[];
  pricingObservations: readonly PricingObservation[];
}): void {
  const panelSnapshotSetIds = new Set(
    pricePanelSnapshots.map((pricePanelSnapshot) => pricePanelSnapshot.setId),
  );
  const observationKeys = new Set<string>();

  for (const pricingObservation of pricingObservations) {
    if (pricingObservation.regionCode !== DUTCH_REGION_CODE) {
      throw new Error(
        `Pricing observation ${pricingObservation.setId}/${pricingObservation.merchantId} has an invalid region code.`,
      );
    }

    if (pricingObservation.currencyCode !== EURO_CURRENCY_CODE) {
      throw new Error(
        `Pricing observation ${pricingObservation.setId}/${pricingObservation.merchantId} has an invalid currency code.`,
      );
    }

    if (pricingObservation.condition !== NEW_OFFER_CONDITION) {
      throw new Error(
        `Pricing observation ${pricingObservation.setId}/${pricingObservation.merchantId} has an invalid condition.`,
      );
    }

    const observationKey = `${pricingObservation.setId}:${pricingObservation.merchantId}`;

    if (observationKeys.has(observationKey)) {
      throw new Error(`Duplicate pricing observation for ${observationKey}.`);
    }

    observationKeys.add(observationKey);
  }

  for (const enabledSetId of enabledSetIds) {
    if (!panelSnapshotSetIds.has(enabledSetId)) {
      throw new Error(
        `No valid price panel snapshot was produced for commerce-enabled set ${enabledSetId}.`,
      );
    }
  }

  for (const pricePanelSnapshot of pricePanelSnapshots) {
    if (!pricePanelSnapshot.lowestMerchantName.trim()) {
      throw new Error(
        `Price panel snapshot ${pricePanelSnapshot.setId} is missing a lowest merchant display name.`,
      );
    }
  }
}

export function buildPricingSyncArtifacts({
  enabledSetIds,
  manifestNotes = 'Generated from a small Dutch-market commerce foundation. No runtime merchant calls or history are included.',
  manifestSource = 'curated-dutch-commerce-foundation',
  merchantSummaries = [],
  now,
  pricingObservationSeeds = curatedDutchPricingObservationSeeds,
  pricingReferenceValues = dutchPricingReferenceValues,
}: {
  enabledSetIds: readonly string[];
  manifestNotes?: string;
  manifestSource?: string;
  merchantSummaries?: readonly PricingMerchantSummary[];
  now?: Date;
  pricingObservationSeeds?: readonly PricingObservationSeed[];
  pricingReferenceValues?: readonly PricingReferenceValue[];
}): BuildPricingSyncArtifactsResult {
  const validatedOfferInputs = pricingObservationSeeds
    .map(validatePricingObservationSeed)
    .filter((validatedOfferInput) =>
      enabledSetIds.includes(validatedOfferInput.setId),
    )
    .sort(
      (left, right) =>
        left.setId.localeCompare(right.setId) ||
        left.totalPriceMinor - right.totalPriceMinor ||
        left.merchantId.localeCompare(right.merchantId),
    );
  const pricingObservations = validatedOfferInputs.map(
    (validatedOfferInput) => ({
      setId: validatedOfferInput.setId,
      merchantId: validatedOfferInput.merchantId,
      regionCode: validatedOfferInput.regionCode,
      currencyCode: validatedOfferInput.currencyCode,
      condition: validatedOfferInput.condition,
      totalPriceMinor: validatedOfferInput.totalPriceMinor,
      availability: validatedOfferInput.availability,
      commercialUnitType: validatedOfferInput.commercialUnitType,
      observedAt: validatedOfferInput.observedAt,
    }),
  );
  const referencePriceBySetId = new Map(
    pricingReferenceValues.map((pricingReferenceValue) => [
      pricingReferenceValue.setId,
      pricingReferenceValue.referencePriceMinor,
    ]),
  );
  const merchantNameById = new Map(
    merchantSummaries.map((merchantSummary) => [
      merchantSummary.merchantId,
      merchantSummary.displayName,
    ]),
  );
  const pricePanelSnapshots = enabledSetIds
    .map((enabledSetId) =>
      buildPricePanelSnapshot({
        merchantNameById,
        pricingObservations,
        referencePriceBySetId,
        setId: enabledSetId,
      }),
    )
    .filter(
      (pricePanelSnapshot): pricePanelSnapshot is PricePanelSnapshot =>
        pricePanelSnapshot !== undefined,
    );
  const pricingSyncManifest: PricingSyncManifest = {
    source: manifestSource,
    generatedAt: getGeneratedAt({
      now,
      validatedOfferInputs,
    }),
    observationCount: pricingObservations.length,
    setCount: pricePanelSnapshots.length,
    notes: manifestNotes,
  };

  validatePricingSyncArtifacts({
    enabledSetIds,
    pricePanelSnapshots,
    pricingObservations,
  });

  return {
    validatedOfferInputs,
    pricingObservations,
    pricePanelSnapshots,
    pricingSyncManifest,
  };
}
