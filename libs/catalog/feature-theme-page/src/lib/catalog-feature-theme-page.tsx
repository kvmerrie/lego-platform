import type { CSSProperties, ReactNode } from 'react';
import {
  CatalogPageIntro,
  CatalogBrowsePagination,
  CatalogSectionShell,
  CatalogSetCard,
  type CatalogSetCardCtaMode,
  CatalogSetCardCollection,
  CatalogSetCardRailSection,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import {
  type CatalogHomepageSetCard,
  type CatalogThemeVisual,
  type CatalogThemeLandingPage,
  getCatalogThemeMutedTextColor,
} from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildThemePath,
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

export interface CatalogFeatureThemePageSetCard extends CatalogHomepageSetCard {
  actions?: ReactNode;
  priceContext?: CatalogSetCardPriceContext;
}

export interface CatalogFeatureThemePageArticleLink {
  date?: string;
  description?: string;
  href: string;
  title: string;
}

function getThemeButtonSurfaceFromVisual(
  visual?: CatalogThemeVisual,
): 'dark' | 'light' {
  const normalizedTextColor = visual?.textColor?.trim().toLowerCase();

  return normalizedTextColor === '#ffffff' ||
    normalizedTextColor === '#fff' ||
    normalizedTextColor === 'white'
    ? 'dark'
    : 'light';
}

export function CatalogFeatureThemePage({
  currentPage = 1,
  dealSetCards = [],
  dealRail,
  pageSize,
  relatedArticles = [],
  relatedArticlesRail,
  themePage,
}: {
  currentPage?: number;
  dealSetCards?: readonly CatalogFeatureThemePageDealItem[];
  dealRail?: ReactNode;
  pageSize?: number;
  relatedArticles?: readonly CatalogFeatureThemePageArticleLink[];
  relatedArticlesRail?: ReactNode;
  themePage: Omit<CatalogThemeLandingPage, 'setCards'> & {
    setCards: readonly CatalogFeatureThemePageSetCard[];
  };
}) {
  const { setCards, themeSnapshot } = themePage;
  const themeName = themeSnapshot.name;
  const themeSignatureSet = themeSnapshot.signatureSet || themeName;
  const dealSectionId = 'theme-deals';
  const browseSectionId = 'theme-browse';
  const themeVisual = themePage.visual;
  const themeHeroButtonSurface = getThemeButtonSurfaceFromVisual(themeVisual);
  const normalizedCurrentPage = Math.max(1, Math.floor(currentPage));
  const normalizedPageSize =
    typeof pageSize === 'number' && pageSize > 0
      ? Math.max(1, Math.floor(pageSize))
      : setCards.length;
  const totalSetCount = Math.max(setCards.length, themeSnapshot.setCount);
  const pageCount = Math.max(1, Math.ceil(totalSetCount / normalizedPageSize));
  const isServerPaginated =
    totalSetCount > setCards.length && setCards.length <= normalizedPageSize;
  const visibleSetCards = isServerPaginated
    ? setCards
    : setCards.slice(
        (normalizedCurrentPage - 1) * normalizedPageSize,
        normalizedCurrentPage * normalizedPageSize,
      );
  const themePageHref = buildThemePath(themeSnapshot.slug);
  const themePageStyle =
    themeVisual?.backgroundColor || themeVisual?.textColor
      ? ({
          ...(themeVisual?.backgroundColor
            ? {
                '--theme-page-surface': themeVisual.backgroundColor,
              }
            : {}),
          ...(themeVisual?.textColor
            ? {
                '--theme-page-text': themeVisual.textColor,
                '--theme-page-muted': getCatalogThemeMutedTextColor(
                  themeVisual.textColor,
                ),
              }
            : {}),
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={styles.page}
      data-theme={themeSnapshot.slug}
      style={themePageStyle}
    >
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
          <p className={styles.introLead}>{themeSnapshot.momentum}</p>
        </div>
        {themeSnapshot.introSupport ? (
          <p className={styles.introSupport}>{themeSnapshot.introSupport}</p>
        ) : null}
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

      {dealRail ?? (
        <CatalogFeatureThemeDealRail
          dealSectionId={dealSectionId}
          dealSetCards={dealSetCards}
          themeName={themeName}
        />
      )}

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
          {visibleSetCards.map((setCard, index) => (
            <CatalogSetCard
              actions={setCard.actions}
              href={buildSetDetailPath(setCard.slug)}
              imageLoading={index < 6 ? 'eager' : 'lazy'}
              key={setCard.id}
              priceContext={setCard.priceContext}
              setSummary={setCard}
              showThemeBadge={false}
              variant="compact"
            />
          ))}
        </CatalogSetCardCollection>
        <CatalogBrowsePagination
          ariaLabel={`${themeName} sets pagina's`}
          basePath={themePageHref}
          currentPage={normalizedCurrentPage}
          pageCount={pageCount}
        />
      </CatalogSectionShell>
      {relatedArticlesRail ?? (
        <CatalogFeatureThemeRelatedArticles
          relatedArticles={relatedArticles}
          themeName={themeName}
        />
      )}
    </div>
  );
}

export function CatalogFeatureThemeDealRail({
  dealSectionId = 'theme-deals',
  dealSetCards,
  themeName,
}: {
  dealSectionId?: string;
  dealSetCards: readonly CatalogFeatureThemePageDealItem[];
  themeName: string;
}) {
  if (!dealSetCards.length) {
    return null;
  }

  return (
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
  );
}

export function CatalogFeatureThemeRelatedArticles({
  relatedArticles,
  themeName,
}: {
  relatedArticles: readonly CatalogFeatureThemePageArticleLink[];
  themeName: string;
}) {
  if (!relatedArticles.length) {
    return null;
  }

  return (
    <CatalogSectionShell
      as="section"
      bodySpacing="relaxed"
      className={styles.relatedArticlesSection}
      description={
        <>
          Lees verder over releases en koopmomenten binnen{' '}
          <span className="notranslate" translate="no">
            {themeName}
          </span>
          .
        </>
      }
      eyebrow="Verder lezen"
      padding="default"
      signal={`${relatedArticles.length} artikelen`}
      spacing="relaxed"
      title={
        <>
          Meer over{' '}
          <span className="notranslate" translate="no">
            {themeName}
          </span>
        </>
      }
      titleAs="h2"
      tone="muted"
    >
      <div className={styles.relatedArticleGrid}>
        {relatedArticles.map((article) => (
          <article className={styles.relatedArticleCard} key={article.href}>
            <a className={styles.relatedArticleLink} href={article.href}>
              {article.date ? (
                <time
                  className={styles.relatedArticleDate}
                  dateTime={article.date}
                >
                  {article.date}
                </time>
              ) : null}
              <h3 className={styles.relatedArticleTitle}>{article.title}</h3>
              {article.description ? (
                <p className={styles.relatedArticleDescription}>
                  {article.description}
                </p>
              ) : null}
            </a>
          </article>
        ))}
      </div>
    </CatalogSectionShell>
  );
}

export default CatalogFeatureThemePage;
