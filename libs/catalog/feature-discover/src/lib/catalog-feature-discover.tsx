import {
  listDiscoverCharacterSetCards,
  listCatalogSetSummaries,
  listCatalogThemes,
  listDiscoverBrowseThemeGroups,
  listDiscoverHighlightSetCards,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSetCard,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
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
  dealSetCards = [],
  reviewedSetIds = [],
}: {
  dealSetCards?: readonly CatalogFeatureDiscoverDealItem[];
  reviewedSetIds?: readonly string[];
}) {
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

      {dealSetCards.length ? (
        <Surface as="section" className={styles.dealSection} tone="default">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="The clearest reviewed price gaps among the strongest flagship and click-magnet sets already in the catalog."
              eyebrow="Deals"
              title="Best deals to check first"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(dealSetCards.length)}
            </p>
          </div>
          <div className={styles.dealGrid}>
            {dealSetCards.map((dealSetCard) => (
              <CatalogSetCard
                href={buildSetDetailPath(dealSetCard.slug)}
                key={dealSetCard.id}
                priceContext={dealSetCard.priceContext}
                setSummary={dealSetCard}
                supportingNote={formatDiscoverFanContext(dealSetCard)}
                variant="featured"
              />
            ))}
          </div>
        </Surface>
      ) : null}

      {characterSetCards.length ? (
        <Surface as="section" className={styles.featuredSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="Sets where the cast is part of the appeal, from big franchise anchors to collector-friendly story moments."
              eyebrow="Characters"
              title="Iconic characters and cast favorites"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(characterSetCards.length)}
            </p>
          </div>
          <div className={styles.featuredGrid}>
            {characterSetCards.map((characterSetCard) => (
              <CatalogSetCard
                href={buildSetDetailPath(characterSetCard.slug)}
                key={characterSetCard.id}
                setSummary={characterSetCard}
                supportingNote={formatDiscoverFanContext(characterSetCard)}
                variant="browse"
              />
            ))}
          </div>
        </Surface>
      ) : null}

      {highlightSetCards.length ? (
        <Surface as="section" className={styles.featuredSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="A tighter mix of premium flagships, iconic franchises, and more approachable sets worth opening before you go deeper."
              eyebrow="Highlights"
              title="Worth opening first"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(highlightSetCards.length)}
            </p>
          </div>
          <div className={styles.featuredGrid}>
            {highlightSetCards.map((highlightSetCard) => (
              <CatalogSetCard
                href={buildSetDetailPath(highlightSetCard.slug)}
                key={highlightSetCard.id}
                setSummary={highlightSetCard}
                supportingNote={formatDiscoverFanContext(highlightSetCard)}
                variant="browse"
              />
            ))}
          </div>
        </Surface>
      ) : null}

      <div className={styles.themeSections}>
        {themeGroups.map((themeGroup, index) => (
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
    </div>
  );
}

export default CatalogFeatureDiscover;
