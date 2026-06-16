export type CatalogMerchantClaim =
  | 'lowest-current'
  | 'selected-price'
  | 'availability'
  | 'only-found'
  | 'reviewed-lowest'
  | 'plain';

export interface CatalogMerchantPresentation {
  claim: CatalogMerchantClaim;
  label: string;
  merchantName?: string;
  merchantSlug?: string;
  prefix: string;
}

const CATALOG_MERCHANT_CLAIM_PREFIX: Record<CatalogMerchantClaim, string> = {
  availability: 'Verkrijgbaar bij',
  'lowest-current': 'Laagst bij',
  'only-found': 'Alleen gevonden bij',
  plain: '',
  'reviewed-lowest': 'Laagste reviewed prijs bij',
  'selected-price': 'Prijs bij',
};

export function getCatalogMerchantClaimPrefix(
  claim: CatalogMerchantClaim,
): string {
  return CATALOG_MERCHANT_CLAIM_PREFIX[claim];
}

export function buildCatalogMerchantPresentation({
  claim,
  merchantName,
  merchantSlug,
}: {
  claim: CatalogMerchantClaim;
  merchantName?: string;
  merchantSlug?: string;
}): CatalogMerchantPresentation {
  const trimmedMerchantName = merchantName?.trim();
  const prefix = getCatalogMerchantClaimPrefix(claim);
  const label = trimmedMerchantName
    ? [prefix, trimmedMerchantName].filter(Boolean).join(' ')
    : prefix;

  return {
    claim,
    label,
    ...(trimmedMerchantName ? { merchantName: trimmedMerchantName } : {}),
    ...(merchantSlug?.trim() ? { merchantSlug: merchantSlug.trim() } : {}),
    prefix,
  };
}
