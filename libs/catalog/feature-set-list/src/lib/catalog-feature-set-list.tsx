import type { ReactNode } from 'react';
import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSectionHeader,
  CatalogSetCard,
  CatalogSetCardRail,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import styles from './catalog-feature-set-list.module.css';

export interface CatalogFeatureSetListItem extends CatalogHomepageSetCard {
  actions?: ReactNode;
  priceContext?: CatalogSetCardPriceContext;
}

export function CatalogFeatureSetList({
  description = 'Grote sets die je plank én budget bepalen.',

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
      <CatalogSectionHeader
        className={styles.headerBlock}
        description={description}
        eyebrow={eyebrow}
        headingClassName={styles.header}
        signal={
          signalText ??
          `${homepageSets.length} sets die meteen de kamer pakken${
            reviewedSetCount
              ? ` · ${reviewedSetCount} met nagekeken prijzen`
              : ''
          }`
        }
        title={title}
      />
      {layout === 'grid' ? (
        <div className={styles.grid}>
          {homepageSets.map((catalogSetSummary) => (
            <CatalogSetCard
              actions={catalogSetSummary.actions}
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
            actions: catalogSetSummary.actions,
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
