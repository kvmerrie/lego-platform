import { searchCatalogSetCards } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
import {
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { ActionLink, SectionHeading, Surface } from '@lego-platform/shared/ui';
import styles from './catalog-feature-search-results.module.css';

function readSearchQuery(query?: string): string {
  return query?.trim() ?? '';
}

export function CatalogFeatureSearchResults({ query }: { query?: string }) {
  const searchQuery = readSearchQuery(query);

  if (!searchQuery) {
    return (
      <Surface
        as="section"
        className={`${styles.resultsSection} ${styles.statePanel}`}
        tone="muted"
      >
        <SectionHeading
          description="Search by set name or set number to go straight to a set page."
          eyebrow="Search"
          title="Search sets"
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

  const searchResults = searchCatalogSetCards(searchQuery);

  if (!searchResults.length) {
    return (
      <Surface
        as="section"
        className={`${styles.resultsSection} ${styles.statePanel}`}
        tone="muted"
      >
        <SectionHeading
          description={`Nothing matched "${searchQuery}". Try another set name or set number.`}
          eyebrow="Search"
          title={`No results for "${searchQuery}"`}
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
          description={`Matching set pages for "${searchQuery}".`}
          eyebrow="Search"
          title={`Results for "${searchQuery}"`}
        />
        <p className={styles.resultsMeta}>
          {searchResults.length} matching set
          {searchResults.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className={styles.resultsGrid}>
        {searchResults.map((searchResult) => (
          <CatalogSetCard
            href={buildSetDetailPath(searchResult.slug)}
            key={searchResult.id}
            setSummary={searchResult}
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
      />
    </Surface>
  );
}

export default CatalogFeatureSearchResults;
