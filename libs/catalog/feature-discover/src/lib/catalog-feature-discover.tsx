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
  CatalogSetCardRail,
  CatalogSetCard,
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
import { ActionLink, SectionHeading, Surface } from '@lego-platform/shared/ui';
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
      label: catalogQuickFilterOption.label,
    }),
  );
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
      <Surface as="section" className={styles.emptyState} tone="muted">
        <SectionHeading
          description="We breiden de bladercatalogus nog verder uit."
          eyebrow="Ontdekken"
          title="Ontdekken wordt nog aangevuld"
        />
      </Surface>
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

      <CatalogQuickFilterBar
        ariaLabel="Verfijn ontdekken"
        items={quickFilterItems}
      />

      {!hasFilteredContent ? (
        <Surface as="section" className={styles.emptyState} tone="muted">
          <SectionHeading
            description="Probeer een andere snelle filter of open een volledige themalijn om verder door de huidige publieke catalogus te bladeren."
            eyebrow="Ontdekken"
            title={`Geen treffers in ${activeQuickFilterOption?.label ?? 'deze filter'}`}
            titleAs="h2"
          />
          <div className={styles.introActions}>
            <ActionLink
              href={buildWebPath(webPathnames.discover)}
              tone="secondary"
            >
              Toon alle sets
            </ActionLink>
          </div>
        </Surface>
      ) : null}

      {hasFilteredContent && filteredDealSetCards.length ? (
        <Surface as="section" className={styles.dealSection} tone="default">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="De duidelijkste reviewed prijsverschillen tussen de sterkste vlaggenschepen en publieksmagneten die al in de catalogus staan."
              eyebrow="Deals"
              title="Beste deals om eerst te bekijken"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(filteredDealSetCards.length)}
            </p>
          </div>
          <CatalogSetCardRail
            ariaLabel="Beste deals om eerst te bekijken"
            items={filteredDealSetCards.map((dealSetCard) => ({
              href: buildSetDetailPath(dealSetCard.slug),
              id: dealSetCard.id,
              priceContext: dealSetCard.priceContext,
              setSummary: dealSetCard,
              supportingNote: formatDiscoverFanContext(dealSetCard),
            }))}
            variant="featured"
          />
        </Surface>
      ) : null}

      {hasFilteredContent && filteredCharacterSetCards.length ? (
        <Surface as="section" className={styles.featuredSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="Sets waarbij de cast deel van de aantrekkingskracht is, van grote franchise-ankers tot verhaalgedreven favorieten voor verzamelaars."
              eyebrow="Personages"
              title="Iconische personages en castfavorieten"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(filteredCharacterSetCards.length)}
            </p>
          </div>
          <CatalogSetCardRail
            ariaLabel="Iconische personages en castfavorieten"
            items={filteredCharacterSetCards.map((characterSetCard) => ({
              href: buildSetDetailPath(characterSetCard.slug),
              id: characterSetCard.id,
              setSummary: characterSetCard,
              supportingNote: formatDiscoverFanContext(characterSetCard),
            }))}
            variant="compact"
          />
        </Surface>
      ) : null}

      {hasFilteredContent && filteredHighlightSetCards.length ? (
        <Surface as="section" className={styles.featuredSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="Een strakkere mix van premium vlaggenschepen, iconische franchises en toegankelijkere sets die het waard zijn om eerst te openen."
              eyebrow="Highlights"
              title="Eerst het openen waard"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(filteredHighlightSetCards.length)}
            </p>
          </div>
          <CatalogSetCardRail
            ariaLabel="Eerst het openen waard"
            items={filteredHighlightSetCards.map((highlightSetCard) => ({
              href: buildSetDetailPath(highlightSetCard.slug),
              id: highlightSetCard.id,
              setSummary: highlightSetCard,
              supportingNote: formatDiscoverFanContext(highlightSetCard),
            }))}
            variant="compact"
          />
        </Surface>
      ) : null}

      {hasFilteredContent ? (
        <div className={styles.themeSections}>
          {filteredThemeGroups.map((themeGroup, index) => (
            <Surface
              as="section"
              className={styles.themeSection}
              key={themeGroup.theme}
              tone={index % 2 === 0 ? 'default' : 'muted'}
            >
              <div className={styles.themeHeader}>
                <div className={styles.themeHeadingBlock}>
                  <p className={styles.themeEyebrow}>Theme</p>
                  <h2
                    className={`${styles.themeTitle} notranslate`}
                    translate="no"
                  >
                    {themeGroup.theme}
                  </h2>
                  <ActionLink
                    className={styles.themeAction}
                    href={buildThemePath(themeGroup.slug)}
                    tone="secondary"
                  >
                    Open volledig thema
                  </ActionLink>
                </div>
                <p className={styles.sectionMeta}>
                  {formatThemeLaneCount({
                    shownCount: themeGroup.setCards.length,
                    totalCount:
                      themeGroup.totalSetCount ?? themeGroup.setCards.length,
                  })}
                </p>
              </div>
              <div className={styles.themeGrid}>
                {themeGroup.setCards.map((setCard) => (
                  <CatalogSetCard
                    href={buildSetDetailPath(setCard.slug)}
                    key={setCard.id}
                    setSummary={setCard}
                    variant="compact"
                  />
                ))}
              </div>
            </Surface>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default CatalogFeatureDiscover;
