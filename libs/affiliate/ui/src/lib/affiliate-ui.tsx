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
      <th className={styles.offerMerchantCell} scope="row">
        <p className={styles.offerTitle}>{affiliateOffer.merchantName}</p>
      </th>
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
        Bekijk bij {affiliateOffer.merchantName}
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
        description={`Vergelijk de ${getDefaultMarketAdjective()} winkels die we voor deze set hebben reviewed.`}
        eyebrow="Koophulp"
        title="Reviewed aanbiedingen"
      />
      {comparisonInsight ? (
        <p className={styles.panelInsight}>{comparisonInsight}</p>
      ) : null}
      <p className={styles.panelMeta}>
        {getOfferScopeLabel(
          `${affiliateOffers.length} aanbiedingen vergeleken`,
        )}
      </p>
      <div className={styles.offerTableWrap}>
        <table className={styles.offerTable}>
          <caption className={styles.tableCaption}>
            Reviewed aanbiedingen voor deze set, inclusief winkel, prijs,
            beschikbaarheid, laatst gecheckte tijd en uitgaande actie.
          </caption>
          <thead>
            <tr>
              <th className={styles.offerHeadCell} scope="col">
                Winkel
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Prijs
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Beschikbaarheid
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Laatst gecheckt
              </th>
              <th className={styles.offerHeadCell} scope="col">
                Actie
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
        description={`We hebben voor deze set nog geen winkelprijzen reviewed.`}
        eyebrow="Koophulp"
        title="Reviewed aanbiedingen"
      />
      <p className={styles.panelMeta}>{getOfferScopeLabel()}</p>
    </Surface>
  );
}

export function AffiliateUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Compacte aanbiedingskaarten die actuele winkelcontext direct en presentabel houden."
        eyebrow="Affiliate-UI"
        title="Uitgaande aanbodoppervlakken zonder runtime-koppeling met commerce."
      />
    </Surface>
  );
}

export default AffiliateUi;
