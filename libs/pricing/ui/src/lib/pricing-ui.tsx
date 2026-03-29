import {
  formatPriceMinor,
  PriceHistoryPoint,
  PricePanelSnapshot,
} from '@lego-platform/pricing/util';
import { Badge, SectionHeading, Surface } from '@lego-platform/shared/ui';
import styles from './pricing-ui.module.css';

function formatObservedAt(observedAt: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(observedAt));
}

function getDeltaLabel(
  currencyCode: string,
  deltaMinor?: number,
): string {
  if (typeof deltaMinor !== 'number') {
    return 'No reference configured';
  }

  if (deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} below reference`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} above reference`;
  }

  return 'At reference';
}

function getDeltaTone(
  deltaMinor?: number,
): 'info' | 'neutral' | 'positive' | 'warning' {
  if (typeof deltaMinor !== 'number') {
    return 'neutral';
  }

  if (deltaMinor < 0) {
    return 'positive';
  }

  if (deltaMinor > 0) {
    return 'warning';
  }

  return 'info';
}

function PricingMetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.metaItem}>
      <dt className={styles.metaLabel}>{label}</dt>
      <dd className={styles.metaValue}>{value}</dd>
    </div>
  );
}

export function PriceSummaryCard({
  id,
  pricePanelSnapshot,
}: {
  id?: string;
  pricePanelSnapshot: PricePanelSnapshot;
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
        description="Reviewed Dutch-market guidance from the current allowlisted EUR offer slice."
        eyebrow="Buy guidance"
        title="Current Dutch market price"
      />
      <div className={styles.badgeRow}>
        <Badge tone="accent">NL / EUR</Badge>
        <Badge tone="info">New condition</Badge>
        <Badge>{pricePanelSnapshot.merchantCount} offers tracked</Badge>
      </div>
      <div className={styles.metricBlock}>
        <p className={styles.metricLabel}>Headline current price</p>
        <p className={styles.metricValue}>
          {formatPriceMinor({
            currencyCode: pricePanelSnapshot.currencyCode,
            minorUnits: pricePanelSnapshot.headlinePriceMinor,
          })}
        </p>
        <p className={styles.metricContext}>
          Lowest current offer from {pricePanelSnapshot.lowestMerchantName}
        </p>
        {pricePanelSnapshot.lowestAvailabilityLabel ? (
          <p className={styles.metricContextSecondary}>
            Availability: {pricePanelSnapshot.lowestAvailabilityLabel}
          </p>
        ) : null}
        {typeof pricePanelSnapshot.referencePriceMinor === 'number' ? (
          <Badge tone={getDeltaTone(pricePanelSnapshot.deltaMinor)}>
            {getDeltaLabel(
              pricePanelSnapshot.currencyCode,
              pricePanelSnapshot.deltaMinor,
            )}
          </Badge>
        ) : (
          <p className={styles.referenceFallback}>
            Reference price not configured yet.
          </p>
        )}
      </div>
      <dl className={styles.metaGrid}>
        <PricingMetaItem
          label="Reference price"
          value={
            typeof pricePanelSnapshot.referencePriceMinor === 'number'
              ? formatPriceMinor({
                  currencyCode: pricePanelSnapshot.currencyCode,
                  minorUnits: pricePanelSnapshot.referencePriceMinor,
                })
              : 'Not set yet'
          }
        />
        <PricingMetaItem
          label="Reviewed"
          value={formatObservedAt(pricePanelSnapshot.observedAt)}
        />
        <PricingMetaItem
          label="Coverage"
          value={`${pricePanelSnapshot.merchantCount} Dutch offers`}
        />
      </dl>
      <p className={styles.referenceNote}>
        {typeof pricePanelSnapshot.referencePriceMinor === 'number'
          ? 'Reference price is a local Dutch benchmark for comparing reviewed offers.'
          : 'Reference pricing can be added later without changing the current reviewed-offer snapshot.'}
      </p>
    </Surface>
  );
}

export function PricingUnavailableCard({ id }: { id?: string }) {
  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading
        description="This set is outside the current reviewed Dutch pricing slice, so no current snapshot is shown yet."
        eyebrow="Buy guidance"
        title="Current Dutch market price"
      />
      <div className={styles.badgeRow}>
        <Badge tone="accent">NL / EUR</Badge>
        <Badge tone="info">New condition</Badge>
      </div>
      <p className={styles.unavailableCopy}>
        Pricing snapshots are only published for the small commerce-enabled set
        allowlist right now.
      </p>
    </Surface>
  );
}

export function PriceHistoryRow({
  priceHistoryPoint,
}: {
  priceHistoryPoint: PriceHistoryPoint;
}) {
  return (
    <li className={styles.historyRow}>
      <span>{priceHistoryPoint.label}</span>
      <span className={styles.mono}>${priceHistoryPoint.value}</span>
      <span className={styles.historyAnnotation}>
        {priceHistoryPoint.annotation}
      </span>
    </li>
  );
}

export function PricingUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Compact buying guidance surfaces for current-price snapshots and future history work."
        eyebrow="Pricing UI"
        title="Dutch-market price guidance with product-facing restraint."
      />
    </Surface>
  );
}

export default PricingUi;
