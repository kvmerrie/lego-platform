import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSetCard,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-set-list.module.css';

export interface CatalogFeatureSetListItem extends CatalogHomepageSetCard {
  priceContext?: CatalogSetCardPriceContext;
}

export function CatalogFeatureSetList({
  setCards,
}: {
  setCards?: readonly CatalogFeatureSetListItem[];
}) {
  const homepageSets: readonly CatalogFeatureSetListItem[] =
    setCards ??
    listHomepageSetCards().map((catalogHomepageSetCard) => ({
      ...catalogHomepageSetCard,
      priceContext: undefined,
    }));
  const reviewedSetCount = homepageSets.filter(
    (catalogHomepageSetCard) => catalogHomepageSetCard.priceContext,
  ).length;

  return (
    <section className={styles.section} id="featured-sets">
      <div className={styles.headerBlock}>
        <SectionHeading
          className={styles.header}
          description="Browse a small curated shortlist, then open a set page to save what you own or still want."
          eyebrow="Featured sets"
          title="Start with a few standout sets."
        />
        <p className={styles.signalRow}>
          {homepageSets.length} curated picks
          {reviewedSetCount ? ` · ${reviewedSetCount} with reviewed price` : ''}
        </p>
      </div>
      <div className={styles.grid}>
        {homepageSets.map((catalogSetSummary) => (
          <CatalogSetCard
            key={catalogSetSummary.id}
            href={buildSetDetailPath(catalogSetSummary.slug)}
            priceContext={catalogSetSummary.priceContext}
            setSummary={catalogSetSummary}
            variant="featured"
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureSetList;
