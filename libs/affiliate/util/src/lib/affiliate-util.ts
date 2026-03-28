export interface AffiliateOffer {
  merchant: string;
  condition: string;
  totalPrice: string;
  perks: string;
  highlight: string;
}

export function sortAffiliateOffers(
  affiliateOffers: readonly AffiliateOffer[],
): AffiliateOffer[] {
  return [...affiliateOffers].sort((left, right) =>
    left.totalPrice.localeCompare(right.totalPrice, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}
