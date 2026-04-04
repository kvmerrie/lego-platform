import type { CatalogThemeLandingPage } from '@lego-platform/catalog/data-access';
import {
  CatalogSetCard,
  CatalogSetCardRail,
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
    <div className={styles.page} data-theme={themeSnapshot.slug}>
      <section className={styles.intro}>
        <SectionHeading
          description={themeSnapshot.momentum}
          eyebrow="Thema"
          title={
            <span className="notranslate" translate="no">
              {themeSnapshot.name}
            </span>
          }
          titleAs="h1"
          tone="display"
        />
        <p className={styles.introMeta}>
          {themeSnapshot.setCount} sets · Begin met{' '}
          <span className="notranslate" translate="no">
            {themeSnapshot.signatureSet}
          </span>
        </p>
      </section>

      {dealSetCards.length ? (
        <Surface as="section" className={styles.dealSection} tone="muted">
          <div className={styles.sectionHeader}>
            <SectionHeading
              description={
                <>
                  Reviewed prijsverschillen die nu het meest opvallen binnen de{' '}
                  <span className="notranslate" translate="no">
                    {themeSnapshot.name}
                  </span>
                  -lijn.
                </>
              }
              eyebrow="Deals"
              title={
                <>
                  Goed moment om te kopen in{' '}
                  <span className="notranslate" translate="no">
                    {themeSnapshot.name}
                  </span>
                </>
              }
              titleAs="h2"
            />
            <p className={styles.sectionMeta}>{dealSetCards.length} sets</p>
          </div>
          <CatalogSetCardRail
            ariaLabel={`Goed moment om te kopen in ${themeSnapshot.name}`}
            items={dealSetCards.map((dealSetCard) => ({
              href: buildSetDetailPath(dealSetCard.slug),
              id: dealSetCard.id,
              priceContext: dealSetCard.priceContext,
              setSummary: dealSetCard,
            }))}
            variant="featured"
          />
        </Surface>
      ) : null}

      <Surface as="section" className={styles.browseSection} tone="default">
        <div className={styles.sectionHeader}>
          <SectionHeading
            description={
              <>
                Blader door elke publieke{' '}
                <span className="notranslate" translate="no">
                  {themeSnapshot.name}
                </span>
                -set die nu in de catalogus staat.
              </>
            }
            eyebrow="Catalogus"
            title={
              <>
                Alle{' '}
                <span className="notranslate" translate="no">
                  {themeSnapshot.name}
                </span>
                -sets
              </>
            }
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
              variant="compact"
            />
          ))}
        </div>
      </Surface>
    </div>
  );
}

export default CatalogFeatureThemePage;
