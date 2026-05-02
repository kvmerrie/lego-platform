import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { describe, expect, it } from 'vitest';
import {
  buildSpotlightSectionsForEditorialShowcase,
  orderSpotlightItemsForEditorialShowcase,
  scoreSpotlightHighlightItem,
  selectSpotlightHighlightSet,
} from './article-mdx-set-spotlight-highlight';
import type { ArticleSetSpotlightItem } from './article-mdx-set-spotlight-types';

function createItem(
  setNumber: string,
  overrides: Partial<ArticleSetSpotlightItem> & {
    setSummary?: Partial<CatalogHomepageSetCard>;
  } = {},
): ArticleSetSpotlightItem {
  const { setSummary: setSummaryOverrides, ...itemOverrides } = overrides;

  return {
    ctaHref: `/sets/set-${setNumber}`,
    setSummary: {
      id: setNumber,
      imageUrl: `https://example.com/${setNumber}.png`,
      name: `Set ${setNumber}`,
      pieces: 200,
      releaseYear: 2026,
      slug: `set-${setNumber}`,
      theme: 'Icons',
      ...setSummaryOverrides,
    },
    ...itemOverrides,
  };
}

describe('article mdx set spotlight highlight', () => {
  it('picks a context-relevant highlight instead of simply the first or cheapest set', () => {
    const items = [
      createItem('11506', {
        priceValue: 'EUR 19,99',
        setSummary: {
          name: 'Rocking Plants',
          pieces: 140,
          theme: 'Botanicals',
        },
      }),
      createItem('75442', {
        availabilityLabel: 'Op voorraad',
        priceValue: 'EUR 79,99',
        setSummary: {
          name: "The Mandalorian's N-1 Starfighter",
          pieces: 825,
          theme: 'Star Wars',
        },
      }),
    ];
    const highlightItem = selectSpotlightHighlightSet(items, {
      articleDescription: 'De Mandalorian springt er hier duidelijk uit.',
      articleTitle: 'Nieuwe LEGO-sets voor mei 2026',
    });

    expect(highlightItem?.setSummary.id).toBe('75442');
  });

  it('keeps highlight selection deterministic when scores tie', () => {
    const items = [
      createItem('43301', {
        setSummary: {
          name: "Belle's Storytime Horse Carriage",
          pieces: 290,
          theme: 'Disney',
        },
      }),
      createItem('43304', {
        setSummary: {
          name: 'Palace Pets Boutique',
          pieces: 290,
          theme: 'Disney',
        },
      }),
    ];

    expect(selectSpotlightHighlightSet(items)?.setSummary.id).toBe('43301');
    expect(
      orderSpotlightItemsForEditorialShowcase(items).map(
        (item) => item.setSummary.id,
      ),
    ).toEqual(['43301', '43304']);
  });

  it('rewards availability, price and context matches in the score helper', () => {
    const score = scoreSpotlightHighlightItem({
      articleContext: {
        articleDescription:
          'Grogu en de Mandalorian blijven hier het opvallendst.',
        articleTitle: 'Nieuwe LEGO-sets voor mei 2026',
      },
      highestPieces: 1200,
      item: createItem('75446', {
        availabilityLabel: 'Op voorraad',
        priceValue: 'EUR 129,99',
        setSummary: {
          name: 'Grogu and Hover Pram',
          pieces: 1200,
          theme: 'Star Wars',
        },
      }),
    });

    expect(score).toBeGreaterThanOrEqual(48);
  });

  it('groups sets by theme and keeps unknown releases last', () => {
    const sections = buildSpotlightSectionsForEditorialShowcase([
      createItem('50001', {
        setSummary: {
          name: 'Mystery Desk Build',
          theme: undefined,
        },
      }),
      createItem('75442', {
        setSummary: {
          name: "The Mandalorian's N-1 Starfighter",
          theme: 'Star Wars',
        },
      }),
      createItem('43301', {
        setSummary: {
          name: "Toy Story - Buzz's Parade Wagon",
          theme: 'Disney',
        },
      }),
    ]);

    expect(sections.map((section) => section.id)).toEqual([
      'star-wars',
      'toy-story-disney',
      'other',
    ]);
    expect(sections.at(-1)?.title).toBe('Overige releases');
  });

  it('assigns layout variants for 1, 2, 3 and 4+ item groups', () => {
    const sections = buildSpotlightSectionsForEditorialShowcase([
      createItem('75442', {
        setSummary: {
          name: "The Mandalorian's N-1 Starfighter",
          theme: 'Star Wars',
        },
      }),
      createItem('43301', {
        setSummary: {
          name: 'Disney Carriage',
          theme: 'Disney',
        },
      }),
      createItem('43304', {
        setSummary: {
          name: 'Toy Story Room',
          theme: 'Disney',
        },
      }),
      createItem('43305', {
        setSummary: {
          name: 'Pixar Parade Float',
          theme: 'Disney',
        },
      }),
      createItem('43306', {
        setSummary: {
          name: 'Pixar Collection',
          theme: 'Disney',
        },
      }),
      createItem('11506', {
        setSummary: {
          name: 'Rocking Plants',
          theme: 'Botanicals',
        },
      }),
      createItem('11507', {
        setSummary: {
          name: 'Desk Garden',
          theme: 'Botanicals',
        },
      }),
      createItem('91001', {
        setSummary: {
          name: 'Ideas Space Lab',
          theme: 'Ideas',
        },
      }),
      createItem('91002', {
        setSummary: {
          name: 'Ideas Harbor',
          theme: 'Ideas',
        },
      }),
      createItem('91003', {
        setSummary: {
          name: 'Ideas Old Town',
          theme: 'Ideas',
        },
      }),
    ]);

    const byId = new Map(
      sections.map((section) => [section.id, section.layoutVariant]),
    );

    expect(byId.get('star-wars')).toBe('single');
    expect(byId.get('botanicals')).toBe('pair');
    expect(byId.get('ideas')).toBe('trio');
    expect(byId.get('toy-story-disney')).toBe('cluster');
  });

  it('picks a highlight per group instead of reusing one global first item', () => {
    const sections = buildSpotlightSectionsForEditorialShowcase(
      [
        createItem('43301', {
          setSummary: {
            name: 'Disney Carriage',
            pieces: 180,
            theme: 'Disney',
          },
        }),
        createItem('43304', {
          availabilityLabel: 'Op voorraad',
          priceValue: 'EUR 49,99',
          setSummary: {
            name: 'Toy Story Parade',
            pieces: 420,
            theme: 'Disney',
          },
        }),
      ],
      {
        articleTitle: 'Nieuwe LEGO Disney-sets voor mei 2026',
      },
    );

    expect(sections[0]?.highlightSetNumber).toBe('43304');
    expect(sections[0]?.items[0]?.setSummary.id).toBe('43304');
  });
});
