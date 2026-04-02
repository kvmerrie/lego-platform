'use client';

import { useId, useRef } from 'react';
import { listHomepageSetCards } from '@lego-platform/catalog/data-access';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import {
  CatalogSetCard,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { Button, SectionHeading } from '@lego-platform/shared/ui';
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
  const railId = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const reviewedSetCount = homepageSets.filter(
    (catalogHomepageSetCard) => catalogHomepageSetCard.priceContext,
  ).length;
  const usesRailLayout = layout === 'rail';

  function scrollRail(direction: 'next' | 'previous') {
    const railElement = railRef.current;

    if (!railElement) {
      return;
    }

    const scrollAmount = Math.max(railElement.clientWidth * 0.92, 240);

    railElement.scrollBy({
      behavior: 'smooth',
      left: direction === 'next' ? scrollAmount : -scrollAmount,
    });
  }

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
              `${homepageSets.length} featured sets${
                reviewedSetCount
                  ? ` · ${reviewedSetCount} with reviewed prices`
                  : ''
              }`}
          </p>
          {usesRailLayout && homepageSets.length > 1 ? (
            <div className={styles.railControls}>
              <Button
                aria-controls={railId}
                aria-label={`Scroll ${title} backward`}
                className={styles.railButton}
                onClick={() => scrollRail('previous')}
                tone="secondary"
                type="button"
              >
                Previous
              </Button>
              <Button
                aria-controls={railId}
                aria-label={`Scroll ${title} forward`}
                className={styles.railButton}
                onClick={() => scrollRail('next')}
                tone="secondary"
                type="button"
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={layout === 'grid' ? styles.grid : styles.rail}
        id={layout === 'rail' ? railId : undefined}
        ref={layout === 'rail' ? railRef : undefined}
      >
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
