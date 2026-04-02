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
  return `${count} theme${count === 1 ? '' : 's'}`;
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

  return `${shownCount} shown · ${totalCount} total`;
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
): string {
  if (setCard.minifigureHighlights?.length) {
    const visibleHighlights = setCard.minifigureHighlights.slice(0, 3);

    if (visibleHighlights.length === 1) {
      return `Includes ${visibleHighlights[0]}`;
    }

    if (visibleHighlights.length === 2) {
      return `Includes ${visibleHighlights[0]} and ${visibleHighlights[1]}`;
    }

    const lastVisibleHighlight = visibleHighlights.at(-1);
    const leadingHighlights = visibleHighlights.slice(0, -1);

    if (!lastVisibleHighlight) {
      return setCard.collectorAngle;
    }

    return `Includes ${leadingHighlights.join(', ')}, and ${lastVisibleHighlight}`;
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
          description="We're still expanding the browse catalog."
          eyebrow="Discover"
          title="Discover is filling up"
        />
      </Surface>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <SectionHeading
          description="Start with the clearest current deals, then move into the strongest franchise, flagship, and collector-friendly theme lanes."
          eyebrow="Discover"
          title="Open the strongest sets first"
          titleAs="h1"
        />
        <p className={styles.introMeta}>
          {totalSetCount} sets · {formatThemeCount(totalThemeCount)} in the
          public catalog
        </p>
        <div className={styles.introActions}>
          <ActionLink href={webPathnames.themes} tone="secondary">
            Browse all themes
          </ActionLink>
        </div>
      </section>

      <CatalogQuickFilterBar
        ariaLabel="Refine discover"
        items={quickFilterItems}
      />

      {!hasFilteredContent ? (
        <Surface as="section" className={styles.emptyState} tone="muted">
          <SectionHeading
            description="Try another quick filter or open a full theme lane to keep exploring the current public catalog."
            eyebrow="Discover"
            title={`No matches in ${activeQuickFilterOption?.label ?? 'this filter'}`}
            titleAs="h2"
          />
          <div className={styles.introActions}>
            <ActionLink
              href={buildWebPath(webPathnames.discover)}
              tone="secondary"
            >
              Show all sets
            </ActionLink>
          </div>
        </Surface>
      ) : null}

      {hasFilteredContent && filteredDealSetCards.length ? (
        <Surface as="section" className={styles.dealSection} tone="default">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="The clearest reviewed price gaps among the strongest flagship and click-magnet sets already in the catalog."
              eyebrow="Deals"
              title="Best deals to check first"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(filteredDealSetCards.length)}
            </p>
          </div>
          <CatalogSetCardRail
            ariaLabel="Best deals to check first"
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
              description="Sets where the cast is part of the appeal, from big franchise anchors to collector-friendly story moments."
              eyebrow="Characters"
              title="Iconic characters and cast favorites"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(filteredCharacterSetCards.length)}
            </p>
          </div>
          <CatalogSetCardRail
            ariaLabel="Iconic characters and cast favorites"
            items={filteredCharacterSetCards.map((characterSetCard) => ({
              href: buildSetDetailPath(characterSetCard.slug),
              id: characterSetCard.id,
              setSummary: characterSetCard,
              supportingNote: formatDiscoverFanContext(characterSetCard),
            }))}
            variant="browse"
          />
        </Surface>
      ) : null}

      {hasFilteredContent && filteredHighlightSetCards.length ? (
        <Surface as="section" className={styles.featuredSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="A tighter mix of premium flagships, iconic franchises, and more approachable sets worth opening before you go deeper."
              eyebrow="Highlights"
              title="Worth opening first"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(filteredHighlightSetCards.length)}
            </p>
          </div>
          <CatalogSetCardRail
            ariaLabel="Worth opening first"
            items={filteredHighlightSetCards.map((highlightSetCard) => ({
              href: buildSetDetailPath(highlightSetCard.slug),
              id: highlightSetCard.id,
              setSummary: highlightSetCard,
              supportingNote: formatDiscoverFanContext(highlightSetCard),
            }))}
            variant="browse"
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
                  <h2 className={styles.themeTitle}>{themeGroup.theme}</h2>
                  <ActionLink
                    className={styles.themeAction}
                    href={buildThemePath(themeGroup.slug)}
                    tone="secondary"
                  >
                    Open full theme
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
                    variant="browse"
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
