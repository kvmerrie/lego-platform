import {
  DUTCH_REGION_CODE,
  EURO_CURRENCY_CODE,
  NEW_OFFER_CONDITION,
  type PricePanelSnapshot,
  type PricingAvailability,
  type PricingObservation,
  type PricingSyncManifest,
} from '@lego-platform/pricing/util';
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
    throw new Error(`${seedLabel} must include a positive totalPriceMinor value.`);
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
    observedAt: validateObservedAt(pricingObservationSeed.observedAt, seedLabel),
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
    lowestAvailabilityLabel: toAvailabilityLabel(headlineObservation.availability),
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

  return [...validatedOfferInputs]
    .map((validatedOfferInput) => validatedOfferInput.observedAt)
    .sort()
    .at(-1) ?? new Date(0).toISOString();
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
  merchantSummaries = [],
  now,
  pricingObservationSeeds = curatedDutchPricingObservationSeeds,
  pricingReferenceValues = dutchPricingReferenceValues,
}: {
  enabledSetIds: readonly string[];
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
  const pricingObservations = validatedOfferInputs.map((validatedOfferInput) => ({
    setId: validatedOfferInput.setId,
    merchantId: validatedOfferInput.merchantId,
    regionCode: validatedOfferInput.regionCode,
    currencyCode: validatedOfferInput.currencyCode,
    condition: validatedOfferInput.condition,
    totalPriceMinor: validatedOfferInput.totalPriceMinor,
    availability: validatedOfferInput.availability,
    observedAt: validatedOfferInput.observedAt,
  }));
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
    source: 'curated-dutch-commerce-foundation',
    generatedAt: getGeneratedAt({
      now,
      validatedOfferInputs,
    }),
    observationCount: pricingObservations.length,
    setCount: pricePanelSnapshots.length,
    notes:
      'Generated from a small Dutch-market commerce foundation. No runtime merchant calls or history are included.',
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
