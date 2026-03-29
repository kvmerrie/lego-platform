import { type AffiliateOfferSnapshot, sortAffiliateOffers } from '@lego-platform/affiliate/util';
import { affiliateOfferSnapshots } from './affiliate-offers.generated';

export function listAffiliateOffers(setId: string): AffiliateOfferSnapshot[] {
  return sortAffiliateOffers(
    affiliateOfferSnapshots.filter(
      (affiliateOfferSnapshot) => affiliateOfferSnapshot.setId === setId,
    ),
  );
}
