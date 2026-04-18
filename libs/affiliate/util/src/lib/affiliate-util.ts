import type {
  AppCurrencyCode,
  AppMarketCode,
} from '@lego-platform/shared/config';

export const DUTCH_AFFILIATE_REGION_CODE = 'NL';
export const EURO_AFFILIATE_CURRENCY_CODE = 'EUR';
export const NEW_AFFILIATE_OFFER_CONDITION = 'new';

export type AffiliateRegionCode = AppMarketCode;
export type AffiliateCurrencyCode = AppCurrencyCode;
export type AffiliateCondition = typeof NEW_AFFILIATE_OFFER_CONDITION;
export type CatalogOfferMerchant = 'bol' | 'amazon' | 'lego' | 'other';
export type CatalogOfferAvailability = 'in_stock' | 'out_of_stock' | 'unknown';
export type CatalogOfferMarket = AppMarketCode;

export interface CatalogOffer {
  availability: CatalogOfferAvailability;
  checkedAt: string;
  condition: AffiliateCondition;
  currency: AppCurrencyCode;
  market: CatalogOfferMarket;
  merchant: CatalogOfferMerchant;
  merchantName: string;
  priceCents: number;
  setId: string;
  url: string;
}

const catalogOfferMerchantNameByMerchant: Record<CatalogOfferMerchant, string> =
  {
    bol: 'bol',
    amazon: 'Amazon',
    lego: 'LEGO',
    other: 'Other',
  };

const catalogOfferAvailabilityLabelByAvailability: Record<
  CatalogOfferAvailability,
  string
> = {
  in_stock: 'In stock',
  out_of_stock: 'Out of stock',
  unknown: 'Unknown',
};

export interface AffiliateMerchantConfig {
  ctaLabel: string;
  currencyCode: AffiliateCurrencyCode;
  disclosureCopy: string;
  displayName: string;
  displayRank: number;
  enabled: boolean;
  merchantId: string;
  perks?: string;
  regionCode: AffiliateRegionCode;
  urlHost: string;
}

export interface AffiliateOfferSnapshot {
  availabilityLabel: string;
  condition: AffiliateCondition;
  currencyCode: AffiliateCurrencyCode;
  ctaLabel: string;
  disclosureCopy: string;
  displayRank: number;
  merchantId: string;
  merchantName: string;
  observedAt: string;
  outboundUrl: string;
  perks?: string;
  regionCode: AffiliateRegionCode;
  setId: string;
  totalPriceMinor: number;
}

export interface AffiliateSyncManifest {
  generatedAt: string;
  merchantCount: number;
  notes?: string;
  offerCount: number;
  setCount: number;
  source: string;
}

export function normalizeAffiliateUrlHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function getCatalogOfferAvailabilityRank(
  availability: CatalogOfferAvailability,
): number {
  if (availability === 'in_stock') {
    return 0;
  }

  if (availability === 'unknown') {
    return 1;
  }

  return 2;
}

export function getCatalogOfferMerchantName(
  merchant: CatalogOfferMerchant,
): string {
  return catalogOfferMerchantNameByMerchant[merchant];
}

export function getCatalogOfferAvailabilityLabel(
  availability: CatalogOfferAvailability,
): string {
  return catalogOfferAvailabilityLabelByAvailability[availability];
}

function getCatalogOfferMerchantFromAffiliateMerchantId(
  merchantId: string,
): CatalogOfferMerchant {
  if (merchantId === 'bol') {
    return 'bol';
  }

  if (merchantId.startsWith('amazon')) {
    return 'amazon';
  }

  if (merchantId.startsWith('lego')) {
    return 'lego';
  }

  return 'other';
}

function getCatalogOfferAvailabilityFromAffiliateLabel(
  availabilityLabel: string,
): CatalogOfferAvailability {
  if (
    availabilityLabel === 'In stock' ||
    availabilityLabel === 'Limited stock'
  ) {
    return 'in_stock';
  }

  if (availabilityLabel === 'Out of stock') {
    return 'out_of_stock';
  }

  return 'unknown';
}

export function sortCatalogOffers(
  catalogOffers: readonly CatalogOffer[],
): CatalogOffer[] {
  return [...catalogOffers].sort(
    (left, right) =>
      getCatalogOfferAvailabilityRank(left.availability) -
        getCatalogOfferAvailabilityRank(right.availability) ||
      left.priceCents - right.priceCents ||
      left.merchantName.localeCompare(right.merchantName),
  );
}

