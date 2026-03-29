import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSetCard,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
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

  return (
    <section className={styles.section} id="featured-sets">
      <SectionHeading
        className={styles.header}
        description="Each featured set keeps the homepage static-friendly while adding calmer collector cues around reviewed price posture, availability, and why the set matters."
        eyebrow="Featured sets"
        title="Start with a focused shortlist built for collector decisions."
      />
      <div className={styles.grid}>
        {homepageSets.map((catalogSetSummary) => (
          <CatalogSetCard
            key={catalogSetSummary.id}
            href={`/sets/${catalogSetSummary.slug}`}
            priceContext={catalogSetSummary.priceContext}
            setSummary={catalogSetSummary}
          />
        ))}
      </div>
    </section>
  );
}

export default CatalogFeatureSetList;
