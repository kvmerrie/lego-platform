import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSetCard,
  CatalogSetCardRail,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { SectionHeading } from '@lego-platform/shared/ui';
import styles from './catalog-feature-set-list.module.css';

export interface CatalogFeatureSetListItem extends CatalogHomepageSetCard {
  priceContext?: CatalogSetCardPriceContext;
}

export function CatalogFeatureSetList({
  description = 'Wil je groot? Kijk hier.',
  eyebrow = 'Pronkstukken',
  layout = 'rail',
  sectionId = 'featured-sets',
  setCards,
  signalText,
  tone = 'muted',
  title = 'Torens, walkers, supercars',
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
        <div className={styles.headerAside}>
          <p className={styles.signalRow}>
            {signalText ??
              `${homepageSets.length} dozen die je kast overnemen${
                reviewedSetCount
                  ? ` · ${reviewedSetCount} met nagekeken prijzen`
                  : ''
              }`}
          </p>
        </div>
      </div>
      {layout === 'grid' ? (
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
      ) : (
        <CatalogSetCardRail
          ariaLabel={title}
          items={homepageSets.map((catalogSetSummary) => ({
            href: buildSetDetailPath(catalogSetSummary.slug),
            id: catalogSetSummary.id,
            priceContext: catalogSetSummary.priceContext,
            setSummary: catalogSetSummary,
          }))}
          variant="featured"
        />
      )}
    </section>
  );
}

export default CatalogFeatureSetList;
