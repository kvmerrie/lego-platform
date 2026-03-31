import {
  listCatalogBrowseThemeGroups,
  listHomepageSetCards,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSetCard,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { SectionHeading, Surface } from '@lego-platform/shared/ui';
import styles from './catalog-feature-discover.module.css';

function formatThemeCount(count: number): string {
  return `${count} theme${count === 1 ? '' : 's'}`;
}

function formatSetCount(count: number): string {
  return `${count} set${count === 1 ? '' : 's'}`;
}

export interface CatalogFeatureDiscoverDealItem extends CatalogHomepageSetCard {
  priceContext?: CatalogSetCardPriceContext;
}

export function CatalogFeatureDiscover({
  dealSetCards = [],
}: {
  dealSetCards?: readonly CatalogFeatureDiscoverDealItem[];
}) {
  const featuredSetCards = listHomepageSetCards();
  const themeGroups = listCatalogBrowseThemeGroups();
  const totalSetCount = themeGroups.reduce(
    (count, themeGroup) => count + themeGroup.setCards.length,
    0,
  );

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
          description="Browse the public catalog by theme, with the strongest flagship, franchise, and crossover sets surfaced first in each lane."
          eyebrow="Discover"
          title="Browse the catalog by theme"
        />
        <p className={styles.introMeta}>
          {totalSetCount} sets · {formatThemeCount(themeGroups.length)}
        </p>
      </section>

      {featuredSetCards.length ? (
        <Surface as="section" className={styles.featuredSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="A compact mix of premium flagships, recognizable icons, and easier ways into the catalog."
              eyebrow="Featured"
              title="Start with the sets people open first"
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>
              {formatSetCount(featuredSetCards.length)}
            </p>
          </div>
          <div className={styles.featuredGrid}>
            {featuredSetCards.map((featuredSetCard) => (
              <CatalogSetCard
                href={buildSetDetailPath(featuredSetCard.slug)}
                key={featuredSetCard.id}
                setSummary={featuredSetCard}
                variant="featured"
              />
            ))}
          </div>
        </Surface>
      ) : null}

      {dealSetCards.length ? (
        <Surface as="section" className={styles.dealSection} tone="default">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description="The clearest current price gaps among the biggest flagships and recognizable sets already in the catalog."
              eyebrow="Deals"
              title="Good time to buy"
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
                variant="featured"
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
              </div>
              <p className={styles.sectionMeta}>
                {formatSetCount(themeGroup.setCards.length)}
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
