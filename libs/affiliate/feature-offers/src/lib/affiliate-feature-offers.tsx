import { listAffiliateOffers } from '@lego-platform/affiliate/data-access';
import { AffiliateOfferCard } from '@lego-platform/affiliate/ui';

export function AffiliateFeatureOffers({ setId }: { setId: string }) {
  const affiliateOffers = listAffiliateOffers(setId);

  if (affiliateOffers.length === 0) {
    return null;
  }

  return (
    <section className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Affiliate offers</p>
        <h2>
          Commerce surfaces are segmented so monetization does not leak through
          the rest of the app.
        </h2>
        <p className="section-copy">
          This foundation phase keeps outbound links direct and operator-reviewed
          while the Dutch merchant allowlist stays intentionally small.
        </p>
      </header>
      <div className="surface-grid">
        {affiliateOffers.map((affiliateOffer) => (
          <AffiliateOfferCard
            key={affiliateOffer.merchantId}
            affiliateOffer={affiliateOffer}
          />
        ))}
      </div>
    </section>
  );
}

export default AffiliateFeatureOffers;
