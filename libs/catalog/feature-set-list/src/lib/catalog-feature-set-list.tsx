import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSetCard,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { Badge, SectionHeading } from '@lego-platform/shared/ui';
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
          description="Start here: browse a short curated public catalog, compare reviewed Dutch price context where it is published, and open set pages to save what you own or still want."
          eyebrow="Featured sets"
          title="Browse standout sets first, then keep your collector state private."
        />
        <div className={styles.signalRow}>
          <Badge tone="accent">{homepageSets.length} curated picks</Badge>
          {reviewedSetCount ? (
            <Badge tone="info">
              {reviewedSetCount} with reviewed Dutch price context
            </Badge>
          ) : null}
          <Badge>Public entry point</Badge>
          <Badge>Private saves on set pages</Badge>
        </div>
      </div>
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
