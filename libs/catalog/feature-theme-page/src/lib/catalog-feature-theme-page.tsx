import type { CatalogThemeLandingPage } from '@lego-platform/catalog/data-access';
import {
  CatalogSetCard,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { SectionHeading, Surface } from '@lego-platform/shared/ui';
import styles from './catalog-feature-theme-page.module.css';

export interface CatalogFeatureThemePageDealItem
  extends CatalogHomepageSetCard {
  priceContext?: CatalogSetCardPriceContext;
}

export function CatalogFeatureThemePage({
  dealSetCards = [],
  themePage,
}: {
  dealSetCards?: readonly CatalogFeatureThemePageDealItem[];
  themePage: CatalogThemeLandingPage;
}) {
  const { setCards, themeSnapshot } = themePage;

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <SectionHeading
          description={themeSnapshot.momentum}
          eyebrow="Theme"
          title={themeSnapshot.name}
          titleAs="h1"
          tone="hero"
        />
        <p className={styles.introMeta}>
          {themeSnapshot.setCount} sets · Start with{' '}
          {themeSnapshot.signatureSet}
        </p>
      </section>

      {dealSetCards.length ? (
        <Surface as="section" className={styles.dealSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description={`Reviewed price gaps currently standing out inside the ${themeSnapshot.name} lane.`}
              eyebrow="Deals"
              title={`Good time to buy in ${themeSnapshot.name}`}
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>{dealSetCards.length} sets</p>
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

      <Surface as="section" className={styles.browseSection} tone="default">
        <div className={styles.sectionHeader}>
          <SectionHeading
            description={`Browse every public ${themeSnapshot.name} set currently in the catalog.`}
            eyebrow="Catalog"
            title={`All ${themeSnapshot.name} sets`}
            titleAs="h2"
          />
          <p className={styles.sectionMeta}>{setCards.length} sets</p>
        </div>
        <div className={styles.browseGrid}>
          {setCards.map((setCard) => (
            <CatalogSetCard
              href={buildSetDetailPath(setCard.slug)}
              key={setCard.id}
              setSummary={setCard}
              variant="browse"
            />
          ))}
        </div>
      </Surface>
    </div>
  );
}

export default CatalogFeatureThemePage;
