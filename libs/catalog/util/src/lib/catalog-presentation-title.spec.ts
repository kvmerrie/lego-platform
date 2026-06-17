import { describe, expect, test } from 'vitest';
import {
  type CatalogCanonicalSet,
  type CatalogSetSummary,
} from './catalog-util';
import {
  applyCatalogSetPresentationTitle,
  applyCatalogSetPresentationTitleToSummary,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE,
  resolveCatalogSetPresentationTitle,
} from './catalog-presentation-title';

function canonicalSet(): CatalogCanonicalSet {
  return {
    createdAt: '2026-06-17T08:00:00.000Z',
    name: 'The Lord of the Rings: Rivendell',
    pieceCount: 6167,
    primaryTheme: 'Icons',
    releaseYear: 2023,
    secondaryLabels: [],
    setId: '10316',
    slug: 'the-lord-of-the-rings-rivendell-10316',
    source: 'rebrickable',
    sourceSetNumber: '10316-1',
    status: 'active',
    updatedAt: '2026-06-17T08:00:00.000Z',
  };
}

describe('catalog presentation title resolver', () => {
  test('prefers the Dutch Rakuten LEGO title when exact metadata is available', () => {
    const resolution = resolveCatalogSetPresentationTitle({
      fallbackTitle: 'The Lord of the Rings: Rivendell',
      rakutenMetadata: {
        locale: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE,
        matchConfidence:
          CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE,
        metadataJson: {
          title: 'In de ban van de ringen: Rivendel',
        },
        policy: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY,
        source: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE,
      },
    });

    expect(resolution).toEqual({
      source: 'rakuten-lego-eu',
      title: 'In de ban van de ringen: Rivendel',
    });
  });

  test('falls back to the catalog title when Dutch metadata is missing', () => {
    expect(
      resolveCatalogSetPresentationTitle({
        fallbackTitle: 'The Lord of the Rings: Rivendell',
      }),
    ).toEqual({
      source: 'catalog',
      title: 'The Lord of the Rings: Rivendell',
    });
  });

  test('keeps identifiers stable while applying presentation titles', () => {
    const set = canonicalSet();
    const enrichedSet = applyCatalogSetPresentationTitle(
      set,
      resolveCatalogSetPresentationTitle({
        fallbackTitle: set.name,
        rakutenMetadata: {
          locale: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE,
          matchConfidence:
            CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE,
          metadataJson: {
            title: 'In de ban van de ringen: Rivendel',
          },
          policy: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY,
          source: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE,
        },
      }),
    );

    expect(enrichedSet).toMatchObject({
      catalogName: 'The Lord of the Rings: Rivendell',
      displayTitle: 'In de ban van de ringen: Rivendel',
      displayTitleSource: 'rakuten-lego-eu',
      name: 'In de ban van de ringen: Rivendel',
      setId: '10316',
      slug: 'the-lord-of-the-rings-rivendell-10316',
      source: 'rebrickable',
    });
  });

  test('applies the same title resolution to rail card summaries', () => {
    const card: CatalogSetSummary = {
      id: '10316',
      name: 'The Lord of the Rings: Rivendell',
      pieces: 6167,
      releaseYear: 2023,
      slug: 'the-lord-of-the-rings-rivendell-10316',
      theme: 'Icons',
    };

    const enrichedCard = applyCatalogSetPresentationTitleToSummary(card, {
      source: 'rakuten-lego-eu',
      title: 'In de ban van de ringen: Rivendel',
    });

    expect(enrichedCard).toMatchObject({
      catalogName: 'The Lord of the Rings: Rivendell',
      displayTitle: 'In de ban van de ringen: Rivendel',
      displayTitleSource: 'rakuten-lego-eu',
      id: '10316',
      name: 'In de ban van de ringen: Rivendel',
      slug: 'the-lord-of-the-rings-rivendell-10316',
    });
  });
});
