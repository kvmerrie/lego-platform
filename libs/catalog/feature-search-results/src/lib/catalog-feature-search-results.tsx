import { searchCatalogSetCards } from '@lego-platform/catalog/data-access';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
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
          description="Search by set name or set number to jump straight into the catalog."
          eyebrow="Search"
          title="Search the catalog"
        />
        <div className={styles.stateActions}>
          <ActionLink href="/#featured-sets" tone="secondary">
            Browse featured sets
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
          description={`No curated sets matched "${searchQuery}" yet. Try a set name or number.`}
          eyebrow="Search"
          title={`No results for "${searchQuery}"`}
        />
        <div className={styles.stateActions}>
          <ActionLink href="/#featured-sets" tone="secondary">
            Browse featured sets
          </ActionLink>
        </div>
      </Surface>
    );
  }

  return (
    <section className={styles.resultsSection}>
      <div className={styles.resultsHeader}>
        <SectionHeading
          description={`Showing curated matches for "${searchQuery}".`}
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
            href={`/sets/${searchResult.slug}`}
            key={searchResult.id}
            setSummary={searchResult}
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
        description="Searching the current curated catalog."
        eyebrow="Search"
        title="Searching sets"
      />
    </Surface>
  );
}

export default CatalogFeatureSearchResults;
