import type { ReactNode } from 'react';
import {
  formatPriceMinor,
  type PriceHistoryPoint,
  type PriceHistorySummary,
  type PricePanelSnapshot,
  type TrackedPriceSummary,
} from '@lego-platform/pricing/util';
import {
  Badge,
  SectionHeading,
  Surface,
  VisuallyHidden,
} from '@lego-platform/shared/ui';
import styles from './pricing-ui.module.css';

function formatObservedAt(observedAt: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(observedAt));
}

function formatRecordedOn(recordedOn: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${recordedOn}T00:00:00.000Z`));
}

function getDeltaLabel(currencyCode: string, deltaMinor?: number): string {
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

function getAverageDeltaLabel({
  currencyCode,
  deltaVsAverageMinor,
}: {
  currencyCode: string;
  deltaVsAverageMinor: number;
}): string {
  if (deltaVsAverageMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaVsAverageMinor),
    })} below 30-day average`;
  }

  if (deltaVsAverageMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaVsAverageMinor,
    })} above 30-day average`;
  }

  return 'At 30-day average';
}

function getTrackedDeltaLabel({
  currencyCode,
  deltaMinor,
  label,
}: {
  currencyCode: string;
  deltaMinor: number;
  label: 'tracked high' | 'tracked low';
}): string {
  if (deltaMinor === 0) {
    return `Matches ${label}`;
  }

  if (deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} below ${label}`;
  }

  return `${formatPriceMinor({
    currencyCode,
    minorUnits: deltaMinor,
  })} above ${label}`;
}

function getDailyPointLabel(pointCount: number): string {
  return `${pointCount} daily point${pointCount === 1 ? '' : 's'}`;
}

function getTrackedOfferLabel(offerCount: number): string {
  return `${offerCount} offer${offerCount === 1 ? '' : 's'} tracked`;
}

function getDutchOfferCoverageLabel(offerCount: number): string {
  return `${offerCount} Dutch offer${offerCount === 1 ? '' : 's'}`;
}

function getTrackedDailyPointLabel(pointCount: number): string {
  return `${pointCount} tracked daily point${pointCount === 1 ? '' : 's'}`;
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

function buildHistoryChartPoints(
  priceHistoryPoints: readonly PriceHistoryPoint[],
): string {
  const chartWidth = 100;
  const chartHeight = 48;
  const padding = 6;
  const values = priceHistoryPoints.map(
    (priceHistoryPoint) => priceHistoryPoint.headlinePriceMinor,
  );
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, 1);

  return priceHistoryPoints
    .map((priceHistoryPoint, index) => {
      const x =
        priceHistoryPoints.length === 1
          ? chartWidth / 2
          : padding +
            ((chartWidth - padding * 2) * index) /
              (priceHistoryPoints.length - 1);
      const y =
        chartHeight -
        padding -
        ((chartHeight - padding * 2) *
          (priceHistoryPoint.headlinePriceMinor - minValue)) /
          valueRange;

      return `${x},${y}`;
    })
    .join(' ');
}

function getHistoryRangeSummary(
  priceHistoryPoints: readonly PriceHistoryPoint[],
): {
  high: PriceHistoryPoint;
  latest: PriceHistoryPoint;
  low: PriceHistoryPoint;
} {
  const sortedByValue = [...priceHistoryPoints].sort(
    (left, right) => left.headlinePriceMinor - right.headlinePriceMinor,
  );
  const low = sortedByValue[0];
  const high = sortedByValue.at(-1);
  const latest = priceHistoryPoints.at(-1);

  if (!low || !high || !latest) {
    throw new Error('Price history summary requires at least one history point.');
  }

  return {
    low,
    high,
    latest,
  };
}

