import type { CSSProperties, ReactNode } from 'react';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSectionShell,
  CatalogRailActionLink,
  CatalogSetCard,
  CatalogSetCardRail,
  type CatalogSetCardCtaMode,
  CatalogSetCardCollection,
  type CatalogSetCardRailLayoutMode,
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
  className,
  description = 'Grote sets die je plank én budget bepalen.',
  headingActionLabel,
  headingHref,
  headingOnClick,
  layout = 'rail',
  prioritizeFirstImage = false,
  railLayoutMode = 'stable-square',
  sectionId = 'featured-sets',
  setCards,
  showHeadingChevron,
  showHeader = true,
  showSignal = true,
  signalText,
  style,
  surfaceVariant = 'default',
  tone = 'muted',
  title = 'Torens, walkers, supercars',
}: {
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  description?: string;
  eyebrow?: string;
  headingActionLabel?: string;
  headingHref?: string;
  headingOnClick?: () => void;
  layout?: 'grid' | 'rail';
  prioritizeFirstImage?: boolean;
  railLayoutMode?: CatalogSetCardRailLayoutMode;
  sectionId?: string;
  setCards?: readonly CatalogFeatureSetListItem[];
  showHeadingChevron?: boolean;
  showHeader?: boolean;
  showSignal?: boolean;
  signalText?: string;
  style?: CSSProperties;
  surfaceVariant?: 'default' | 'themed';
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
    className: [styles.section, className].filter(Boolean).join(' '),
    description:
      layout === 'grid'
        ? `${homepageSets.length} producten worden weergegeven`
        : description,
    headingClassName: styles.header,
    headingActionLabel,
    headingHref,
    headingOnClick,
    id: sectionId,
    padding: 'default' as const,
    signal:
      layout === 'grid'
        ? undefined
        : showSignal
          ? (signalText ??
            `${homepageSets.length} sets die meteen de kamer pakken${
              reviewedSetCount
                ? ` · ${reviewedSetCount} met nagekeken prijzen`
                : ''
            }`)
          : undefined,
    spacing: 'relaxed' as const,
    title,
    tone,
    action: actionLink,
    showHeadingChevron,
    style,
  };
  const railItems = homepageSets.map((catalogSetSummary, index) => ({
    actions: catalogSetSummary.actions,
    ctaMode: catalogSetSummary.ctaMode,
    href: buildSetDetailPath(catalogSetSummary.slug),
    id: catalogSetSummary.id,
    imageFetchPriority:
      prioritizeFirstImage && index === 0 ? 'high' : undefined,
    imageLoading: prioritizeFirstImage && index === 0 ? 'eager' : undefined,
    priceContext: catalogSetSummary.priceContext,
    setSummary: catalogSetSummary,
    trackingEvent: catalogSetSummary.trackingEvent,
  }));

  if (layout === 'rail' && !showHeader) {
    return (
      <section
        aria-label={title}
        className={[styles.section, className].filter(Boolean).join(' ')}
        id={sectionId}
        style={style}
      >
        <CatalogSetCardRail
          ariaLabel={title}
          items={railItems}
          railLayoutMode={railLayoutMode}
          showControls
          variant="featured"
        />
      </section>
    );
  }

  return layout === 'grid' ? (
    <CatalogSectionShell {...sectionShellProps}>
      <CatalogSetCardCollection
        className={styles.grid}
        gridMode="browse"
        variant="featured"
      >
        {homepageSets.map((catalogSetSummary, index) => (
          <CatalogSetCard
            actions={catalogSetSummary.actions}
            ctaMode={catalogSetSummary.ctaMode}
            key={catalogSetSummary.id}
            href={buildSetDetailPath(catalogSetSummary.slug)}
            imageFetchPriority={
              prioritizeFirstImage && index === 0 ? 'high' : undefined
            }
            imageLoading={
              prioritizeFirstImage && index === 0 ? 'eager' : undefined
            }
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
      items={railItems}
      railLayoutMode={railLayoutMode}
      surfaceVariant={surfaceVariant}
      variant="featured"
    />
  );
}

export default CatalogFeatureSetList;
