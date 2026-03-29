import { listAffiliateOffers } from '@lego-platform/affiliate/data-access';
import {
  AffiliateOffersPanel,
  AffiliateUnavailableCard,
} from '@lego-platform/affiliate/ui';

export function AffiliateFeatureOffers({ setId }: { setId: string }) {
  const affiliateOffers = listAffiliateOffers(setId).slice(0, 3);

  if (affiliateOffers.length === 0) {
    return <AffiliateUnavailableCard id="offers" />;
  }

  return <AffiliateOffersPanel affiliateOffers={affiliateOffers} id="offers" />;
}

export default AffiliateFeatureOffers;
