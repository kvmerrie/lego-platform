import {
  CatalogOffer,
  getCatalogOfferAvailabilityLabel,
  getCatalogOfferComparisonInsight,
} from '@lego-platform/affiliate/util';
import {
  getDefaultFormattingLocale,
  getDefaultMarketAdjective,
  getDefaultMarketScopeLabel,
} from '@lego-platform/shared/config';
import { ActionLink, SectionHeading, Surface } from '@lego-platform/shared/ui';
import styles from './affiliate-ui.module.css';

function formatAffiliatePrice(totalPriceMinor: number, currencyCode: string) {
  return new Intl.NumberFormat(getDefaultFormattingLocale(), {
    style: 'currency',
    currency: currencyCode,
  }).format(totalPriceMinor / 100);
}

function formatObservedAt(observedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(observedAt));
}

function getOfferScopeLabel(suffix?: string): string {
  return getDefaultMarketScopeLabel({
    conditionLabel: 'new condition',
    suffix,
  });
}

function getAvailabilityClassName(availability: CatalogOffer['availability']) {
  if (availability === 'in_stock') {
    return styles.offerAvailabilityInStock;
  }

  if (availability === 'out_of_stock') {
    return styles.offerAvailabilityOutOfStock;
  }

  return styles.offerAvailabilityUnknown;
}

export function AffiliateOfferCard({
  affiliateOffer,
}: {
  affiliateOffer: CatalogOffer;
}) {
  return (
    <tr className={styles.offerRow}>
      <td className={styles.offerMerchantCell}>
        <p className={styles.offerTitle}>{affiliateOffer.merchantName}</p>
      </td>
      <td className={styles.offerPriceCell}>
        <p className={styles.offerPrice}>
          {formatAffiliatePrice(
            affiliateOffer.priceCents,
            affiliateOffer.currency,
          )}
        </p>
      </td>
      <td className={styles.offerAvailabilityCell}>
        <p
          className={`${styles.offerAvailability} ${getAvailabilityClassName(
            affiliateOffer.availability,
          )}`}
        >
          {getCatalogOfferAvailabilityLabel(affiliateOffer.availability)}
        </p>
      </td>
      <td className={styles.offerCheckedCell}>
        <p className={styles.offerFreshness}>
          {formatObservedAt(affiliateOffer.checkedAt)}
        </p>
      </td>
      <td className={styles.offerActionCell}>
        <ActionLink
          className={styles.offerLink}
          href={affiliateOffer.url}
          rel="noreferrer sponsored"
          target="_blank"
          tone="secondary"
        >
          Open offer
        </ActionLink>
      </td>
    </tr>
  );
}

export function AffiliatePrimaryOfferAction({
  affiliateOffer,
}: {
  affiliateOffer: CatalogOffer;
}) {
  return (
    <div className={styles.primaryOfferAction}>
      <ActionLink
        className={styles.primaryOfferLink}
        href={affiliateOffer.url}
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
  affiliateOffers: readonly CatalogOffer[];
  id?: string;
}) {
  const comparisonInsight = getCatalogOfferComparisonInsight(affiliateOffers);

  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading
        description={`Compare the ${getDefaultMarketAdjective()} shops we reviewed for this set.`}
        eyebrow="Buy guidance"
        title="Reviewed offers"
      />
      {comparisonInsight ? (
        <p className={styles.panelInsight}>{comparisonInsight}</p>
      ) : null}
      <p className={styles.panelMeta}>
        {getOfferScopeLabel(`${affiliateOffers.length} offers compared`)}
      </p>
      <div className={styles.offerTableWrap}>
        <table className={styles.offerTable}>
          <thead>
            <tr>
              <th className={styles.offerHeadCell} scope="col">
                Merchant
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Price
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Availability
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Last checked
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
                key={`${affiliateOffer.setId}-${affiliateOffer.merchant}`}
              />
            ))}
          </tbody>
        </table>
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
        description={`We have not reviewed shop offers for this set yet.`}
        eyebrow="Buy guidance"
        title="Reviewed offers"
      />
      <p className={styles.panelMeta}>{getOfferScopeLabel()}</p>
    </Surface>
  );
}

export function AffiliateUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Compact offer cards that keep current-market merchant guidance direct and presentational."
        eyebrow="Affiliate UI"
        title="Outbound offer surfaces without runtime commerce coupling."
      />
    </Surface>
  );
}

export default AffiliateUi;
