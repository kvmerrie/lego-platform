import type { ReactNode } from 'react';
import {
  listDiscoverCharacterSetCards,
  listCatalogSetSummaries,
  listCatalogThemes,
  listDiscoverBrowseThemeGroups,
  listDiscoverHighlightSetCards,
} from '@lego-platform/catalog/data-access';
import {
  CatalogQuickFilterBar,
  CatalogSectionShell,
  CatalogSetCard,
  type CatalogSetCardCtaMode,
  CatalogSetCardCollection,
  CatalogSetCardRailSection,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import {
  type CatalogHomepageSetCard,
  type CatalogQuickFilterKey,
  listCatalogQuickFilterOptions,
  matchesCatalogQuickFilter,
  normalizeCatalogQuickFilterKey,
} from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildWebPath,
  buildThemePath,
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

function formatThemeLaneCount({
  shownCount,
  totalCount,
}: {
  shownCount: number;
  totalCount: number;
}): string {
  if (shownCount >= totalCount) {
    return formatSetCount(totalCount);
  }

  return `${shownCount} getoond · ${totalCount} totaal`;
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

export interface CatalogFeatureDiscoverDealItem extends CatalogHomepageSetCard {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  priceContext?: CatalogSetCardPriceContext;
}

function buildDiscoverFilterHref(filter: CatalogQuickFilterKey): string {
  const discoverPath = buildWebPath(webPathnames.discover);

  if (filter === 'all') {
    return discoverPath;
  }

  const searchParams = new URLSearchParams({
    filter,
  });

  return `${discoverPath}?${searchParams.toString()}`;
}

const primaryDiscoverQuickFilters = new Set<CatalogQuickFilterKey>([
  'all',
  'best-deals',
  'with-minifigures',
]);

function filterDiscoverSetCards<T extends CatalogHomepageSetCard>({
  filter,
  setCards,
  strongDealSetIds,
}: {
  filter: CatalogQuickFilterKey;
  setCards: readonly T[];
  strongDealSetIds: readonly string[];
}): T[] {
  return setCards.filter((setCard) =>
    matchesCatalogQuickFilter({
      filter,
      setCard,
      strongDealSetIds,
    }),
  );
}

function formatDiscoverFanContext(
  setCard: Pick<
    CatalogHomepageSetCard,
    'collectorAngle' | 'minifigureHighlights'
  >,
): ReactNode {
  if (setCard.minifigureHighlights?.length) {
    const visibleHighlights = setCard.minifigureHighlights.slice(0, 3);
    return <>Met {renderCanonicalNames(visibleHighlights)}</>;
  }

  return setCard.collectorAngle;
}

export function CatalogFeatureDiscover({
  activeFilter,
  bestDealSetIds = [],
  dealSetCards = [],
  reviewedSetIds = [],
}: {
  activeFilter?: string;
  bestDealSetIds?: readonly string[];
  dealSetCards?: readonly CatalogFeatureDiscoverDealItem[];
  reviewedSetIds?: readonly string[];
}) {
  const normalizedFilter = normalizeCatalogQuickFilterKey(activeFilter);
  const characterSetCards = listDiscoverCharacterSetCards({
    reviewedSetIds,
  });
  const highlightSetCards = listDiscoverHighlightSetCards({
    reviewedSetIds,
  });
  const themeGroups = listDiscoverBrowseThemeGroups({
    reviewedSetIds,
  });
  const totalSetCount = listCatalogSetSummaries().length;
  const totalThemeCount = listCatalogThemes().length;
  const activeQuickFilterOption = listCatalogQuickFilterOptions().find(
    (catalogQuickFilterOption) =>
      catalogQuickFilterOption.key === normalizedFilter,
  );
  const quickFilterItems = listCatalogQuickFilterOptions().map(
    (catalogQuickFilterOption) => ({
      href: buildDiscoverFilterHref(catalogQuickFilterOption.key),
      isActive: normalizedFilter === catalogQuickFilterOption.key,
      key: catalogQuickFilterOption.key,
      label: catalogQuickFilterOption.label,
    }),
  );
  const primaryQuickFilterItems = quickFilterItems.filter((quickFilterItem) =>
    primaryDiscoverQuickFilters.has(quickFilterItem.key),
  );
  const moreQuickFilterItems = quickFilterItems.filter(
    (quickFilterItem) => !primaryDiscoverQuickFilters.has(quickFilterItem.key),
  );
  const hasActiveMoreFilter = moreQuickFilterItems.some(
    (quickFilterItem) => quickFilterItem.isActive,
  );
  const activeMoreFilterLabel = moreQuickFilterItems.find(
    (quickFilterItem) => quickFilterItem.isActive,
  )?.label;
  const filteredDealSetCards = filterDiscoverSetCards({
    filter: normalizedFilter,
    setCards: dealSetCards,
    strongDealSetIds: bestDealSetIds,
  });
  const filteredCharacterSetCards = filterDiscoverSetCards({
    filter: normalizedFilter,
    setCards: characterSetCards,
    strongDealSetIds: bestDealSetIds,
  });
  const filteredHighlightSetCards = filterDiscoverSetCards({
    filter: normalizedFilter,
    setCards: highlightSetCards,
    strongDealSetIds: bestDealSetIds,
  });
  const filteredThemeGroups = themeGroups
    .map((themeGroup) => ({
      ...themeGroup,
      setCards: filterDiscoverSetCards({
        filter: normalizedFilter,
        setCards: themeGroup.setCards,
        strongDealSetIds: bestDealSetIds,
      }),
    }))
    .filter((themeGroup) => themeGroup.setCards.length > 0);
  const hasFilteredContent =
    filteredDealSetCards.length > 0 ||
    filteredCharacterSetCards.length > 0 ||
    filteredHighlightSetCards.length > 0 ||
    filteredThemeGroups.length > 0;

  if (!themeGroups.length) {
    return (
      <CatalogSectionShell
        as="section"
        className={styles.emptyState}
        description="We breiden de bladercatalogus nog verder uit."
        eyebrow="Ontdekken"
        padding="default"
        title="Ontdekken wordt nog aangevuld"
        tone="muted"
      />
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <SectionHeading
          description="Begin met de duidelijkste deals van nu en ga daarna verder naar de sterkste franchise-, vlaggenschip- en verzamelaarsvriendelijke themalijnen."
          eyebrow="Ontdekken"
          title="Open eerst de sterkste sets"
          titleAs="h1"
        />
        <p className={styles.introMeta}>
          {totalSetCount} sets · {formatThemeCount(totalThemeCount)} in de
          publieke catalogus
        </p>
        <div className={styles.introActions}>
          <ActionLink href={webPathnames.themes} tone="secondary">
            Bekijk alle thema's
          </ActionLink>
        </div>
      </section>

      <CatalogSectionShell
        as="section"
        bodyClassName={styles.filterSectionBody}
        bodySpacing="compact"
        className={styles.filterSection}
        description="Deze filters werken op de sets hieronder. Pak snelle filters voor deals of minifigs en open meer filters als je meteen een thema wilt uitlichten."
        eyebrow="Filters"
        padding="default"
        spacing="compact"
        title="Kijk eerst hoe je wilt bladeren"
        titleAs="h2"
        tone="muted"
      >
        <div className={styles.filterControls}>
          <CatalogQuickFilterBar
            ariaLabel="Snelle filters voor ontdekken"
            className={styles.primaryFilterBar}
            items={primaryQuickFilterItems}
          />
          <details
            className={styles.moreFilters}
            open={hasActiveMoreFilter ? true : undefined}
          >
            <summary className={styles.moreFiltersSummary}>
              Meer filters
              {activeMoreFilterLabel ? (
                <span className={styles.moreFiltersActiveLabel}>
                  {activeMoreFilterLabel}
                </span>
              ) : null}
            </summary>
            <div className={styles.moreFiltersPanel}>
              <p className={styles.moreFiltersHeading}>Themafilters</p>
              <CatalogQuickFilterBar
                ariaLabel="Meer filters voor ontdekken"
                className={styles.moreFiltersBar}
                items={moreQuickFilterItems}
              />
            </div>
          </details>
        </div>
      </CatalogSectionShell>

      {!hasFilteredContent ? (
        <CatalogSectionShell
          as="section"
          className={styles.emptyState}
          description="Probeer een andere snelle filter of open een volledige themalijn om verder door de huidige publieke catalogus te bladeren."
          eyebrow="Ontdekken"
          padding="default"
          title={`Geen treffers in ${activeQuickFilterOption?.label ?? 'deze filter'}`}
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

      {hasFilteredContent && filteredDealSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Beste deals om eerst te bekijken"
          bodySpacing="relaxed"
          className={styles.dealSection}
          description="De duidelijkste reviewed prijsverschillen tussen de sterkste vlaggenschepen en publieksmagneten die al in de catalogus staan."
          eyebrow="Deals"
          items={filteredDealSetCards.map((dealSetCard) => ({
            actions: dealSetCard.actions,
            ctaMode: dealSetCard.ctaMode,
            href: buildSetDetailPath(dealSetCard.slug),
            id: dealSetCard.id,
            priceContext: dealSetCard.priceContext,
            setSummary: dealSetCard,
            supportingNote: formatDiscoverFanContext(dealSetCard),
          }))}
          padding="default"
          signal={formatSetCount(filteredDealSetCards.length)}
          title="Beste deals om eerst te bekijken"
          titleAs="h2"
          tone="default"
          variant="featured"
        />
      ) : null}

      {hasFilteredContent && filteredCharacterSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Iconische personages en castfavorieten"
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description="Sets waarbij de cast deel van de aantrekkingskracht is, van grote franchise-ankers tot verhaalgedreven favorieten voor verzamelaars."
          eyebrow="Personages"
          items={filteredCharacterSetCards.map((characterSetCard) => ({
            href: buildSetDetailPath(characterSetCard.slug),
            id: characterSetCard.id,
            setSummary: characterSetCard,
            supportingNote: formatDiscoverFanContext(characterSetCard),
          }))}
          padding="default"
          signal={formatSetCount(filteredCharacterSetCards.length)}
          title="Iconische personages en castfavorieten"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}

      {hasFilteredContent && filteredHighlightSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel="Eerst het openen waard"
          bodySpacing="relaxed"
          className={styles.featuredSection}
          description="Een strakkere mix van premium vlaggenschepen, iconische franchises en toegankelijkere sets die het waard zijn om eerst te openen."
          eyebrow="Highlights"
          items={filteredHighlightSetCards.map((highlightSetCard) => ({
            href: buildSetDetailPath(highlightSetCard.slug),
            id: highlightSetCard.id,
            setSummary: highlightSetCard,
            supportingNote: formatDiscoverFanContext(highlightSetCard),
          }))}
          padding="default"
          signal={formatSetCount(filteredHighlightSetCards.length)}
          title="Eerst het openen waard"
          titleAs="h2"
          tone="muted"
          variant="compact"
        />
      ) : null}

      {hasFilteredContent ? (
        <div className={styles.themeSections}>
          {filteredThemeGroups.map((themeGroup, index) => (
            <CatalogSectionShell
              as="section"
              bodySpacing="default"
              className={styles.themeSection}
              eyebrow="Thema"
              key={themeGroup.theme}
              padding="default"
              signal={formatThemeLaneCount({
                shownCount: themeGroup.setCards.length,
                totalCount:
                  themeGroup.totalSetCount ?? themeGroup.setCards.length,
              })}
              title={
                <span
                  className={`${styles.themeTitle} notranslate`}
                  translate="no"
                >
                  {themeGroup.theme}
                </span>
              }
              titleAs="h2"
              tone={index % 2 === 0 ? 'default' : 'muted'}
              utility={
                <ActionLink
                  className={styles.themeAction}
                  href={buildThemePath(themeGroup.slug)}
                  tone="secondary"
                >
                  Open volledig thema
                </ActionLink>
              }
              utilityPlacement="below-heading"
            >
              <CatalogSetCardCollection
                className={styles.themeGrid}
                gridMode="browse"
                variant="compact"
              >
                {themeGroup.setCards.map((setCard) => (
                  <CatalogSetCard
                    href={buildSetDetailPath(setCard.slug)}
                    key={setCard.id}
                    setSummary={setCard}
                    showThemeBadge={false}
                    variant="compact"
                  />
                ))}
              </CatalogSetCardCollection>
            </CatalogSectionShell>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default CatalogFeatureDiscover;
