import type { ReactNode } from 'react';
import {
  CatalogSectionShell,
  CatalogSetCardRailSection,
  type CatalogSetCardCtaMode,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { type CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { ActionLink, SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-discover.module.css';

function formatThemeCount(count: number): string {
  return `${count} thema${count === 1 ? '' : "'s"}`;
}

function formatSetCount(count: number): string {
  return `${count} set${count === 1 ? '' : 's'}`;
}

function renderCanonicalNames(names: readonly string[]): ReactNode {
  return names.map((name, index) => (
    <span key={`${name}-${index}`}>
      {index > 0 ? (index === names.length - 1 ? ' en ' : ', ') : null}
      <span className="notranslate" translate="no">
        {name}
      </span>
    </span>
  ));
}

export interface CatalogFeatureDiscoverRailItem extends CatalogHomepageSetCard {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  priceContext?: CatalogSetCardPriceContext;
}

function formatDiscoverFanContext(
  setCard: Pick<CatalogHomepageSetCard, 'minifigureHighlights'>,
): ReactNode {
  if (setCard.minifigureHighlights?.length) {
    const visibleHighlights = setCard.minifigureHighlights.slice(0, 3);
    return <>Met {renderCanonicalNames(visibleHighlights)}</>;
  }
}

export function CatalogFeatureDiscover({
  bestDealSetCards = [],
  recentPriceChangeSetCards,
  recentlyReleasedSetCards,
  totalSetCount,
  totalThemeCount,
}: {
  bestDealSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  recentPriceChangeSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  recentlyReleasedSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  totalSetCount?: number;
  totalThemeCount?: number;
}) {
  const resolvedRecentPriceChangeSetCards = recentPriceChangeSetCards ?? [];
  const resolvedRecentlyReleasedSetCards = recentlyReleasedSetCards ?? [];
  const resolvedTotalSetCount = totalSetCount ?? 0;
  const resolvedTotalThemeCount = totalThemeCount ?? 0;
  const hasFilteredContent =
    bestDealSetCards.length > 0 ||
    resolvedRecentPriceChangeSetCards.length > 0 ||
    resolvedRecentlyReleasedSetCards.length > 0;

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <SectionHeading
          description="Begin waar prijzen echt bewegen, kijk daarna naar de sterkste deals van nu en eindig bij de sets die net nieuw genoeg zijn om te volgen."
          eyebrow="Ontdekken"
          title="Ontdek waar het nu echt beweegt"
          titleAs="h1"
        />
        <p className={styles.introMeta}>
          {resolvedTotalSetCount} sets ·{' '}
          {formatThemeCount(resolvedTotalThemeCount)} in de publieke catalogus
        </p>
        <div className={styles.introActions}>
          <ActionLink href={webPathnames.themes} tone="secondary">
            Bekijk alle thema's
          </ActionLink>
        </div>
      </section>

      {!hasFilteredContent ? (
        <CatalogSectionShell
          as="section"
          className={styles.emptyState}
          description="Deze rails vullen zich zodra prijsbeweging, duidelijke deals en nieuwe releases breed genoeg in beeld zijn."
          eyebrow="Ontdekken"
          padding="default"
          title="Ontdekken wordt verder gevuld"
          titleAs="h2"
          tone="muted"
        >
          <div className={styles.introActions}>
            <ActionLink
              href={buildWebPath(webPathnames.discover)}
              tone="secondary"
            >
              Toon alle sets
            </ActionLink>
          </div>
        </CatalogSectionShell>
      ) : null}

      {hasFilteredContent && resolvedRecentPriceChangeSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Waar prijzen recent zijn veranderd"
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description="Sets waar recent iets bewoog in prijs, zodat je sneller ziet waar het koopmoment verandert."
          eyebrow="Prijsbeweging"
          items={resolvedRecentPriceChangeSetCards.map((setCard) => ({
            actions: setCard.actions,
            ctaMode: setCard.ctaMode,
            href: buildSetDetailPath(setCard.slug),
            id: setCard.id,
            priceContext: setCard.priceContext,
            setSummary: setCard,
            supportingNote: formatDiscoverFanContext(setCard),
          }))}
          padding="default"
          signal={formatSetCount(resolvedRecentPriceChangeSetCards.length)}
          title="Waar prijzen recent zijn veranderd"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}

      {hasFilteredContent && bestDealSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Beste deals nu"
          bodySpacing="relaxed"
          className={styles.dealSection}
          description="Sets waar de huidige prijs nu duidelijk afsteekt tegen wat we meestal of elders zien."
          eyebrow="Deals"
          items={bestDealSetCards.map((dealSetCard) => ({
            actions: dealSetCard.actions,
            ctaMode: dealSetCard.ctaMode,
            href: buildSetDetailPath(dealSetCard.slug),
            id: dealSetCard.id,
            priceContext: dealSetCard.priceContext,
            setSummary: dealSetCard,
            supportingNote: formatDiscoverFanContext(dealSetCard),
          }))}
          padding="default"
          signal={formatSetCount(bestDealSetCards.length)}
          title="Beste deals nu"
          titleAs="h2"
          tone="default"
          variant="featured"
        />
      ) : null}

      {hasFilteredContent && resolvedRecentlyReleasedSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Net uitgebracht"
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description="Nieuwe sets die net in de catalogus zitten en nu interessant worden om te volgen of vergelijken."
          eyebrow="Nieuw"
          items={resolvedRecentlyReleasedSetCards.map((setCard) => ({
            actions: setCard.actions,
            ctaMode: setCard.ctaMode,
            href: buildSetDetailPath(setCard.slug),
            id: setCard.id,
            priceContext: setCard.priceContext,
            setSummary: setCard,
            supportingNote: formatDiscoverFanContext(setCard),
          }))}
          padding="default"
          signal={formatSetCount(resolvedRecentlyReleasedSetCards.length)}
          title="Net uitgebracht"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}
    </div>
  );
}

export default CatalogFeatureDiscover;
