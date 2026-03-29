import { AffiliateOfferSnapshot } from '@lego-platform/affiliate/util';

function formatAffiliatePrice(totalPriceMinor: number, currencyCode: string) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: currencyCode,
  }).format(totalPriceMinor / 100);
}

export function AffiliateOfferCard({
  affiliateOffer,
}: {
  affiliateOffer: AffiliateOfferSnapshot;
}) {
  return (
    <article className="surface stack">
      <div className="split-row">
        <h3 className="surface-title">{affiliateOffer.merchantName}</h3>
        <span className="pill">
          {formatAffiliatePrice(
            affiliateOffer.totalPriceMinor,
            affiliateOffer.currencyCode,
          )}
        </span>
      </div>
      <p>{affiliateOffer.disclosureCopy}</p>
      <p className="muted">
        {affiliateOffer.availabilityLabel} · {affiliateOffer.perks}
      </p>
    </article>
  );
}

export function AffiliateUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">Affiliate UI</p>
      <h2 className="surface-title">
        Offer rows that stay purely presentational and Dutch-market aware.
      </h2>
    </section>
  );
}

export default AffiliateUi;
