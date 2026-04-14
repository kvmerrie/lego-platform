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

function toRecordedOn(now?: Date): string {
  return (now ?? new Date()).toISOString().slice(0, 10);
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
  const eligibleObservations = pricingObservations
    .filter(
      (pricingObservation) =>
        pricingObservation.setId === setId &&
        isHeadlineEligibleAvailability(pricingObservation.availability),
    )
    .sort(
      (left, right) =>
        left.totalPriceMinor - right.totalPriceMinor ||
        right.observedAt.localeCompare(left.observedAt) ||
        left.merchantId.localeCompare(right.merchantId),
    );

  const headlineObservation = eligibleObservations[0];

  if (!headlineObservation) {
    return undefined;
  }

  const referencePriceMinor = referencePriceBySetId.get(setId);
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

  return dailyPriceHistoryPoints;
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
