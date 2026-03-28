import { listAffiliateOffers } from '@lego-platform/affiliate/data-access';
import { AffiliateOfferCard } from '@lego-platform/affiliate/ui';

export function AffiliateFeatureOffers() {
  const affiliateOffers = listAffiliateOffers();

  return (
    <section className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Affiliate offers</p>
        <h2>
          Commerce surfaces are segmented so monetization does not leak through
          the rest of the app.
        </h2>
      </header>
      <div className="surface-grid">
        {affiliateOffers.map((affiliateOffer) => (
          <AffiliateOfferCard
            key={affiliateOffer.merchant}
            affiliateOffer={affiliateOffer}
          />
        ))}
      </div>
    </section>
  );
}

export default AffiliateFeatureOffers;
