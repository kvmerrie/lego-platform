import {
  AffiliateOffer,
  sortAffiliateOffers,
} from '@lego-platform/affiliate/util';

const affiliateOffers: readonly AffiliateOffer[] = [
  {
    merchant: 'LEGO.com',
    condition: 'New',
    totalPrice: '$499',
    perks: 'VIP points + gift-with-purchase',
    highlight: 'Best direct-to-consumer collector experience.',
  },
  {
    merchant: 'Target',
    condition: 'New',
    totalPrice: '$489',
    perks: 'RedCard discount eligibility',
    highlight: 'Strong mainstream accessibility for casual shoppers.',
  },
  {
    merchant: 'eBay',
    condition: 'Sealed',
    totalPrice: '$541',
    perks: 'Wide reseller availability',
    highlight: 'Useful for price discovery and condition comparison.',
  },
];

export function listAffiliateOffers(): AffiliateOffer[] {
  return sortAffiliateOffers(affiliateOffers);
}