export function getBestOffer(
  catalogOffers: readonly CatalogOffer[],
): CatalogOffer | null {
  const inStockOffers = catalogOffers.filter(
    (catalogOffer) => catalogOffer.availability === 'in_stock',
  );
  const candidateOffers =
    inStockOffers.length > 0 ? inStockOffers : [...catalogOffers];

  if (!candidateOffers.length) {
    return null;
  }

  const [bestOffer] = [...candidateOffers].sort(
    (left, right) =>
      left.priceCents - right.priceCents ||
      left.checkedAt.localeCompare(right.checkedAt) ||
      left.merchantName.localeCompare(right.merchantName),
  );

  return bestOffer ?? null;
}

export function toCatalogOffer(
  affiliateOffer: AffiliateOfferSnapshot,
): CatalogOffer {
  return {
    setId: affiliateOffer.setId,
    merchant: getCatalogOfferMerchantFromAffiliateMerchantId(
      affiliateOffer.merchantId,
    ),
    merchantName: affiliateOffer.merchantName,
    url: affiliateOffer.outboundUrl,
    priceCents: affiliateOffer.totalPriceMinor,
    currency: affiliateOffer.currencyCode,
    availability: getCatalogOfferAvailabilityFromAffiliateLabel(
      affiliateOffer.availabilityLabel,
    ),
    condition: affiliateOffer.condition,
    checkedAt: affiliateOffer.observedAt,
    market: affiliateOffer.regionCode,
  };
}

export function toCatalogOffers(
  affiliateOffers: readonly AffiliateOfferSnapshot[],
): CatalogOffer[] {
  return sortCatalogOffers(affiliateOffers.map(toCatalogOffer));
}

export function getCatalogOfferComparisonInsight(
  catalogOffers: readonly CatalogOffer[],
): string | undefined {
  if (catalogOffers.length <= 2) {
    return `Only ${catalogOffers.length} reviewed offer${catalogOffers.length === 1 ? '' : 's'} so far`;
  }

  if (catalogOffers.length === 0) {
    return undefined;
  }

  const priceCents = catalogOffers.map(
    (catalogOffer) => catalogOffer.priceCents,
  );
  const spreadCents = Math.max(...priceCents) - Math.min(...priceCents);

  if (spreadCents <= 1000) {
    return 'Small price gap across reviewed shops';
  }

  if (spreadCents >= 3000) {
    return 'Wide price gap across reviewed shops';
  }

  return undefined;
}

export function sortAffiliateOffers(
  affiliateOffers: readonly AffiliateOfferSnapshot[],
): AffiliateOfferSnapshot[] {
  return [...affiliateOffers].sort(
    (left, right) =>
      left.totalPriceMinor - right.totalPriceMinor ||
      left.displayRank - right.displayRank ||
      left.merchantName.localeCompare(right.merchantName),
  );
}

function renderAffiliateGeneratedModule<
  T extends AffiliateSyncManifest | readonly AffiliateOfferSnapshot[],
>({
  exportName,
  importNames,
  typeAnnotation,
  payload,
}: {
  exportName: 'affiliateOfferSnapshots' | 'affiliateSyncManifest';
  importNames: string[];
  typeAnnotation: string;
  payload: T;
}): string {
  const payloadVariableName = `${exportName}Payload`;
  const exportLine =
    exportName === 'affiliateOfferSnapshots'
      ? `export const ${exportName}: ${typeAnnotation} =
  JSON.parse(
    ${payloadVariableName},
  ) as ${typeAnnotation};`
      : `export const ${exportName}: ${typeAnnotation} = JSON.parse(
  ${payloadVariableName},
) as ${typeAnnotation};`;

  return `import type { ${importNames.join(', ')} } from '@lego-platform/affiliate/util';

// Generated by apps/commerce-sync. Do not edit by hand.
const ${payloadVariableName} = String.raw\`${JSON.stringify(payload, null, 2)}\`;

${exportLine}
`;
}

export function renderAffiliateOfferSnapshotsModule(
  affiliateOfferSnapshots: readonly AffiliateOfferSnapshot[],
): string {
  return renderAffiliateGeneratedModule({
    exportName: 'affiliateOfferSnapshots',
    importNames: ['AffiliateOfferSnapshot'],
    typeAnnotation: 'readonly AffiliateOfferSnapshot[]',
    payload: affiliateOfferSnapshots,
  });
}

export function renderAffiliateSyncManifestModule(
  affiliateSyncManifest: AffiliateSyncManifest,
): string {
  return renderAffiliateGeneratedModule({
    exportName: 'affiliateSyncManifest',
    importNames: ['AffiliateSyncManifest'],
    typeAnnotation: 'AffiliateSyncManifest',
    payload: affiliateSyncManifest,
  });
}
