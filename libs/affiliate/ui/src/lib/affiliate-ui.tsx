import { AffiliateOfferSnapshot } from '@lego-platform/affiliate/util';
import {
  ActionLink,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import styles from './affiliate-ui.module.css';

function formatAffiliatePrice(totalPriceMinor: number, currencyCode: string) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: currencyCode,
  }).format(totalPriceMinor / 100);
}

function formatObservedAt(observedAt: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(observedAt));
}

function getAvailabilityTone(
  availabilityLabel: string,
): 'info' | 'neutral' | 'positive' | 'warning' {
  if (availabilityLabel.toLowerCase().includes('stock')) {
    return availabilityLabel.toLowerCase().includes('low')
      ? 'warning'
      : 'positive';
  }

  if (availabilityLabel.toLowerCase().includes('pre')) {
    return 'info';
  }

  return 'neutral';
}

export function AffiliateOfferCard({
  affiliateOffer,
}: {
  affiliateOffer: AffiliateOfferSnapshot;
}) {
  return (
    <tr className={styles.offerRow}>
      <td className={styles.offerMerchantCell}>
        <div className={styles.offerMerchantBlock}>
          <h3 className={styles.offerTitle}>{affiliateOffer.merchantName}</h3>
          {affiliateOffer.perks ? (
            <p className={styles.offerPerks}>{affiliateOffer.perks}</p>
          ) : null}
          <p className={styles.offerDisclosure}>
            {affiliateOffer.disclosureCopy}
          </p>
        </div>
      </td>
      <td className={styles.offerAvailabilityCell}>
        <div className={styles.offerBadges}>
          <Badge tone={getAvailabilityTone(affiliateOffer.availabilityLabel)}>
            {affiliateOffer.availabilityLabel}
          </Badge>
        </div>
      </td>
      <td className={styles.offerCheckedCell}>
        <p className={styles.offerFreshness}>
          Checked {formatObservedAt(affiliateOffer.observedAt)}
        </p>
      </td>
      <td className={styles.offerPriceCell}>
        <p className={styles.offerPrice}>
          {formatAffiliatePrice(
            affiliateOffer.totalPriceMinor,
            affiliateOffer.currencyCode,
          )}
        </p>
        <p className={styles.offerPriceLabel}>Reviewed offer</p>
      </td>
      <td className={styles.offerActionCell}>
        <ActionLink
          className={styles.offerLink}
          href={affiliateOffer.outboundUrl}
          rel="noreferrer sponsored"
          target="_blank"
          tone="secondary"
        >
          {affiliateOffer.ctaLabel}
        </ActionLink>
      </td>
    </tr>
  );
}

export function AffiliatePrimaryOfferAction({
  affiliateOffer,
}: {
  affiliateOffer: AffiliateOfferSnapshot;
}) {
  return (
    <div className={styles.primaryOfferAction}>
      <ActionLink
        className={styles.primaryOfferLink}
        href={affiliateOffer.outboundUrl}
        rel="noreferrer sponsored"
        target="_blank"
        tone="secondary"
      >
        Shop at {affiliateOffer.merchantName}
      </ActionLink>
    </div>
  );
}

export function AffiliateOffersPanel({
  affiliateOffers,
  id,
}: {
  affiliateOffers: readonly AffiliateOfferSnapshot[];
  id?: string;
}) {
  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading
        description="Compare the reviewed Dutch merchant pages in the current pricing slice."
        eyebrow="Buy guidance"
        title="Reviewed offers"
      />
      <p className={styles.panelMeta}>
        Dutch market · EUR · new condition · {affiliateOffers.length} merchants
        shown
      </p>
      <div className={styles.offerTableWrap}>
        <table className={styles.offerTable}>
          <thead>
            <tr>
              <th className={styles.offerHeadCell} scope="col">
                Merchant
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Availability
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Checked
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Price
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {affiliateOffers.map((affiliateOffer) => (
              <AffiliateOfferCard
                affiliateOffer={affiliateOffer}
                key={affiliateOffer.merchantId}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.panelNote}>
        Prices and availability match the same reviewed snapshot used in the
        main price summary.
      </p>
    </Surface>
  );
}

export function AffiliateUnavailableCard({ id }: { id?: string }) {
  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading
        description="Reviewed Dutch offers are live for selected sets."
        eyebrow="Buy guidance"
        title="Reviewed offers"
      />
      <p className={styles.panelMeta}>Dutch market · EUR · new condition</p>
      <p className={styles.unavailableCopy}>
        Offers appear together with reviewed price and tracked history when a
        set joins the Dutch pricing selection.
      </p>
    </Surface>
  );
}

export function AffiliateUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Compact offer cards that keep Dutch-market merchant guidance direct and presentational."
        eyebrow="Affiliate UI"
        title="Outbound offer surfaces without runtime commerce coupling."
      />
    </Surface>
  );
}

export default AffiliateUi;
