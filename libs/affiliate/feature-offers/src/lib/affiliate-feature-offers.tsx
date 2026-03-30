import { type CatalogOffer, getBestOffer } from '@lego-platform/affiliate/util';
import {
  AffiliateOffersPanel,
  AffiliatePrimaryOfferAction,
  AffiliateUnavailableCard,
} from '@lego-platform/affiliate/ui';

export function AffiliateFeatureOffers({
  affiliateOffers,
}: {
  affiliateOffers: readonly CatalogOffer[];
}) {
  if (affiliateOffers.length === 0) {
    return <AffiliateUnavailableCard id="offers" />;
  }

  return <AffiliateOffersPanel affiliateOffers={affiliateOffers} id="offers" />;
}

export function AffiliateFeaturePrimaryOfferAction({
  affiliateOffers,
}: {
  affiliateOffers: readonly CatalogOffer[];
}) {
  const primaryOffer = getBestOffer(affiliateOffers);

  if (!primaryOffer) {
    return null;
  }

  return <AffiliatePrimaryOfferAction affiliateOffer={primaryOffer} />;
}

export default AffiliateFeatureOffers;
