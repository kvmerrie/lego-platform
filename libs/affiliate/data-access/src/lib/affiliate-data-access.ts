import {
  getBestOffer,
  type AffiliateOfferSnapshot,
  sortAffiliateOffers,
  toCatalogOffers,
  type CatalogOffer,
} from '@lego-platform/affiliate/util';
import { affiliateOfferSnapshots } from './affiliate-offers.generated';

const affiliateOfferSnapshotsBySetId = new Map<
  string,
  AffiliateOfferSnapshot[]
>();

for (const affiliateOfferSnapshot of affiliateOfferSnapshots) {
  const setOffers =
    affiliateOfferSnapshotsBySetId.get(affiliateOfferSnapshot.setId) ?? [];

  setOffers.push(affiliateOfferSnapshot);
  affiliateOfferSnapshotsBySetId.set(affiliateOfferSnapshot.setId, setOffers);
}

export function listAffiliateOffers(setId: string): AffiliateOfferSnapshot[] {
  return sortAffiliateOffers(affiliateOfferSnapshotsBySetId.get(setId) ?? []);
}

export function getBestAffiliateOffer(setId: string): CatalogOffer | null {
  return getBestOffer(toCatalogOffers(listAffiliateOffers(setId)));
}
