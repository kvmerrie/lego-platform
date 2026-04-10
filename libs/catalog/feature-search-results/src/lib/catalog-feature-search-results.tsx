import type { ReactNode } from 'react';
import { listCatalogSearchMatches } from '@lego-platform/catalog/data-access';
import {
  CatalogQuickFilterBar,
  CatalogSectionShell,
  CatalogSetCard,
  CatalogSetCardCollection,
} from '@lego-platform/catalog/ui';
import {
  type CatalogQuickFilterKey,
  listCatalogQuickFilterOptions,
  matchesCatalogQuickFilter,
  normalizeCatalogQuickFilterKey,
} from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildWebPath,
  getDefaultFormattingLocale,
  webPathnames,
} from '@lego-platform/shared/config';
import { ActionLink } from '@lego-platform/shared/ui';
import styles from './catalog-feature-search-results.module.css';

function readSearchQuery(query?: string): string {
  return query?.trim() ?? '';
}

export interface CatalogFeatureSearchReviewedPriceContext {
  currencyCode: string;
  deltaMinor?: number;
  headlinePriceMinor: number;
  merchantName: string;
  setId: string;
}

function formatReviewedPrice({
  currencyCode,
  minorUnits,
}: {
  currencyCode: string;
  minorUnits: number;
}): string {
  return new Intl.NumberFormat(getDefaultFormattingLocale(), {
    currency: currencyCode,
    style: 'currency',
  }).format(minorUnits / 100);
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

function buildSearchFilterHref({
  filter,
  query,
}: {
  filter: CatalogQuickFilterKey;
  query: string;
}): string {
  const searchParams = new URLSearchParams({
    q: query,
  });

  if (filter !== 'all') {
    searchParams.set('filter', filter);
  }

  return `${buildWebPath(webPathnames.search)}?${searchParams.toString()}`;
}

function formatSearchPriceContext({
  currencyCode,
  deltaMinor,
  headlinePriceMinor,
  merchantName,
}: {
  currencyCode: string;
  deltaMinor?: number;
  headlinePriceMinor: number;
  merchantName: string;
}): ReactNode {
  const priceLabel = formatReviewedPrice({
    currencyCode,
    minorUnits: headlinePriceMinor,
  });

  if (typeof deltaMinor === 'number' && deltaMinor < 0) {
    return `Reviewed prijs ${priceLabel} bij ${merchantName} · ${formatReviewedPrice(
      {
        currencyCode,
        minorUnits: Math.abs(deltaMinor),
      },
    )} onder de referentie`;
  }

  if (typeof deltaMinor === 'number' && deltaMinor > 0) {
    return `Reviewed prijs ${priceLabel} bij ${merchantName} · ${formatReviewedPrice(
      {
        currencyCode,
        minorUnits: deltaMinor,
      },
    )} boven de referentie`;
  }

  return `Reviewed prijs ${priceLabel} bij ${merchantName}`;
}

function formatMinifigureHighlights(
  minifigureHighlights?: readonly string[],
): ReactNode | undefined {
  if (!minifigureHighlights?.length) {
    return undefined;
  }

  const visibleHighlights = minifigureHighlights.slice(0, 3);
  return <>Met {renderCanonicalNames(visibleHighlights)}</>;
}

function getSearchResultSupportingNote(searchResult: {
  collectorAngle: string;
  minifigureHighlights?: readonly string[];
  priceContext?: CatalogFeatureSearchReviewedPriceContext;
  tagline: string;
}): ReactNode {
  if (searchResult.priceContext) {
    return formatSearchPriceContext(searchResult.priceContext);
  }

  return (
    formatMinifigureHighlights(searchResult.minifigureHighlights) ??
    searchResult.collectorAngle ??
    searchResult.tagline
  );
}

export function CatalogFeatureSearchResults({
  activeFilter,
  query,
  reviewedPriceContexts = [],
  searchEntry,
}: {
  activeFilter?: string;
  query?: string;
  reviewedPriceContexts?: readonly CatalogFeatureSearchReviewedPriceContext[];
  searchEntry?: ReactNode;
}) {
  const searchQuery = readSearchQuery(query);
  const normalizedFilter = normalizeCatalogQuickFilterKey(activeFilter);
  const reviewedPriceContextBySetId = new Map(
    reviewedPriceContexts.map((reviewedPriceContext) => [
      reviewedPriceContext.setId,
      reviewedPriceContext,
    ]),
  );
  const strongDealSetIds = reviewedPriceContexts.flatMap(
    (reviewedPriceContext) =>
      typeof reviewedPriceContext.deltaMinor === 'number' &&
      reviewedPriceContext.deltaMinor < 0
        ? [reviewedPriceContext.setId]
        : [],
  );

  if (!searchQuery) {
    return (
      <CatalogSectionShell
        as="section"
        className={styles.statePanel}
        description="Zoek op setnaam, personage of setnummer om direct naar reviewed prijzen, fancontext en setdetails te springen."
        eyebrow="Zoeken"
        padding="default"
        title="Zoek sets"
        titleAs="h1"
        tone="muted"
      >
        {searchEntry ? (
          <div className={styles.searchEntry}>{searchEntry}</div>
        ) : null}
        <div className={styles.stateActions}>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Bekijk de catalogus
          </ActionLink>
        </div>
      </CatalogSectionShell>
    );
  }

  const searchResults = listCatalogSearchMatches(
    searchQuery,
    Number.MAX_SAFE_INTEGER,
  )
    .map((searchMatch) => ({
      ...searchMatch,
      priceContext: reviewedPriceContextBySetId.get(searchMatch.setCard.id),
    }))
    .sort(
      (left, right) =>
        left.score - right.score ||
        (left.priceContext ? 0 : 1) - (right.priceContext ? 0 : 1) ||
        ((left.priceContext?.deltaMinor ?? Number.MAX_SAFE_INTEGER) < 0
          ? 0
          : 1) -
          ((right.priceContext?.deltaMinor ?? Number.MAX_SAFE_INTEGER) < 0
            ? 0
            : 1) ||
        (left.setCard.minifigureHighlights?.length ? 0 : 1) -
          (right.setCard.minifigureHighlights?.length ? 0 : 1) ||
        left.discoverRank - right.discoverRank ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        left.setCard.name.localeCompare(right.setCard.name),
    )
    .map((searchMatch) => ({
      ...searchMatch.setCard,
      priceContext: searchMatch.priceContext,
    }));
  const reviewedResultCount = searchResults.filter(
    (searchResult) => searchResult.priceContext,
  ).length;
  const filteredSearchResults = searchResults.filter((searchResult) =>
    matchesCatalogQuickFilter({
      filter: normalizedFilter,
      setCard: searchResult,
      strongDealSetIds,
    }),
  );
  const activeQuickFilterOption = listCatalogQuickFilterOptions().find(
    (catalogQuickFilterOption) =>
      catalogQuickFilterOption.key === normalizedFilter,
  );
  const quickFilterItems = listCatalogQuickFilterOptions().map(
    (catalogQuickFilterOption) => ({
      href: buildSearchFilterHref({
        filter: catalogQuickFilterOption.key,
        query: searchQuery,
      }),
      isActive: catalogQuickFilterOption.key === normalizedFilter,
      label: catalogQuickFilterOption.label,
    }),
  );

  if (!searchResults.length) {
    return (
      <CatalogSectionShell
        as="section"
        className={styles.statePanel}
        description={`Nog niets gevonden voor "${searchQuery}". Probeer een setnummer zoals 75355 of een sterkere setnaam.`}
        eyebrow="Zoeken"
        padding="default"
        title={`Geen resultaten voor "${searchQuery}"`}
        titleAs="h1"
        tone="muted"
      >
        <div className={styles.stateActions}>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Bekijk de catalogus
          </ActionLink>
        </div>
      </CatalogSectionShell>
    );
  }

  return (
    <CatalogSectionShell
      as="section"
      bodyClassName={styles.resultsBody}
      className={styles.resultsSection}
      description={`Beste teksttreffers voor "${searchQuery}", waarbij reviewed prijscontext en verzamelcontext worden gebruikt om kleine verschillen tussen resultaten te beslissen.`}
      eyebrow="Zoeken"
      padding="none"
      signal={`${filteredSearchResults.length} passende set${
        filteredSearchResults.length === 1 ? '' : 's'
      }${
        normalizedFilter !== 'all'
          ? ` · ${activeQuickFilterOption?.label ?? 'Gefilterd'}`
          : reviewedResultCount
            ? ` · ${reviewedResultCount} met reviewed prijzen`
            : ''
      }`}
      spacing="default"
      title={`Resultaten voor "${searchQuery}"`}
      titleAs="h1"
      tone="plain"
    >
      <CatalogQuickFilterBar
        ariaLabel="Verfijn zoekresultaten"
        items={quickFilterItems}
      />
      {filteredSearchResults.length ? (
        <CatalogSetCardCollection
          className={styles.resultsGrid}
          variant="compact"
        >
          {filteredSearchResults.map((searchResult) => (
            <CatalogSetCard
              href={buildSetDetailPath(searchResult.slug)}
              key={searchResult.id}
              setSummary={searchResult}
              supportingNote={getSearchResultSupportingNote(searchResult)}
              variant="compact"
            />
          ))}
        </CatalogSetCardCollection>
      ) : (
        <CatalogSectionShell
          as="section"
          className={styles.statePanel}
          description={`"${searchQuery}" heeft wel treffers, maar niets in ${(
            activeQuickFilterOption?.label ?? 'deze filter'
          ).toLowerCase()}. Probeer een andere filter of maak je zoekopdracht breder.`}
          eyebrow="Zoeken"
          padding="default"
          title={`Geen ${(
            activeQuickFilterOption?.label ?? 'gefilterde'
          ).toLowerCase()} treffers`}
          titleAs="h2"
          tone="muted"
        >
          <div className={styles.stateActions}>
            <ActionLink
              href={buildSearchFilterHref({
                filter: 'all',
                query: searchQuery,
              })}
              tone="secondary"
            >
              Toon alle treffers
            </ActionLink>
          </div>
        </CatalogSectionShell>
      )}
    </CatalogSectionShell>
  );
}

export function CatalogFeatureSearchResultsLoading() {
  return (
    <CatalogSectionShell
      as="section"
      className={styles.statePanel}
      description="De huidige setcatalogus wordt doorzocht."
      eyebrow="Zoeken"
      padding="default"
      title="Sets worden gezocht"
      titleAs="h1"
      tone="muted"
    />
  );
}

export default CatalogFeatureSearchResults;
