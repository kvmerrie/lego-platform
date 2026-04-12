import {
  getBestOffer,
  type AffiliateOfferSnapshot,
  sortAffiliateOffers,
  toCatalogOffers,
  type CatalogOffer,
} from '@lego-platform/affiliate/util';
import { affiliateOfferSnapshots } from './affiliate-offers.generated';

export function listAffiliateOffers(setId: string): AffiliateOfferSnapshot[] {
  return sortAffiliateOffers(
    affiliateOfferSnapshots.filter(
      (affiliateOfferSnapshot) => affiliateOfferSnapshot.setId === setId,
    ),
  );
}

export function getBestAffiliateOffer(setId: string): CatalogOffer | null {
  return getBestOffer(toCatalogOffers(listAffiliateOffers(setId)));
}
