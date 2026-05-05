import type { ReactNode } from 'react';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSectionShell,
  CatalogRailActionLink,
  CatalogSetCard,
  type CatalogSetCardCtaMode,
  CatalogSetCardCollection,
  CatalogSetCardRailSection,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import type { BrickhuntAnalyticsEventDescriptor } from '@lego-platform/shared/util';
import styles from './catalog-feature-set-list.module.css';

export interface CatalogFeatureSetListItem extends CatalogHomepageSetCard {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  priceContext?: CatalogSetCardPriceContext;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
}

export function CatalogFeatureSetList({
  actionHref,
  actionLabel,
  description = 'Grote sets die je plank én budget bepalen.',

  eyebrow = 'Pronkstukken',
  layout = 'rail',
  sectionId = 'featured-sets',
  setCards,
  showSignal = true,
  signalText,
  tone = 'muted',
  title = 'Torens, walkers, supercars',
}: {
  actionHref?: string;
  actionLabel?: string;
  description?: string;
  eyebrow?: string;
  layout?: 'grid' | 'rail';
  sectionId?: string;
  setCards?: readonly CatalogFeatureSetListItem[];
  showSignal?: boolean;
  signalText?: string;
  tone?: 'default' | 'muted';
  title?: string;
}) {
  const homepageSets: readonly CatalogFeatureSetListItem[] = setCards ?? [];
  const actionLink =
    actionHref && actionLabel ? (
      <CatalogRailActionLink className={styles.railAction} href={actionHref}>
        {actionLabel}
      </CatalogRailActionLink>
    ) : undefined;
  const reviewedSetCount = homepageSets.filter(
    (catalogHomepageSetCard) => catalogHomepageSetCard.priceContext,
  ).length;
  const sectionShellProps = {
    as: 'section' as const,
    bodySpacing: 'relaxed' as const,
    className: styles.section,
    description,
    eyebrow,
    headingClassName: styles.header,
    id: sectionId,
    padding: 'default' as const,
    signal: showSignal
      ? (signalText ??
        `${homepageSets.length} sets die meteen de kamer pakken${
          reviewedSetCount ? ` · ${reviewedSetCount} met nagekeken prijzen` : ''
        }`)
      : undefined,
    spacing: 'relaxed' as const,
    title,
    tone,
    action: actionLink,
  };

  return layout === 'grid' ? (
    <CatalogSectionShell {...sectionShellProps}>
      <CatalogSetCardCollection
        className={styles.grid}
        gridMode="browse"
        variant="featured"
      >
        {homepageSets.map((catalogSetSummary) => (
          <CatalogSetCard
            actions={catalogSetSummary.actions}
            ctaMode={catalogSetSummary.ctaMode}
            key={catalogSetSummary.id}
            href={buildSetDetailPath(catalogSetSummary.slug)}
            priceContext={catalogSetSummary.priceContext}
            setSummary={catalogSetSummary}
            trackingEvent={catalogSetSummary.trackingEvent}
            variant="featured"
          />
        ))}
      </CatalogSetCardCollection>
    </CatalogSectionShell>
  ) : (
    <CatalogSetCardRailSection
      {...sectionShellProps}
      ariaLabel={title}
      items={homepageSets.map((catalogSetSummary) => ({
        actions: catalogSetSummary.actions,
        ctaMode: catalogSetSummary.ctaMode,
        href: buildSetDetailPath(catalogSetSummary.slug),
        id: catalogSetSummary.id,
        priceContext: catalogSetSummary.priceContext,
        setSummary: catalogSetSummary,
        trackingEvent: catalogSetSummary.trackingEvent,
      }))}
      variant="featured"
    />
  );
}

export default CatalogFeatureSetList;
