import type { ReactNode } from 'react';
import type { CatalogThemeLandingPage } from '@lego-platform/catalog/data-access';
import {
  CatalogPageIntro,
  CatalogSectionShell,
  CatalogSetCard,
  type CatalogSetCardCtaMode,
  CatalogSetCardCollection,
  CatalogSetCardRailSection,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { ActionLink } from '@lego-platform/shared/ui';
import styles from './catalog-feature-theme-page.module.css';

export interface CatalogFeatureThemePageDealItem
  extends CatalogHomepageSetCard {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  priceContext?: CatalogSetCardPriceContext;
}

const themeHeroSurfaceBySlug: Record<string, 'dark' | 'light'> = {
  art: 'dark',
  botanicals: 'dark',
  disney: 'dark',
  'harry-potter': 'dark',
  'jurassic-world': 'dark',
  marvel: 'dark',
  ninjago: 'dark',
  'star-wars': 'dark',
};

const themeEditorialIntroByName: Record<string, string> = {
  Icons: 'Voor grote displaysets die je collectie meteen meer statuur geven.',
  Ideas:
    'Voor sets die voelen als een hele scene of wereld, niet als een standaard lijn.',
  Marvel:
    'Voor torens, hoofdkwartieren en minifig-casts die meteen herkenning op je plank zetten.',
  'Star Wars':
    'Voor ships, walkers en grote silhouetten waar schaal en displaywaarde het verschil maken.',
  'Harry Potter':
    'Voor Hogwarts-hoeken, Gringotts en sets waar sfeer net zo belangrijk is als stenen.',
  Technic:
    'Voor supercars en machines waar de bouw net zo boeiend is als het eindresultaat.',
  Botanicals:
    'Voor boeketten en planten die kleur geven zonder dat het als speelgoed voelt.',
  'Modular Buildings':
    'Voor straatbouwers die gevels, etalages en interieurs naast elkaar willen laten werken.',
  'Super Mario':
    'Voor Nintendo-herkenning die als displaystuk werkt en niet alleen als gimmick.',
  NINJAGO:
    'Voor stadssets vol kleur, hoogte en details waar je steeds iets nieuws in ziet.',
  'Jurassic World':
    'Voor dinoscenes waar chaos, voertuigen en displaywaarde samenkomen.',
  Architecture:
    'Voor strakke landmarks die rust, schaal en herkenning op één plank brengen.',
  Art: 'Voor reliëf, kleur en sets die meer kunstwerk dan klassieke bouwset voelen.',
  Disney:
    'Voor kastelen en blikvangers die meteen sprookjessfeer in je collectie zetten.',
};

export function CatalogFeatureThemePage({
  dealSetCards = [],
  themePage,
}: {
  dealSetCards?: readonly CatalogFeatureThemePageDealItem[];
  themePage: CatalogThemeLandingPage;
}) {
  const { setCards, themeSnapshot } = themePage;
  const themeName = themeSnapshot.name;
  const themeSignatureSet = themeSnapshot.signatureSet;
  const dealSectionId = 'theme-deals';
  const browseSectionId = 'theme-browse';
  const themeHeroButtonSurface =
    themeHeroSurfaceBySlug[themeSnapshot.slug] ?? 'light';

  return (
    <div className={styles.page} data-theme={themeSnapshot.slug}>
      <CatalogPageIntro
        breadcrumbs={{
          ariaLabel: 'Themacontext',
          className: styles.introBreadcrumbs,
          items: [
            {
              href: buildWebPath(webPathnames.themes),
              id: 'theme-directory',
              label: "Thema's",
            },
            {
              id: 'theme-detail',
              label: (
                <span className="notranslate" translate="no">
                  {themeName}
                </span>
              ),
            },
          ],
        }}
        className={styles.intro}
        contentClassName={styles.introContent}
        data-button-surface={themeHeroButtonSurface}
      >
        <p className={styles.introEyebrow} data-page-intro-eyebrow="true">
          Thema
        </p>
        <div className={styles.introHeading}>
          <h1 className={styles.introTitle}>
            <span className="notranslate" translate="no">
              {themeName}
            </span>
          </h1>
          <p className={styles.introLead}>
            {themeEditorialIntroByName[themeName] ??
              'Voor sets die je binnen één lijn rustig naast elkaar wilt vergelijken.'}
          </p>
        </div>
        <p className={styles.introSupport}>
          Begin met{' '}
          <span className="notranslate" translate="no">
            {themeSignatureSet}
          </span>{' '}
          als je meteen wilt zien waar{' '}
          <span className="notranslate" translate="no">
            {themeName}
          </span>{' '}
          goed in is.
        </p>
        <div className={styles.introActions}>
          <ActionLink
            className={styles.introPrimaryAction}
            href={`#${browseSectionId}`}
            size="hero"
            surface={themeHeroButtonSurface}
            tone="accent"
          >
            <span className={styles.introPrimaryLabel}>
              Bekijk alle{' '}
              <span className="notranslate" translate="no">
                {themeName}
              </span>{' '}
              sets
            </span>
          </ActionLink>
          {dealSetCards.length ? (
            <ActionLink
              className={styles.introSecondaryAction}
              href={`#${dealSectionId}`}
              size="hero"
              surface={themeHeroButtonSurface}
              tone="secondary"
            >
              Bekijk beste deals
            </ActionLink>
          ) : null}
        </div>
      </CatalogPageIntro>

      {dealSetCards.length ? (
        <CatalogSetCardRailSection
          as="section"
          ariaLabel={`Hier wil je nu als eerste kijken in ${themeName}`}
          bodySpacing="relaxed"
          className={styles.dealSection}
          id={dealSectionId}
          description={
            <>
              Deze{' '}
              <span className="notranslate" translate="no">
                {themeName}
              </span>
              -sets zitten nu onder wat we meestal zien. Begin hier als je niet
              alles wilt openen.
            </>
          }
          eyebrow="Nu interessant"
          items={dealSetCards.map((dealSetCard) => ({
            actions: dealSetCard.actions,
            ctaMode: dealSetCard.ctaMode,
            href: buildSetDetailPath(dealSetCard.slug),
            id: dealSetCard.id,
            priceContext: dealSetCard.priceContext,
            setSummary: dealSetCard,
            showThemeBadge: false,
          }))}
          padding="default"
          signal={`${dealSetCards.length} sets`}
          spacing="relaxed"
          title={
            <>
              Hier wil je nu als eerste kijken in{' '}
              <span className="notranslate" translate="no">
                {themeName}
              </span>
            </>
          }
          titleAs="h2"
          tone="inverse"
          variant="featured"
        />
      ) : null}

      <CatalogSectionShell
        as="section"
        bodySpacing="relaxed"
        className={styles.browseSection}
        id={browseSectionId}
        description={
          <>
            Van{' '}
            <span className="notranslate" translate="no">
              {themeSignatureSet}
            </span>{' '}
            tot de rest van{' '}
            <span className="notranslate" translate="no">
              {themeName}
            </span>
            . Vergelijk hier welke set het best op je plank past.
          </>
        }
        eyebrow="Kies je set"
        padding="default"
        signal={`${setCards.length} sets`}
        spacing="relaxed"
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
        tone="default"
      >
        <CatalogSetCardCollection
          className={styles.browseGrid}
          gridMode="browse"
          variant="compact"
        >
          {setCards.map((setCard) => (
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
    </div>
  );
}

export default CatalogFeatureThemePage;
