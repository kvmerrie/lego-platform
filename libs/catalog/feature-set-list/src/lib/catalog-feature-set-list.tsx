import type { ReactNode } from 'react';
import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSectionShell,
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
  description = 'Grote sets die je plank én budget bepalen.',

  eyebrow = 'Pronkstukken',
  layout = 'rail',
  sectionId = 'featured-sets',
  setCards,
  signalText,
  tone = 'muted',
  title = 'Torens, walkers, supercars',
}: {
  description?: string;
  eyebrow?: string;
  layout?: 'grid' | 'rail';
  sectionId?: string;
  setCards?: readonly CatalogFeatureSetListItem[];
  signalText?: string;
  tone?: 'default' | 'muted';
  title?: string;
}) {
  const homepageSets: readonly CatalogFeatureSetListItem[] =
    setCards ??
    listHomepageSetCards().map((catalogHomepageSetCard) => ({
      ...catalogHomepageSetCard,
      priceContext: undefined,
    }));
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
    signal:
      signalText ??
      `${homepageSets.length} sets die meteen de kamer pakken${
        reviewedSetCount ? ` · ${reviewedSetCount} met nagekeken prijzen` : ''
      }`,
    spacing: 'relaxed' as const,
    title,
    tone,
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
