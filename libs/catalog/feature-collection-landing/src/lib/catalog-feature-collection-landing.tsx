import type { CSSProperties, ReactNode } from 'react';
import {
  CatalogBrowsePagination,
  CatalogHeroMedia,
  CatalogPageIntro,
  CatalogSectionShell,
  CatalogSetCard,
  CatalogSetCardCollection,
  type CatalogSetCardPriceContext,
  getHeroButtonSurface,
  getHeroButtonTone,
} from '@lego-platform/catalog/ui';
import {
  type CatalogCollectionLandingPageConfig,
  type CatalogCollectionLandingPageSortKey,
  type CatalogHomepageSetCard,
} from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { ActionLink } from '@lego-platform/shared/ui';
import { getAccessibleForegroundColor } from '@lego-platform/shared/util';
import styles from './catalog-feature-collection-landing.module.css';

export interface CatalogCollectionLandingPageLink {
  href: string;
  label: string;
}

export interface CatalogCollectionLandingPageItem
  extends CatalogHomepageSetCard {
  actions?: ReactNode;
  priceContext?: CatalogSetCardPriceContext;
}

const sortLabels: Record<CatalogCollectionLandingPageSortKey, string> = {
  recommended: 'Aanraders',
  'price-asc': 'Laagste prijs',
  newest: 'Nieuwste',
  'pieces-desc': 'Meeste stenen',
};

function getCollectionLandingPageSortHref({
  config,
  sortKey,
}: {
  config: CatalogCollectionLandingPageConfig;
  sortKey: CatalogCollectionLandingPageSortKey;
}): string {
  const searchParams = new URLSearchParams();

  if (sortKey !== config.sort.default) {
    searchParams.set('sort', sortKey);
  }

  const queryString = searchParams.toString();

  return queryString
    ? `${config.canonicalPath}?${queryString}`
    : config.canonicalPath;
}

