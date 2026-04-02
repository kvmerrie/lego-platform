'use client';

import { useId, useRef } from 'react';
import type {
  CatalogHomepageSetCard,
  CatalogSetSummary,
} from '@lego-platform/catalog/util';
import { Button } from '@lego-platform/shared/ui';
import { CatalogSetCard, type CatalogSetCardPriceContext } from './catalog-ui';
import styles from './catalog-ui.module.css';

type CatalogSetCardRailSummary = CatalogSetSummary &
  Partial<Pick<CatalogHomepageSetCard, 'availability' | 'tagline'>>;

export interface CatalogSetCardRailItem {
  href?: string;
  id: string;
  priceContext?: CatalogSetCardPriceContext;
  setSummary: CatalogSetCardRailSummary;
  supportingNote?: string;
}

export function CatalogSetCardRail({
  ariaLabel,
  items,
  variant = 'featured',
}: {
  ariaLabel: string;
  items: readonly CatalogSetCardRailItem[];
  variant?: 'browse' | 'featured';
}) {
  const railId = useId();
  const railRef = useRef<HTMLDivElement>(null);

  if (!items.length) {
    return null;
  }

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
    <div className={styles.setCardRail}>
      {items.length > 1 ? (
        <div className={styles.setCardRailControls}>
          <Button
            aria-controls={railId}
            aria-label={`Scroll ${ariaLabel} backward`}
            className={styles.setCardRailButton}
            onClick={() => scrollRail('previous')}
            tone="secondary"
            type="button"
          >
            Previous
          </Button>
          <Button
            aria-controls={railId}
            aria-label={`Scroll ${ariaLabel} forward`}
            className={styles.setCardRailButton}
            onClick={() => scrollRail('next')}
            tone="secondary"
            type="button"
          >
            Next
          </Button>
        </div>
      ) : null}
      <div className={styles.setCardRailTrack} id={railId} ref={railRef}>
        {items.map((item) => (
          <div className={styles.setCardRailItem} key={item.id}>
            <CatalogSetCard
              href={item.href}
              priceContext={item.priceContext}
              setSummary={item.setSummary}
              supportingNote={item.supportingNote}
              variant={variant}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