export function PriceSummaryCard({
  children,
  id,
  pricePanelSnapshot,
}: {
  children?: ReactNode;
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
        <Badge>{getTrackedOfferLabel(pricePanelSnapshot.merchantCount)}</Badge>
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
      {children}
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
          value={getDutchOfferCoverageLabel(pricePanelSnapshot.merchantCount)}
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

export function PriceHistorySummaryCallout({
  historyPointCount,
  priceHistorySummary,
  trackedPriceSummary,
}: {
  historyPointCount?: number;
  priceHistorySummary?: PriceHistorySummary;
  trackedPriceSummary?: TrackedPriceSummary;
}) {
  if (!priceHistorySummary && !trackedPriceSummary) {
    return (
      <section aria-label="30-day price summary" className={styles.summaryBlock}>
        <p className={styles.summaryLabel}>30-day summary</p>
        <p className={styles.summaryNote}>
          {historyPointCount === 1
            ? 'History is building. One daily point has been recorded so far, so 30-day range and average comparisons will appear after the next reviewed point.'
            : 'History is building. 30-day summary will appear after a little more daily pricing history is recorded.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="30-day price summary" className={styles.summaryBlock}>
      <section aria-label="30-day price summary" className={styles.summarySection}>
        <p className={styles.summaryLabel}>30-day summary</p>
        {priceHistorySummary ? (
          <>
            <dl className={styles.summaryGrid}>
              <PricingMetaItem
                label="30-day low"
                value={formatPriceMinor({
                  currencyCode: priceHistorySummary.currencyCode,
                  minorUnits: priceHistorySummary.lowPriceMinor,
                })}
              />
              <PricingMetaItem
                label="30-day high"
                value={formatPriceMinor({
                  currencyCode: priceHistorySummary.currencyCode,
                  minorUnits: priceHistorySummary.highPriceMinor,
                })}
              />
              <PricingMetaItem
                label="Current vs average"
                value={getAverageDeltaLabel({
                  currencyCode: priceHistorySummary.currencyCode,
                  deltaVsAverageMinor: priceHistorySummary.deltaVsAverageMinor,
                })}
              />
            </dl>
            <p className={styles.summaryNote}>
              30-day average:{' '}
              {formatPriceMinor({
                currencyCode: priceHistorySummary.currencyCode,
                minorUnits: priceHistorySummary.averagePriceMinor,
              })}{' '}
              from {getDailyPointLabel(priceHistorySummary.pointCount)}.
            </p>
          </>
        ) : (
          <p className={styles.summaryNote}>
            {historyPointCount === 1
              ? 'History is building. One daily point has been recorded so far, so 30-day range and average comparisons will appear after the next reviewed point.'
              : 'History is building. 30-day summary will appear after a little more daily pricing history is recorded.'}
          </p>
        )}
      </section>
      {trackedPriceSummary ? (
        <section
          aria-label="Tracked price range"
          className={styles.summarySection}
        >
          <p className={styles.summaryLabel}>Tracked price range</p>
          <dl className={styles.summaryGrid}>
            <PricingMetaItem
              label="Lowest tracked price"
              value={formatPriceMinor({
                currencyCode: trackedPriceSummary.currencyCode,
                minorUnits: trackedPriceSummary.trackedLowPriceMinor,
              })}
            />
            <PricingMetaItem
              label="Highest tracked price"
              value={formatPriceMinor({
                currencyCode: trackedPriceSummary.currencyCode,
                minorUnits: trackedPriceSummary.trackedHighPriceMinor,
              })}
            />
            <PricingMetaItem
              label="Tracked since"
              value={formatRecordedOn(trackedPriceSummary.trackedSinceRecordedOn)}
            />
            <PricingMetaItem
              label="Current vs tracked low"
              value={getTrackedDeltaLabel({
                currencyCode: trackedPriceSummary.currencyCode,
                deltaMinor: trackedPriceSummary.deltaVsTrackedLowMinor,
                label: 'tracked low',
              })}
            />
            <PricingMetaItem
              label="Current vs tracked high"
              value={getTrackedDeltaLabel({
                currencyCode: trackedPriceSummary.currencyCode,
                deltaMinor: trackedPriceSummary.deltaVsTrackedHighMinor,
                label: 'tracked high',
              })}
            />
          </dl>
          <p className={styles.summaryNote}>
            Based on{' '}
            {getTrackedDailyPointLabel(trackedPriceSummary.pointCount)} stored
            for this set.
          </p>
        </section>
      ) : null}
    </section>
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

export function PriceHistoryCard({
  id,
  priceHistoryPoints,
}: {
  id?: string;
  priceHistoryPoints: readonly PriceHistoryPoint[];
}) {
  const firstPriceHistoryPoint = priceHistoryPoints[0];

  if (!firstPriceHistoryPoint) {
    return <PriceHistoryEmptyCard id={id} />;
  }

  if (priceHistoryPoints.length === 1) {
    return (
      <Surface
        as="section"
        className={styles.panel}
        elevation="rested"
        id={id}
        tone="muted"
      >
        <SectionHeading
          description="History is building. One reviewed Dutch daily point has been recorded so far for this set."
          eyebrow="Price history"
          title="30-day price history"
        />
        <div className={styles.badgeRow}>
          <Badge tone="accent">NL / EUR</Badge>
          <Badge tone="info">New condition</Badge>
          <Badge>{getDailyPointLabel(1)}</Badge>
        </div>
        <div className={styles.metricBlock}>
          <p className={styles.metricLabel}>Latest recorded price</p>
          <p className={styles.metricValue}>
            {formatPriceMinor({
              currencyCode: firstPriceHistoryPoint.currencyCode,
              minorUnits: firstPriceHistoryPoint.headlinePriceMinor,
            })}
          </p>
          <p className={styles.metricContext}>History is building</p>
          <p className={styles.metricContextSecondary}>
            Reviewed {formatObservedAt(firstPriceHistoryPoint.observedAt)}
          </p>
        </div>
        <dl className={styles.metaGrid}>
          <PricingMetaItem
            label="Recorded on"
            value={formatRecordedOn(firstPriceHistoryPoint.recordedOn)}
          />
          <PricingMetaItem label="Status" value="Range building" />
          <PricingMetaItem label="Coverage" value={getDailyPointLabel(1)} />
        </dl>
        <p className={styles.referenceNote}>
          The chart, 30-day low, and 30-day high will fill in automatically as
          more daily points are stored.
        </p>
      </Surface>
    );
  }

  const { high, latest, low } = getHistoryRangeSummary(priceHistoryPoints);

  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading
        description="One reviewed Dutch headline point per day from the current commerce-enabled set slice."
        eyebrow="Price history"
        title="30-day price history"
      />
      <div className={styles.badgeRow}>
        <Badge tone="accent">NL / EUR</Badge>
        <Badge tone="info">New condition</Badge>
        <Badge>{getDailyPointLabel(priceHistoryPoints.length)}</Badge>
      </div>
      <div className={styles.historyChartShell}>
        <div className={styles.historyAxis}>
          <span>
            {formatPriceMinor({
              currencyCode: high.currencyCode,
              minorUnits: high.headlinePriceMinor,
            })}
          </span>
          <span>
            {formatPriceMinor({
              currencyCode: low.currencyCode,
              minorUnits: low.headlinePriceMinor,
            })}
          </span>
        </div>
        <svg
          aria-label="30-day Dutch price history"
          className={styles.historyChart}
          role="img"
          viewBox="0 0 100 48"
        >
          <line className={styles.historyGridLine} x1="6" x2="94" y1="8" y2="8" />
          <line
            className={styles.historyGridLine}
            x1="6"
            x2="94"
            y1="24"
            y2="24"
          />
          <line
            className={styles.historyGridLine}
            x1="6"
            x2="94"
            y1="40"
            y2="40"
          />
          <polyline
            className={styles.historyLine}
            fill="none"
            points={buildHistoryChartPoints(priceHistoryPoints)}
          />
        </svg>
      </div>
      <div className={styles.historyLabels}>
        <span>{formatRecordedOn(firstPriceHistoryPoint.recordedOn)}</span>
        <span>{formatRecordedOn(latest.recordedOn)}</span>
      </div>
      <dl className={styles.metaGrid}>
        <PricingMetaItem
          label="Latest"
          value={formatPriceMinor({
            currencyCode: latest.currencyCode,
            minorUnits: latest.headlinePriceMinor,
          })}
        />
        <PricingMetaItem
          label="30-day low"
          value={formatPriceMinor({
            currencyCode: low.currencyCode,
            minorUnits: low.headlinePriceMinor,
          })}
        />
        <PricingMetaItem
          label="30-day high"
          value={formatPriceMinor({
            currencyCode: high.currencyCode,
            minorUnits: high.headlinePriceMinor,
          })}
        />
      </dl>
      <p className={styles.referenceNote}>
        Latest reviewed point from {formatObservedAt(latest.observedAt)}.
      </p>
      <VisuallyHidden>
        <ol>
          {priceHistoryPoints.map((priceHistoryPoint) => (
            <li key={priceHistoryPoint.recordedOn}>
              {formatRecordedOn(priceHistoryPoint.recordedOn)}:{' '}
              {formatPriceMinor({
                currencyCode: priceHistoryPoint.currencyCode,
                minorUnits: priceHistoryPoint.headlinePriceMinor,
              })}
            </li>
          ))}
        </ol>
      </VisuallyHidden>
    </Surface>
  );
}

export function PriceHistoryEmptyCard({
  id,
  isLoading = false,
}: {
  id?: string;
  isLoading?: boolean;
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
        description="This chart fills in as reviewed daily points are written into the Dutch history slice."
        eyebrow="Price history"
        title="30-day price history"
      />
      <div className={styles.badgeRow}>
        <Badge tone="accent">NL / EUR</Badge>
        <Badge tone="info">New condition</Badge>
      </div>
      <p className={styles.unavailableCopy}>
        {isLoading
          ? 'Loading the latest reviewed history points.'
          : 'History is building. No reviewed daily point has been stored for this set yet.'}
      </p>
    </Surface>
  );
}

export function PricingUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Compact buying guidance surfaces for current-price snapshots and 30-day history."
        eyebrow="Pricing UI"
        title="Dutch-market price guidance with product-facing restraint."
      />
    </Surface>
  );
}

export default PricingUi;
