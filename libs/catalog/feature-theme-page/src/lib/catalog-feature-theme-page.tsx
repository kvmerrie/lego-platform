import type { CatalogThemeLandingPage } from '@lego-platform/catalog/data-access';
import {
  CatalogSectionHeader,
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
          <CatalogSectionHeader
            className={styles.sectionHeader}
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
            signal={`${dealSetCards.length} sets`}
            title={
              <>
                Goed moment om te kopen in{' '}
                <span className="notranslate" translate="no">
                  {themeSnapshot.name}
                </span>
              </>
            }
            titleAs="h2"
            tone="inverse"
          />
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
        <CatalogSectionHeader
          className={styles.sectionHeader}
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
          signal={`${setCards.length} sets`}
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