function renderLinkList({
  links,
}: {
  links: readonly CatalogCollectionLandingPageLink[];
}): ReactNode {
  return (
    <ul className={styles.linkList}>
      {links.map((link) => (
        <li className={styles.linkItem} key={link.href}>
          <a className={styles.textLink} href={link.href}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function CatalogFeatureCollectionLandingPage({
  activeSortKey,
  config,
  currentPage = 1,
  pageSize,
  relatedPageLinks = [],
  setCards,
  themeLinks = [],
  totalSetCount,
}: {
  activeSortKey: CatalogCollectionLandingPageSortKey;
  config: CatalogCollectionLandingPageConfig;
  currentPage?: number;
  pageSize?: number;
  relatedPageLinks?: readonly CatalogCollectionLandingPageLink[];
  setCards: readonly CatalogCollectionLandingPageItem[];
  themeLinks?: readonly CatalogCollectionLandingPageLink[];
  totalSetCount: number;
}) {
  const browseSectionId = 'sets';
  const hasSortOptions = config.sort.options.length > 1;
  const heroButtonTone = getHeroButtonTone(config.visual);
  const heroButtonSurface = getHeroButtonSurface(config.visual);
  const introTextColor = getAccessibleForegroundColor(
    config.visual?.backgroundColor,
  );
  const introStyle = {
    ...(config.visual?.backgroundColor
      ? {
          '--collection-page-surface': config.visual.backgroundColor,
        }
      : {}),
    ...(introTextColor
      ? {
          '--collection-page-muted': introTextColor,
          '--collection-page-text': introTextColor,
        }
      : {}),
  } as CSSProperties;
  const normalizedCurrentPage = Math.max(1, Math.floor(currentPage));
  const normalizedPageSize =
    typeof pageSize === 'number' && pageSize > 0
      ? Math.max(1, Math.floor(pageSize))
      : setCards.length;
  const pageCount =
    normalizedPageSize > 0
      ? Math.max(1, Math.ceil(totalSetCount / normalizedPageSize))
      : 1;

  return (
    <main className={styles.page}>
      <CatalogPageIntro
        as="header"
        breadcrumbs={{
          ariaLabel: 'Paginapad',
          className: styles.introBreadcrumbs,
          items: [
            {
              href: buildWebPath(webPathnames.home),
              id: 'home',
              label: 'Brickhunt',
            },
            {
              id: 'collection',
              label: config.h1,
            },
          ],
        }}
        className={styles.intro}
        contentClassName={styles.introContent}
        heroButtonTone={heroButtonTone}
        style={introStyle}
      >
        <div className={styles.introLayout}>
          <div className={styles.introCopy}>
            <div className={styles.headingGroup}>
              <h1 className={styles.title}>{config.h1}</h1>
              <p className={styles.lead}>{config.intro}</p>
            </div>
            <p className={styles.support}>{config.description}</p>
            <div className={styles.actions}>
              <ActionLink
                href={`#${browseSectionId}`}
                size="hero"
                surface={heroButtonSurface}
                tone="accent"
              >
                Bekijk de sets
              </ActionLink>
              {themeLinks[0] ? (
                <ActionLink
                  href={themeLinks[0].href}
                  size="hero"
                  surface={heroButtonSurface}
                  tone="secondary"
                >
                  Naar {themeLinks[0].label}
                </ActionLink>
              ) : null}
            </div>
          </div>
          {config.visual?.imageUrl ? (
            <CatalogHeroMedia
              alt=""
              className={styles.introVisual}
              decoding="async"
              height={420}
              loading="eager"
              src={config.visual.imageUrl}
              width={560}
            />
          ) : null}
        </div>
      </CatalogPageIntro>

      <CatalogSectionShell
        as="section"
        bodySpacing="relaxed"
        className={styles.browseSection}
        description={`${setCards.length} producten worden weergegeven`}
        id={browseSectionId}
        padding="default"
        spacing="relaxed"
        title={config.browseTitle}
        titleAs="h2"
        tone="default"
        utility={
          hasSortOptions ? (
            <nav aria-label="Sorteer sets" className={styles.sortNav}>
              {config.sort.options.map((sortKey) => (
                <a
                  aria-current={sortKey === activeSortKey ? 'true' : undefined}
                  className={styles.sortLink}
                  href={getCollectionLandingPageSortHref({ config, sortKey })}
                  key={sortKey}
                >
                  {sortLabels[sortKey]}
                </a>
              ))}
            </nav>
          ) : undefined
        }
        utilityPlacement="below-heading"
      >
        {setCards.length ? (
          <>
            <CatalogSetCardCollection
              className={styles.grid}
              gridMode="browse"
              variant="compact"
            >
              {setCards.map((setCard, index) => (
                <CatalogSetCard
                  actions={setCard.actions}
                  href={buildSetDetailPath(setCard.slug)}
                  imageLoading={index < 6 ? 'eager' : 'lazy'}
                  key={setCard.id}
                  priceContext={setCard.priceContext}
                  setSummary={setCard}
                  variant="compact"
                />
              ))}
            </CatalogSetCardCollection>
            <CatalogBrowsePagination
              ariaLabel={`${config.h1} pagina's`}
              basePath={config.canonicalPath}
              currentPage={normalizedCurrentPage}
              pageCount={pageCount}
              queryParams={
                activeSortKey !== config.sort.default
                  ? { sort: activeSortKey }
                  : undefined
              }
            />
            {config.coverageNote && totalSetCount < normalizedPageSize ? (
              <p className={styles.coverageNote}>{config.coverageNote}</p>
            ) : null}
          </>
        ) : (
          <p className={styles.emptyState}>
            Deze collectie wacht nog op genoeg betrouwbare catalogusdata.
          </p>
        )}
      </CatalogSectionShell>

      {themeLinks.length || relatedPageLinks.length ? (
        <section className={styles.linkSection} aria-label="Verder ontdekken">
          {themeLinks.length ? (
            <div className={styles.linkGroup}>
              <h2 className={styles.linkTitle}>Kijk ook in deze thema’s</h2>
              {renderLinkList({ links: themeLinks })}
            </div>
          ) : null}
          {relatedPageLinks.length ? (
            <div className={styles.linkGroup}>
              <h2 className={styles.linkTitle}>Meer keuzes</h2>
              {renderLinkList({ links: relatedPageLinks })}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
