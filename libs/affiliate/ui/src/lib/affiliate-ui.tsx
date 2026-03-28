import { AffiliateOffer } from '@lego-platform/affiliate/util';

export function AffiliateOfferCard({
  affiliateOffer,
}: {
  affiliateOffer: AffiliateOffer;
}) {
  return (
    <article className="surface stack">
      <div className="split-row">
        <h3 className="surface-title">{affiliateOffer.merchant}</h3>
        <span className="pill">{affiliateOffer.totalPrice}</span>
      </div>
      <p>{affiliateOffer.highlight}</p>
      <p className="muted">
        {affiliateOffer.condition} · {affiliateOffer.perks}
      </p>
    </article>
  );
}

export function AffiliateUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">Affiliate UI</p>
      <h2 className="surface-title">
        Offer rows that stay purely presentational and conversion-aware.
      </h2>
    </section>
  );
}

export default AffiliateUi;
