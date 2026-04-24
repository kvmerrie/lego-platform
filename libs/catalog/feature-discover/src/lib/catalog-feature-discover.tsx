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

interface CatalogFeatureDiscoverThemeRail {
  setCards?: readonly CatalogFeatureDiscoverRailItem[];
  themeName?: string;
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
  forYouSetCards,
  nowInterestingSetCards,
  recentPriceChangeSetCards,
  recentlyReleasedSetCards,
  themeOfWeek,
  totalSetCount,
  totalThemeCount,
}: {
  bestDealSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  forYouSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  nowInterestingSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  recentPriceChangeSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  recentlyReleasedSetCards?: readonly CatalogFeatureDiscoverRailItem[];
  themeOfWeek?: CatalogFeatureDiscoverThemeRail;
  totalSetCount?: number;
  totalThemeCount?: number;
}) {
  const resolvedNowInterestingSetCards = nowInterestingSetCards ?? [];
  const resolvedForYouSetCards = forYouSetCards ?? [];
  const resolvedRecentPriceChangeSetCards = recentPriceChangeSetCards ?? [];
  const resolvedRecentlyReleasedSetCards = recentlyReleasedSetCards ?? [];
  const resolvedThemeOfWeekSetCards = themeOfWeek?.setCards ?? [];
  const resolvedTotalSetCount = totalSetCount ?? 0;
  const resolvedTotalThemeCount = totalThemeCount ?? 0;
  const hasFilteredContent =
    resolvedNowInterestingSetCards.length > 0 ||
    bestDealSetCards.length > 0 ||
    resolvedForYouSetCards.length > 0 ||
    resolvedRecentPriceChangeSetCards.length > 0 ||
    resolvedThemeOfWeekSetCards.length > 0 ||
    resolvedRecentlyReleasedSetCards.length > 0;

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <SectionHeading
          description="Begin waar het nu beweegt. Kijk eerst naar verse activiteit, pak daarna de scherpste prijzen en sluit af met de sets en thema's die nu het meest trekken."
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
          description="Deze rails vullen zich zodra prijsbeweging, deals en nieuwe releases breed genoeg in beeld zijn."
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

      {hasFilteredContent && resolvedNowInterestingSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Nu interessant"
          bodySpacing="relaxed"
          className={styles.dealSection}
          description="Hier wil je nu als eerste kijken. Prijsbeweging, verse dekking en verschil tussen winkels komen hier samen."
          eyebrow="Nu"
          items={resolvedNowInterestingSetCards.map((setCard) => ({
            actions: setCard.actions,
            ctaMode: setCard.ctaMode,
            href: buildSetDetailPath(setCard.slug),
            id: setCard.id,
            priceContext: setCard.priceContext,
            setSummary: setCard,
            supportingNote: formatDiscoverFanContext(setCard),
          }))}
          padding="default"
          signal={formatSetCount(resolvedNowInterestingSetCards.length)}
          title="Nu interessant"
          titleAs="h2"
          tone="default"
          variant="featured"
        />
      ) : null}

      {hasFilteredContent && bestDealSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Beste prijs nu"
          bodySpacing="relaxed"
          className={styles.dealSection}
          description="De scherpste prijzen die we nu zien bij winkels."
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
          title="Beste prijs nu"
          titleAs="h2"
          tone="default"
          variant="featured"
        />
      ) : null}

      {hasFilteredContent && resolvedRecentPriceChangeSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Net in prijs veranderd"
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description="Sets waarvan de prijs recent is aangepast."
          eyebrow="Beweging"
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
          title="Net in prijs veranderd"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}

      {hasFilteredContent && resolvedRecentlyReleasedSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Nieuwe releases"
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description="Nieuwe sets die net in de catalogus zitten en interessant worden."
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
          title="Nieuwe releases"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}

      {hasFilteredContent &&
      resolvedThemeOfWeekSetCards.length &&
      themeOfWeek?.themeName ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel={`Thema van de week: ${themeOfWeek.themeName}`}
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description={`Hier gebeurt nu het meest binnen ${themeOfWeek.themeName}.`}
          eyebrow={themeOfWeek.themeName}
          items={resolvedThemeOfWeekSetCards.map((setCard) => ({
            actions: setCard.actions,
            ctaMode: setCard.ctaMode,
            href: buildSetDetailPath(setCard.slug),
            id: setCard.id,
            priceContext: setCard.priceContext,
            setSummary: setCard,
            supportingNote: formatDiscoverFanContext(setCard),
          }))}
          padding="default"
          signal={formatSetCount(resolvedThemeOfWeekSetCards.length)}
          title="Thema van de week"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}

      {hasFilteredContent && resolvedForYouSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Voor jou interessant"
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description="Een mix van deals, prijsbeweging en thema's die nu het meest trekken."
          eyebrow="Mix"
          items={resolvedForYouSetCards.map((setCard) => ({
            actions: setCard.actions,
            ctaMode: setCard.ctaMode,
            href: buildSetDetailPath(setCard.slug),
            id: setCard.id,
            priceContext: setCard.priceContext,
            setSummary: setCard,
            supportingNote: formatDiscoverFanContext(setCard),
          }))}
          padding="default"
          signal={formatSetCount(resolvedForYouSetCards.length)}
          title="Voor jou interessant"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}
    </div>
  );
}

export default CatalogFeatureDiscover;
