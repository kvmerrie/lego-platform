import { listCatalogSearchMatches } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
import {
  buildSetDetailPath,
  buildWebPath,
  getDefaultFormattingLocale,
  webPathnames,
} from '@lego-platform/shared/config';
import { ActionLink, SectionHeading, Surface } from '@lego-platform/shared/ui';
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
}): string {
  const priceLabel = formatReviewedPrice({
    currencyCode,
    minorUnits: headlinePriceMinor,
  });

  if (typeof deltaMinor === 'number' && deltaMinor < 0) {
    return `Reviewed ${priceLabel} at ${merchantName} · ${formatReviewedPrice({
      currencyCode,
      minorUnits: Math.abs(deltaMinor),
    })} below reference`;
  }

  if (typeof deltaMinor === 'number' && deltaMinor > 0) {
    return `Reviewed ${priceLabel} at ${merchantName} · ${formatReviewedPrice({
      currencyCode,
      minorUnits: deltaMinor,
    })} above reference`;
  }

  return `Reviewed ${priceLabel} at ${merchantName}`;
}

function formatMinifigureHighlights(
  minifigureHighlights?: readonly string[],
): string | undefined {
  if (!minifigureHighlights?.length) {
    return undefined;
  }

  const visibleHighlights = minifigureHighlights.slice(0, 3);

  if (visibleHighlights.length === 1) {
    return `Includes ${visibleHighlights[0]}`;
  }

  if (visibleHighlights.length === 2) {
    return `Includes ${visibleHighlights[0]} and ${visibleHighlights[1]}`;
  }

  const lastVisibleHighlight = visibleHighlights.at(-1);
  const leadingHighlights = visibleHighlights.slice(0, -1);

  if (!lastVisibleHighlight) {
    return undefined;
  }

  return `Includes ${leadingHighlights.join(', ')}, and ${lastVisibleHighlight}`;
}

function getSearchResultSupportingNote(searchResult: {
  collectorAngle: string;
  minifigureHighlights?: readonly string[];
  priceContext?: CatalogFeatureSearchReviewedPriceContext;
  tagline: string;
}): string {
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
  query,
  reviewedPriceContexts = [],
}: {
  query?: string;
  reviewedPriceContexts?: readonly CatalogFeatureSearchReviewedPriceContext[];
}) {
  const searchQuery = readSearchQuery(query);
  const reviewedPriceContextBySetId = new Map(
    reviewedPriceContexts.map((reviewedPriceContext) => [
      reviewedPriceContext.setId,
      reviewedPriceContext,
    ]),
  );

  if (!searchQuery) {
    return (
      <Surface
        as="section"
        className={`${styles.resultsSection} ${styles.statePanel}`}
        tone="muted"
      >
        <SectionHeading
          description="Search by set name or set number to jump straight into reviewed prices, fan context, and set details."
          eyebrow="Search"
          title="Search sets"
          titleAs="h1"
        />
        <div className={styles.stateActions}>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Browse the catalog
          </ActionLink>
        </div>
      </Surface>
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

  if (!searchResults.length) {
    return (
      <Surface
        as="section"
        className={`${styles.resultsSection} ${styles.statePanel}`}
        tone="muted"
      >
        <SectionHeading
          description={`Nothing matched "${searchQuery}" yet. Try a set number like 75355 or a stronger set name.`}
          eyebrow="Search"
          title={`No results for "${searchQuery}"`}
          titleAs="h1"
        />
        <div className={styles.stateActions}>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Browse the catalog
          </ActionLink>
        </div>
      </Surface>
    );
  }

  return (
    <section className={styles.resultsSection}>
      <div className={styles.resultsHeader}>
        <SectionHeading
          description={`Best text matches for "${searchQuery}", with reviewed pricing and collector context used to break ties when matches are otherwise close.`}
          eyebrow="Search"
          title={`Results for "${searchQuery}"`}
          titleAs="h1"
        />
        <p className={styles.resultsMeta}>
          {searchResults.length} matching set
          {searchResults.length === 1 ? '' : 's'}
          {reviewedResultCount
            ? ` · ${reviewedResultCount} with reviewed pricing`
            : ''}
        </p>
      </div>
      <div className={styles.resultsGrid}>
        {searchResults.map((searchResult) => (
          <CatalogSetCard
            href={buildSetDetailPath(searchResult.slug)}
            key={searchResult.id}
            setSummary={searchResult}
            supportingNote={getSearchResultSupportingNote(searchResult)}
            variant="browse"
          />
        ))}
      </div>
    </section>
  );
}

export function CatalogFeatureSearchResultsLoading() {
  return (
    <Surface
      as="section"
      className={`${styles.resultsSection} ${styles.statePanel}`}
      tone="muted"
    >
      <SectionHeading
        description="Looking through the current set catalog."
        eyebrow="Search"
        title="Searching sets"
        titleAs="h1"
      />
    </Surface>
  );
}

export default CatalogFeatureSearchResults;
