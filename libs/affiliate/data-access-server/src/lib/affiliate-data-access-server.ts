import {
  DUTCH_AFFILIATE_REGION_CODE,
  EURO_AFFILIATE_CURRENCY_CODE,
  NEW_AFFILIATE_OFFER_CONDITION,
  type AffiliateMerchantConfig,
  type AffiliateOfferSnapshot,
  type AffiliateSyncManifest,
  normalizeAffiliateUrlHost,
} from '@lego-platform/affiliate/util';
import { dutchAffiliateMerchantConfigs } from './merchant-config';

export interface AffiliateOfferCandidateInput {
  availability:
    | 'in_stock'
    | 'limited'
    | 'out_of_stock'
    | 'preorder'
    | 'unknown';
  condition: 'new';
  currencyCode: 'EUR';
  merchantId: string;
  merchantProductUrl: string;
  observedAt: string;
  regionCode: 'NL';
  setId: string;
  totalPriceMinor: number;
}

export interface AffiliateGeneratedArtifacts {
  affiliateOfferSnapshots: readonly AffiliateOfferSnapshot[];
  affiliateSyncManifest: AffiliateSyncManifest;
}

function toAvailabilityLabel(
  availability: AffiliateOfferCandidateInput['availability'],
): string {
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

function getGeneratedAt({
  affiliateOfferSnapshots,
  now,
}: {
  affiliateOfferSnapshots: readonly AffiliateOfferSnapshot[];
  now?: Date;
}): string {
  if (now) {
    return now.toISOString();
  }

  return (
    [...affiliateOfferSnapshots]
      .map((affiliateOfferSnapshot) => affiliateOfferSnapshot.observedAt)
      .sort()
      .at(-1) ?? new Date(0).toISOString()
  );
}

export function validateAffiliateMerchantConfigs(
  affiliateMerchantConfigs: readonly AffiliateMerchantConfig[],
): void {
  const merchantIds = new Set<string>();
  const regionDisplayRanks = new Set<string>();

  for (const affiliateMerchantConfig of affiliateMerchantConfigs) {
    if (merchantIds.has(affiliateMerchantConfig.merchantId)) {
      throw new Error(
        `Duplicate affiliate merchant id: ${affiliateMerchantConfig.merchantId}.`,
      );
    }

    merchantIds.add(affiliateMerchantConfig.merchantId);

    const regionDisplayRankKey = `${affiliateMerchantConfig.regionCode}:${affiliateMerchantConfig.displayRank}`;

    if (regionDisplayRanks.has(regionDisplayRankKey)) {
      throw new Error(
        `Duplicate affiliate display rank ${affiliateMerchantConfig.displayRank} within ${affiliateMerchantConfig.regionCode}.`,
      );
    }

    regionDisplayRanks.add(regionDisplayRankKey);

    if (affiliateMerchantConfig.regionCode !== DUTCH_AFFILIATE_REGION_CODE) {
      throw new Error(
        `Merchant ${affiliateMerchantConfig.merchantId} has an invalid affiliate region code.`,
      );
    }

    if (affiliateMerchantConfig.currencyCode !== EURO_AFFILIATE_CURRENCY_CODE) {
      throw new Error(
        `Merchant ${affiliateMerchantConfig.merchantId} has an invalid affiliate currency code.`,
      );
    }
  }
}

export function validateAffiliateSyncArtifacts({
  affiliateMerchantConfigs,
  affiliateOfferSnapshots,
  enabledSetIds,
}: {
  affiliateMerchantConfigs: readonly AffiliateMerchantConfig[];
  affiliateOfferSnapshots: readonly AffiliateOfferSnapshot[];
  enabledSetIds: readonly string[];
}): void {
  validateAffiliateMerchantConfigs(affiliateMerchantConfigs);

  const merchantConfigById = new Map(
    affiliateMerchantConfigs.map((affiliateMerchantConfig) => [
      affiliateMerchantConfig.merchantId,
      affiliateMerchantConfig,
    ]),
  );
  const setIdsWithOffers = new Set<string>();

  for (const affiliateOfferSnapshot of affiliateOfferSnapshots) {
    const affiliateMerchantConfig = merchantConfigById.get(
      affiliateOfferSnapshot.merchantId,
    );

    if (!affiliateMerchantConfig || !affiliateMerchantConfig.enabled) {
      throw new Error(
        `Missing affiliate config for enabled offer ${affiliateOfferSnapshot.setId}/${affiliateOfferSnapshot.merchantId}.`,
      );
    }

    if (affiliateOfferSnapshot.regionCode !== DUTCH_AFFILIATE_REGION_CODE) {
      throw new Error(
        `Affiliate offer ${affiliateOfferSnapshot.setId}/${affiliateOfferSnapshot.merchantId} has an invalid region code.`,
      );
    }

    if (affiliateOfferSnapshot.currencyCode !== EURO_AFFILIATE_CURRENCY_CODE) {
      throw new Error(
        `Affiliate offer ${affiliateOfferSnapshot.setId}/${affiliateOfferSnapshot.merchantId} has an invalid currency code.`,
      );
    }

    if (affiliateOfferSnapshot.condition !== NEW_AFFILIATE_OFFER_CONDITION) {
      throw new Error(
        `Affiliate offer ${affiliateOfferSnapshot.setId}/${affiliateOfferSnapshot.merchantId} has an invalid condition.`,
      );
    }

    setIdsWithOffers.add(affiliateOfferSnapshot.setId);
  }

  for (const enabledSetId of enabledSetIds) {
    if (!setIdsWithOffers.has(enabledSetId)) {
      throw new Error(
        `No valid affiliate offer snapshot was produced for commerce-enabled set ${enabledSetId}.`,
      );
    }
  }
}

export function buildAffiliateSyncArtifacts({
  affiliateMerchantConfigs = dutchAffiliateMerchantConfigs,
  enabledSetIds,
  manifestNotes = 'Generated from a small Dutch-market merchant allowlist. Outbound URLs remain direct in this first foundation phase.',
  manifestSource = 'curated-dutch-commerce-foundation',
  now,
  offerCandidateInputs,
}: {
  affiliateMerchantConfigs?: readonly AffiliateMerchantConfig[];
  enabledSetIds: readonly string[];
  manifestNotes?: string;
  manifestSource?: string;
  now?: Date;
  offerCandidateInputs: readonly AffiliateOfferCandidateInput[];
}): AffiliateGeneratedArtifacts {
  validateAffiliateMerchantConfigs(affiliateMerchantConfigs);

  const merchantConfigById = new Map(
    affiliateMerchantConfigs
      .filter((affiliateMerchantConfig) => affiliateMerchantConfig.enabled)
      .map((affiliateMerchantConfig) => [
        affiliateMerchantConfig.merchantId,
        affiliateMerchantConfig,
      ]),
  );
  const affiliateOfferSnapshots = offerCandidateInputs
    .filter((offerCandidateInput) =>
      enabledSetIds.includes(offerCandidateInput.setId),
    )
    .map((offerCandidateInput) => {
      const affiliateMerchantConfig = merchantConfigById.get(
        offerCandidateInput.merchantId,
      );

      if (!affiliateMerchantConfig) {
        throw new Error(
          `Missing affiliate config for enabled offer ${offerCandidateInput.setId}/${offerCandidateInput.merchantId}.`,
        );
      }

      if (offerCandidateInput.regionCode !== DUTCH_AFFILIATE_REGION_CODE) {
        throw new Error(
          `Offer candidate ${offerCandidateInput.setId}/${offerCandidateInput.merchantId} has an invalid region code.`,
        );
      }

      if (offerCandidateInput.currencyCode !== EURO_AFFILIATE_CURRENCY_CODE) {
        throw new Error(
          `Offer candidate ${offerCandidateInput.setId}/${offerCandidateInput.merchantId} has an invalid currency code.`,
        );
      }

      if (offerCandidateInput.condition !== NEW_AFFILIATE_OFFER_CONDITION) {
        throw new Error(
          `Offer candidate ${offerCandidateInput.setId}/${offerCandidateInput.merchantId} has an invalid condition.`,
        );
      }

      const outboundUrl = new URL(offerCandidateInput.merchantProductUrl);

      if (
        normalizeAffiliateUrlHost(outboundUrl.host) !==
        normalizeAffiliateUrlHost(affiliateMerchantConfig.urlHost)
      ) {
        throw new Error(
          `Offer candidate ${offerCandidateInput.setId}/${offerCandidateInput.merchantId} has an unexpected outbound host.`,
        );
      }

      return {
        setId: offerCandidateInput.setId,
        merchantId: offerCandidateInput.merchantId,
        merchantName: affiliateMerchantConfig.displayName,
        regionCode: offerCandidateInput.regionCode,
        currencyCode: offerCandidateInput.currencyCode,
        condition: offerCandidateInput.condition,
        totalPriceMinor: offerCandidateInput.totalPriceMinor,
        availabilityLabel: toAvailabilityLabel(
          offerCandidateInput.availability,
        ),
        outboundUrl: outboundUrl.toString(),
        disclosureCopy: affiliateMerchantConfig.disclosureCopy,
        observedAt: offerCandidateInput.observedAt,
        displayRank: affiliateMerchantConfig.displayRank,
        ctaLabel: affiliateMerchantConfig.ctaLabel,
        perks: affiliateMerchantConfig.perks,
      } satisfies AffiliateOfferSnapshot;
    })
    .sort(
      (left, right) =>
        left.setId.localeCompare(right.setId) ||
        left.totalPriceMinor - right.totalPriceMinor ||
        left.displayRank - right.displayRank,
    );
  const affiliateSyncManifest: AffiliateSyncManifest = {
    source: manifestSource,
    generatedAt: getGeneratedAt({
      affiliateOfferSnapshots,
      now,
    }),
    offerCount: affiliateOfferSnapshots.length,
    setCount: new Set(
      affiliateOfferSnapshots.map(
        (affiliateOfferSnapshot) => affiliateOfferSnapshot.setId,
      ),
    ).size,
    merchantCount: merchantConfigById.size,
    notes: manifestNotes,
  };

  validateAffiliateSyncArtifacts({
    affiliateMerchantConfigs,
    affiliateOfferSnapshots,
    enabledSetIds,
  });

  return {
    affiliateOfferSnapshots,
    affiliateSyncManifest,
  };
}
