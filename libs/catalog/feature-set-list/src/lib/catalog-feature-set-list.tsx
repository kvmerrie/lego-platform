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
  description = 'A compact mix of flagship buys, crowd-pulling click magnets, and easier collector entry points.',
  eyebrow = 'Featured sets',
  layout = 'rail',
  sectionId = 'featured-sets',
  setCards,
  signalText,
  tone = 'muted',
  title = 'Start with sets worth opening.',
}: {
  description?: string;
  eyebrow?: string;
  layout?: 'grid' | 'rail';
  sectionId?: string;
  setCards?: readonly CatalogFeatureSetListItem[];
  signalText?: string;
  tone?: 'default' | 'muted';
  title?: string;
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
    <section
      className={`${styles.section} ${
        tone === 'default' ? styles.sectionDefault : styles.sectionMuted
      }`}
      id={sectionId}
    >
      <div className={styles.headerBlock}>
        <SectionHeading
          className={styles.header}
          description={description}
          eyebrow={eyebrow}
          title={title}
        />
        <p className={styles.signalRow}>
          {signalText ??
            `${homepageSets.length} featured sets${
              reviewedSetCount
                ? ` · ${reviewedSetCount} with reviewed prices`
                : ''
            }`}
        </p>
      </div>
      <div className={layout === 'grid' ? styles.grid : styles.rail}>
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
