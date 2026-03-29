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
    <article className={styles.offerCard}>
      <div className={styles.offerHeader}>
        <div className={styles.offerHeading}>
          <h3 className={styles.offerTitle}>{affiliateOffer.merchantName}</h3>
          <div className={styles.offerBadges}>
            <Badge tone={getAvailabilityTone(affiliateOffer.availabilityLabel)}>
              {affiliateOffer.availabilityLabel}
            </Badge>
            <Badge tone="info">New condition</Badge>
          </div>
        </div>
        <div className={styles.offerPriceBlock}>
          <p className={styles.offerPriceLabel}>Reviewed offer</p>
          <p className={styles.offerPrice}>
            {formatAffiliatePrice(
              affiliateOffer.totalPriceMinor,
              affiliateOffer.currencyCode,
            )}
          </p>
        </div>
      </div>
      <p className={styles.offerFreshness}>
        Offer page reviewed {formatObservedAt(affiliateOffer.observedAt)}
      </p>
      {affiliateOffer.perks ? (
        <p className={styles.offerPerks}>{affiliateOffer.perks}</p>
      ) : null}
      <div className={styles.offerFooter}>
        <ActionLink
          className={styles.offerLink}
          href={affiliateOffer.outboundUrl}
          rel="noreferrer sponsored"
          target="_blank"
          tone="secondary"
        >
          {affiliateOffer.ctaLabel}
        </ActionLink>
      </div>
      <p className={styles.offerDisclosure}>{affiliateOffer.disclosureCopy}</p>
    </article>
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
        description="Reviewed Dutch merchant pages from the current allowlist. Use these as reviewed offer snapshots, and use the price panel for the calmest benchmark and history context."
        eyebrow="Buy guidance"
        title="Current Dutch offers"
      />
      <div className={styles.panelBadges}>
        <Badge tone="accent">NL / EUR</Badge>
        <Badge tone="info">New condition</Badge>
        <Badge>{affiliateOffers.length} merchants shown</Badge>
      </div>
      <div className={styles.offerList}>
        {affiliateOffers.map((affiliateOffer) => (
          <AffiliateOfferCard
            affiliateOffer={affiliateOffer}
            key={affiliateOffer.merchantId}
          />
        ))}
      </div>
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
        description="This set does not have a reviewed Dutch offer list in the current commerce slice yet."
        eyebrow="Buy guidance"
        title="Current Dutch offers"
      />
      <div className={styles.panelBadges}>
        <Badge tone="accent">NL / EUR</Badge>
        <Badge tone="info">New condition</Badge>
      </div>
      <p className={styles.unavailableCopy}>
        Reviewed offers are only published for the small commerce-enabled set
        allowlist right now. If this set joins the slice later, the price panel
        and offer list will appear together.
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
