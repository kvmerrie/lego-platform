import type { ReactNode } from 'react';
import {
  formatPriceMinor,
  getPriceDealSummary,
  type PriceHistoryPoint,
  type PriceHistorySummary,
  type PricePanelSnapshot,
  type SetPriceInsight,
  type TrackedPriceSummary,
} from '@lego-platform/pricing/util';
import {
  getDefaultFormattingLocale,
  getDefaultMarketAdjective,
  getDefaultMarketScopeLabel,
} from '@lego-platform/shared/config';
import {
  Badge,
  SectionHeading,
  Surface,
  VisuallyHidden,
} from '@lego-platform/shared/ui';
import styles from './pricing-ui.module.css';

function formatObservedAt(observedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(observedAt));
}

function formatRecordedOn(recordedOn: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${recordedOn}T00:00:00.000Z`));
}

function getDeltaLabel(currencyCode: string, deltaMinor?: number): string {
  if (typeof deltaMinor !== 'number') {
    return 'Geen referentie ingesteld';
  }

  if (deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} onder referentie`;
  }

  if (deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaMinor,
    })} boven referentie`;
  }

  return 'Op referentie';
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
    })} onder het 30-daags gemiddelde`;
  }

  if (deltaVsAverageMinor > 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: deltaVsAverageMinor,
    })} boven het 30-daags gemiddelde`;
  }

  return 'Op het 30-daags gemiddelde';
}

function getTrackedDeltaLabel({
  currencyCode,
  deltaMinor,
  label,
}: {
  currencyCode: string;
  deltaMinor: number;
  label: 'bijgehouden hoog' | 'bijgehouden laag';
}): string {
  if (deltaMinor === 0) {
    return `Gelijk aan ${label}`;
  }

  if (deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} onder ${label}`;
  }

  return `${formatPriceMinor({
    currencyCode,
    minorUnits: deltaMinor,
  })} boven ${label}`;
}

function getDailyPointLabel(pointCount: number): string {
  return `${pointCount} dagpunt${pointCount === 1 ? '' : 'en'}`;
}

function getReviewedOfferLabel(offerCount: number): string {
  return `${offerCount} aanbieding${offerCount === 1 ? '' : 'en'} reviewed`;
}

function getReviewedCoverageLabel(offerCount: number): string {
  return `${offerCount} ${getDefaultMarketAdjective()} aanbieding${offerCount === 1 ? '' : 'en'} reviewed`;
}

function getTrackedDailyPointLabel(pointCount: number): string {
  return `${pointCount} bijgehouden dagpunt${pointCount === 1 ? '' : 'en'}`;
}

function PricingMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <dt className={styles.metaLabel}>{label}</dt>
      <dd className={styles.metaValue}>{value}</dd>
    </div>
  );
}

function PricingScopeLine({ children }: { children: ReactNode }) {
  return <p className={styles.scopeLine}>{children}</p>;
}

function getPricingScopeLabel(suffix?: string): string {
  return getDefaultMarketScopeLabel({
    conditionLabel: 'nieuw',
    suffix,
  });
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
    throw new Error(
      'Price history summary requires at least one history point.',
    );
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
  variant = 'default',
}: {
  children?: ReactNode;
  id?: string;
  pricePanelSnapshot: PricePanelSnapshot;
  variant?: 'default' | 'product';
}) {
  const priceDealSummary = getPriceDealSummary(pricePanelSnapshot);

  if (variant === 'product') {
    return (
      <div className={`${styles.panel} ${styles.productPanel}`} id={id}>
        <p className={styles.metricLabel}>Laagste reviewed prijs</p>
        <p className={styles.metricValue}>
          {formatPriceMinor({
            currencyCode: pricePanelSnapshot.currencyCode,
            minorUnits: pricePanelSnapshot.headlinePriceMinor,
          })}
        </p>
        <p className={styles.metricContext}>
          Nu het laagst bij {pricePanelSnapshot.lowestMerchantName}
        </p>
        <p className={styles.dealSignal}>{priceDealSummary.label}</p>
        {pricePanelSnapshot.lowestAvailabilityLabel ? (
          <p className={styles.metricContextSecondary}>
            Beschikbaarheid: {pricePanelSnapshot.lowestAvailabilityLabel}
          </p>
        ) : null}
        {priceDealSummary.coverageNote ? (
          <p className={styles.dealSignalSupport}>
            {priceDealSummary.coverageNote}
          </p>
        ) : null}
        <PricingScopeLine>
          {getPricingScopeLabel(
            getReviewedOfferLabel(pricePanelSnapshot.merchantCount),
          )}
        </PricingScopeLine>
        <div className={styles.productMetaRow}>
          {typeof pricePanelSnapshot.referencePriceMinor === 'number' ? (
            <Badge tone={getDeltaTone(pricePanelSnapshot.deltaMinor)}>
              {getDeltaLabel(
                pricePanelSnapshot.currencyCode,
                pricePanelSnapshot.deltaMinor,
              )}
            </Badge>
          ) : (
            <p className={styles.referenceFallback}>
              Nog geen referentieprijs.
            </p>
          )}
          <p className={styles.productMeta}>
            Gecheckt {formatObservedAt(pricePanelSnapshot.observedAt)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading
        description={`Meest recent gecheckte prijs bij reviewed ${getDefaultMarketAdjective()} winkels.`}
        eyebrow="Koophulp"
        title="Huidige reviewed prijs"
      />
      <PricingScopeLine>
        {getPricingScopeLabel(
          getReviewedOfferLabel(pricePanelSnapshot.merchantCount),
        )}
      </PricingScopeLine>
      <div className={styles.metricBlock}>
        <p className={styles.metricLabel}>Reviewed prijs</p>
        <p className={styles.metricValue}>
          {formatPriceMinor({
            currencyCode: pricePanelSnapshot.currencyCode,
            minorUnits: pricePanelSnapshot.headlinePriceMinor,
          })}
        </p>
        <p className={styles.metricContext}>
          Laagste reviewed prijs bij {pricePanelSnapshot.lowestMerchantName}
        </p>
        <p className={styles.dealSignal}>{priceDealSummary.label}</p>
        {pricePanelSnapshot.lowestAvailabilityLabel ? (
          <p className={styles.metricContextSecondary}>
            Beschikbaarheid: {pricePanelSnapshot.lowestAvailabilityLabel}
          </p>
        ) : null}
        {priceDealSummary.coverageNote ? (
          <p className={styles.dealSignalSupport}>
            {priceDealSummary.coverageNote}
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
          <p className={styles.referenceFallback}>Nog geen referentieprijs.</p>
        )}
      </div>
      {children}
      <dl className={styles.metaGrid}>
        <PricingMetaItem
          label="Referentieprijs"
          value={
            typeof pricePanelSnapshot.referencePriceMinor === 'number'
              ? formatPriceMinor({
                  currencyCode: pricePanelSnapshot.currencyCode,
                  minorUnits: pricePanelSnapshot.referencePriceMinor,
                })
              : 'Nog niet ingesteld'
          }
        />
        <PricingMetaItem
          label="Laatst reviewed"
          value={formatObservedAt(pricePanelSnapshot.observedAt)}
        />
        <PricingMetaItem
          label="Reviewed aanbiedingen"
          value={getReviewedCoverageLabel(pricePanelSnapshot.merchantCount)}
        />
      </dl>
      <p className={styles.referenceNote}>
        {typeof pricePanelSnapshot.referencePriceMinor === 'number'
          ? 'Geschiedenis en aanbiedingen hieronder gebruiken dezelfde reviewed marktweergave.'
          : 'Geschiedenis en aanbiedingen kunnen verschijnen voordat er een referentieprijs is ingesteld.'}
      </p>
    </Surface>
  );
}

export function PriceDecisionSummaryCard({
  id,
  insights,
}: {
  id?: string;
  insights: readonly SetPriceInsight[];
}) {
  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading eyebrow="Prijscontext" title="Prijs in het kort" />
      <ul className={styles.decisionSummaryList}>
        {insights.map((insight) => (
          <li className={styles.decisionSummaryItem} key={insight.id}>
            {insight.text}
          </li>
        ))}
      </ul>
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
      <section
        aria-label="30-daagse prijssamenvatting"
        className={styles.summaryBlock}
      >
        <p className={styles.summaryLabel}>Recente prijsgeschiedenis</p>
        <p className={styles.summaryNote}>
          {historyPointCount === 1
            ? 'De geschiedenis bouwt op vanaf de eerste dagprijs.'
            : 'De geschiedenis bouwt op. Recente vergelijkingen verschijnen na een paar extra dagprijzen.'}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="30-daagse prijssamenvatting"
      className={styles.summaryBlock}
    >
      <section
        aria-label="30-daagse prijssamenvatting"
        className={styles.summarySection}
      >
        <p className={styles.summaryLabel}>Recente prijsgeschiedenis</p>
        {priceHistorySummary ? (
          <>
            <dl className={styles.summaryGrid}>
              <PricingMetaItem
                label="30-daags laag"
                value={formatPriceMinor({
                  currencyCode: priceHistorySummary.currencyCode,
                  minorUnits: priceHistorySummary.lowPriceMinor,
                })}
              />
              <PricingMetaItem
                label="30-daags hoog"
                value={formatPriceMinor({
                  currencyCode: priceHistorySummary.currencyCode,
                  minorUnits: priceHistorySummary.highPriceMinor,
                })}
              />
              <PricingMetaItem
                label="Huidig vs gemiddelde"
                value={getAverageDeltaLabel({
                  currencyCode: priceHistorySummary.currencyCode,
                  deltaVsAverageMinor: priceHistorySummary.deltaVsAverageMinor,
                })}
              />
            </dl>
            <p className={styles.summaryNote}>
              30-daags gemiddelde:{' '}
              {formatPriceMinor({
                currencyCode: priceHistorySummary.currencyCode,
                minorUnits: priceHistorySummary.averagePriceMinor,
              })}{' '}
              uit {getDailyPointLabel(priceHistorySummary.pointCount)}.
            </p>
          </>
        ) : (
          <p className={styles.summaryNote}>
            {historyPointCount === 1
              ? 'De geschiedenis bouwt op vanaf de eerste dagprijs.'
              : 'De geschiedenis bouwt op. Recente vergelijkingen verschijnen na een paar extra dagprijzen.'}
          </p>
        )}
      </section>
      {trackedPriceSummary ? (
        <section
          aria-label="Bijgehouden prijsbereik"
          className={styles.summarySection}
        >
          <p className={styles.summaryLabel}>Bijgehouden prijsbereik</p>
          <dl className={styles.summaryGrid}>
            <PricingMetaItem
              label="Laagste bijgehouden prijs"
              value={formatPriceMinor({
                currencyCode: trackedPriceSummary.currencyCode,
                minorUnits: trackedPriceSummary.trackedLowPriceMinor,
              })}
            />
            <PricingMetaItem
              label="Hoogste bijgehouden prijs"
              value={formatPriceMinor({
                currencyCode: trackedPriceSummary.currencyCode,
                minorUnits: trackedPriceSummary.trackedHighPriceMinor,
              })}
            />
            <PricingMetaItem
              label="Bijgehouden sinds"
              value={formatRecordedOn(
                trackedPriceSummary.trackedSinceRecordedOn,
              )}
            />
            <PricingMetaItem
              label="Huidig vs bijgehouden laag"
              value={getTrackedDeltaLabel({
                currencyCode: trackedPriceSummary.currencyCode,
                deltaMinor: trackedPriceSummary.deltaVsTrackedLowMinor,
                label: 'bijgehouden laag',
              })}
            />
            <PricingMetaItem
              label="Huidig vs bijgehouden hoog"
              value={getTrackedDeltaLabel({
                currencyCode: trackedPriceSummary.currencyCode,
                deltaMinor: trackedPriceSummary.deltaVsTrackedHighMinor,
                label: 'bijgehouden hoog',
              })}
            />
          </dl>
          <p className={styles.summaryNote}>
            {trackedPriceSummary.pointCount === 1
              ? 'De bijgehouden geschiedenis start met een dagprijs.'
              : `Bijgehouden vanaf ${getTrackedDailyPointLabel(trackedPriceSummary.pointCount)}.`}
          </p>
        </section>
      ) : null}
    </section>
  );
}

export function PricingUnavailableCard({ id }: { id?: string }) {
  return <PricingUnavailableCardContent id={id} variant="default" />;
}

function PricingUnavailableCardContent({
  id,
  variant,
}: {
  id?: string;
  variant: 'default' | 'product';
}) {
  if (variant === 'product') {
    return (
      <div className={`${styles.panel} ${styles.productPanel}`} id={id}>
        <p className={styles.metricLabel}>Reviewed prijs</p>
        <p className={styles.productUnavailableValue}>Nog niet reviewed</p>
        <p className={styles.unavailableCopy}>
          We hebben voor deze set nog geen live prijzen gecheckt.
        </p>
        <PricingScopeLine>{getPricingScopeLabel()}</PricingScopeLine>
      </div>
    );
  }

  return (
    <Surface
      as="section"
      className={styles.panel}
      elevation="rested"
      id={id}
      tone="muted"
    >
      <SectionHeading
        description={`We hebben nog geen live ${getDefaultMarketAdjective()} prijzen voor deze set reviewed.`}
        eyebrow="Koophulp"
        title="Huidige reviewed prijs"
      />
      <PricingScopeLine>
        {getPricingScopeLabel('Nog niet reviewed')}
      </PricingScopeLine>
      <p className={styles.unavailableCopy}>
        Setpagina's en opslaan werken nog steeds terwijl prijsdekking wordt
        opgebouwd.
      </p>
    </Surface>
  );
}

export function ProductPricingUnavailableCard({ id }: { id?: string }) {
  return <PricingUnavailableCardContent id={id} variant="product" />;
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
          description="Tot nu toe is er een dagelijkse reviewed prijs opgeslagen."
          eyebrow="Prijsgeschiedenis"
          title="30-daagse prijsgeschiedenis"
        />
        <PricingScopeLine>
          {getPricingScopeLabel(
            `Geschiedenis bouwt op · ${getDailyPointLabel(1)}`,
          )}
        </PricingScopeLine>
        <div className={styles.metricBlock}>
          <p className={styles.metricLabel}>Eerste bijgehouden prijs</p>
          <p className={styles.metricValue}>
            {formatPriceMinor({
              currencyCode: firstPriceHistoryPoint.currencyCode,
              minorUnits: firstPriceHistoryPoint.headlinePriceMinor,
            })}
          </p>
          <p className={styles.metricContext}>Eerste dagprijs</p>
          <p className={styles.metricContextSecondary}>
            Reviewed op {formatObservedAt(firstPriceHistoryPoint.observedAt)}
          </p>
        </div>
        <dl className={styles.metaGrid}>
          <PricingMetaItem
            label="Opgenomen op"
            value={formatRecordedOn(firstPriceHistoryPoint.recordedOn)}
          />
          <PricingMetaItem label="Status" value="30-daags bereik bouwt op" />
        </dl>
        <p className={styles.referenceNote}>
          Het bijgehouden prijsbereik start vanaf deze eerste reviewed dag.
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
        description="Per dag wordt een reviewed hoofdprijs opgeslagen. Hier zie je de laatste 30 dagen."
        eyebrow="Prijsgeschiedenis"
        title="30-daagse prijsgeschiedenis"
      />
      <PricingScopeLine>
        {getPricingScopeLabel(getDailyPointLabel(priceHistoryPoints.length))}
      </PricingScopeLine>
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
          aria-label={`30-daagse ${getDefaultMarketAdjective()} prijsgeschiedenis`}
          className={styles.historyChart}
          role="img"
          viewBox="0 0 100 48"
        >
          <line
            className={styles.historyGridLine}
            x1="6"
            x2="94"
            y1="8"
            y2="8"
          />
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
          label="Recentste"
          value={formatPriceMinor({
            currencyCode: latest.currencyCode,
            minorUnits: latest.headlinePriceMinor,
          })}
        />
        <PricingMetaItem
          label="30-daags laag"
          value={formatPriceMinor({
            currencyCode: low.currencyCode,
            minorUnits: low.headlinePriceMinor,
          })}
        />
        <PricingMetaItem
          label="30-daags hoog"
          value={formatPriceMinor({
            currencyCode: high.currencyCode,
            minorUnits: high.headlinePriceMinor,
          })}
        />
      </dl>
      <p className={styles.referenceNote}>
        Laatst gecheckt op {formatObservedAt(latest.observedAt)}.
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
        description="Bijgehouden geschiedenis gebruikt opgeslagen dagprijzen."
        eyebrow="Prijsgeschiedenis"
        title="30-daagse prijsgeschiedenis"
      />
      <PricingScopeLine>
        {getPricingScopeLabel('Geschiedenis bouwt op')}
      </PricingScopeLine>
      <p className={styles.unavailableCopy}>
        {isLoading
          ? 'De nieuwste bijgehouden dagprijzen worden geladen.'
          : `Voor deze set is nog geen daggeschiedenis opgeslagen. Verschijnt hierboven wel een reviewed prijs, dan bouwt de geschiedenis nog op. Zo niet, dan valt deze set buiten de huidige ${getDefaultMarketAdjective()} prijsselectie.`}
      </p>
    </Surface>
  );
}

export function PricingUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Compacte koopoppervlakken voor actuele prijsmomenten en 30-daagse geschiedenis."
        eyebrow="Prijs-UI"
        title="Marktklare prijsbegeleiding met productgerichte terughoudendheid."
      />
    </Surface>
  );
}

export default PricingUi;
