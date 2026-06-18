import { describe, expect, test } from 'vitest';
import type {
  CatalogCanonicalSet,
  CatalogPopularitySnapshot,
} from '@lego-platform/catalog/util';
import type { CollectionPageSnapshot } from './collection-page-snapshot-server';
import type {
  DealPageSnapshot,
  DealPageSnapshotCard,
} from './deal-page-snapshot-server';
import {
  buildHomepageCommerceSnapshot,
  type HomepageCurrentOfferSnapshotRow,
  type HomepagePriceHistoryRow,
} from './homepage-commerce-snapshot-server';

const generatedAt = '2026-06-15T08:00:00.000Z';

function catalogSet(id: string, patch: Partial<CatalogCanonicalSet> = {}) {
  return {
    createdAt: generatedAt,
    name: `Set ${id}`,
    pieceCount: 800,
    primaryTheme: 'Icons',
    releaseYear: 2026,
    secondaryLabels: [],
    setId: id,
    slug: `set-${id}`,
    source: 'snapshot',
    sourceSetNumber: `${id}-1`,
    status: 'active',
    updatedAt: generatedAt,
    imageUrl: `https://img.example/${id}.jpg`,
    ...patch,
  } satisfies CatalogCanonicalSet;
}

function dealCard(id: string, url = `https://merchant.example/${id}`) {
  return {
    bestPriceMinor: 7999,
    dealScore: 280,
    id,
    imageUrl: `https://img.example/${id}.jpg`,
    name: `Deal ${id}`,
    pieces: 800,
    priceContext: {
      coverageLabel: '3 vergeleken winkels',
      currentPrice: 'Vanaf EUR 79,99',
      decisionLabel: 'Sterke deal',
      merchantLabel: 'Laagst bij Toy Shop',
      merchantName: 'Toy Shop',
      merchantSlug: 'toy-shop',
      primaryActionHref: url,
      reviewedLabel: 'Snapshot bijgewerkt',
    },
    recommendedDealScore: 280,
    releaseYear: 2026,
    setNumber: `${id}-1`,
    slug: `set-${id}`,
    theme: 'Icons',
  } satisfies DealPageSnapshotCard;
}

function currentOffer(
  setId: string,
  priceMinor = 7999,
): HomepageCurrentOfferSnapshotRow {
  return {
    best_availability: 'in_stock',
    best_checked_at: generatedAt,
    best_merchant_name: 'Toy Shop',
    best_merchant_slug: 'toy-shop',
    best_price_minor: priceMinor,
    best_product_url: `https://merchant.example/${setId}`,
    comparable_offer_count: 2,
    computed_at: generatedAt,
    offer_count: 3,
    set_id: setId,
    trusted_offer_count: 2,
  };
}

function historyRow({
  observedAt,
  priceMinor,
  referencePriceMinor,
  setId,
}: {
  observedAt: string;
  priceMinor: number;
  referencePriceMinor?: number;
  setId: string;
}): HomepagePriceHistoryRow {
  return {
    headline_price_minor: priceMinor,
    observed_at: observedAt,
    recorded_on: observedAt.slice(0, 10),
    reference_price_minor: referencePriceMinor ?? null,
    set_id: setId,
  };
}

function buildFixtures() {
  const catalogSets = [
    catalogSet('1001', { name: 'Beste deal' }),
    catalogSet('1002', { name: 'Populaire koopset' }),
    catalogSet('1003', { name: 'Cadeau onder honderd' }),
    catalogSet('2001', { name: 'Slim volgmodel', pieceCount: 2200 }),
    catalogSet('2002', { name: 'Prijsdaling model', pieceCount: 1200 }),
    catalogSet('2003', { name: 'Wachten kan lonen model', pieceCount: 1800 }),
  ];
  const dealSnapshots: DealPageSnapshot[] = [
    {
      generatedAt,
      items: [
        {
          ...dealCard('1001', 'https://canonical.example/best-deal'),
          offers: [{ priceMinor: 1 }],
        } as DealPageSnapshotCard & { offers: unknown[] },
      ],
      page: 1,
      pageSize: 40,
      sortKey: 'recommended',
      sourceVersion: generatedAt,
      stats: {
        activeDealCount: 1,
      },
      totalCount: 1,
    },
  ];
  const collectionSnapshots: CollectionPageSnapshot[] = [
    {
      bricksetMetadataUsedCount: 0,
      collectionSlug: 'lego-sets-onder-100-euro',
      generatedAt,
      items: [
        {
          id: '1003',
          imageUrl: 'https://img.example/1003.jpg',
          name: 'Cadeau onder honderd',
          pieces: 600,
          priceContext: {
            coverageLabel: 'Actuele prijs gevonden',
            currentPrice: 'Vanaf EUR 69,99',
            merchantLabel: 'Laagst bij Toy Shop',
          },
          releaseYear: 2026,
          setNumber: '1003-1',
          slug: 'set-1003',
          theme: 'Icons',
        },
      ],
      missingPriceSnapshotCount: 0,
      page: 1,
      pageSize: 40,
      sortKey: 'recommended',
      sourceVersion: generatedAt,
      totalCount: 1,
    },
  ];
  const currentOfferRows = [
    currentOffer('1002', 8999),
    currentOffer('1003', 6999),
    currentOffer('2001', 11999),
    currentOffer('2002', 7999),
    currentOffer('2003', 15000),
    currentOffer('1001', 7999),
  ];
  const priceHistoryRows = [
    historyRow({
      observedAt: '2026-06-15T00:00:00.000Z',
      priceMinor: 7999,
      setId: '2002',
    }),
    historyRow({
      observedAt: '2026-06-01T00:00:00.000Z',
      priceMinor: 12999,
      setId: '2002',
    }),
    historyRow({
      observedAt: '2026-06-15T00:00:00.000Z',
      priceMinor: 15000,
      referencePriceMinor: 10000,
      setId: '2003',
    }),
    historyRow({
      observedAt: '2026-06-01T00:00:00.000Z',
      priceMinor: 10000,
      setId: '2003',
    }),
    historyRow({
      observedAt: '2026-06-15T00:00:00.000Z',
      priceMinor: 7999,
      referencePriceMinor: 12000,
      setId: '1001',
    }),
    historyRow({
      observedAt: '2026-06-01T00:00:00.000Z',
      priceMinor: 12000,
      setId: '1001',
    }),
  ];
  const popularitySnapshot: CatalogPopularitySnapshot = {
    generatedAt,
    windows: {
      day: [],
      week: [
        {
          counts: {
            catalog_set_click: 4,
            offer_click: 2,
            set_view: 10,
          },
          score: 80,
          set_num: '1002',
          unique_sessions: 7,
        },
      ],
    },
  };

  return {
    catalogSets,
    collectionSnapshots,
    currentOfferRows,
    dealSnapshots,
    popularitySnapshot,
    priceHistoryRows,
  };
}

function withPresentationTitle(
  set: CatalogCanonicalSet,
  displayTitle: string,
): CatalogCanonicalSet {
  return {
    ...set,
    catalogName: set.name,
    displayTitle,
    displayTitleSource: 'rakuten-lego-eu',
    name: displayTitle,
  };
}

describe('homepage commerce snapshot builder', () => {
  test('builds all six homepage commerce tabs', async () => {
    const result = await buildHomepageCommerceSnapshot({
      ...buildFixtures(),
      now: new Date(generatedAt),
      tabLimit: 20,
    });

    expect(Object.keys(result.snapshot.buyRail)).toEqual([
      'bestDeals',
      'popularThisWeek',
      'giftsUnder100',
    ]);
    expect(Object.keys(result.snapshot.followRail)).toEqual([
      'smartToFollow',
      'biggestPriceDrops',
      'waitCanPayOff',
    ]);
    expect(result.snapshot.buyRail.bestDeals[0]).toMatchObject({
      currentPriceMinor: 7999,
      ctaUrl: 'https://canonical.example/best-deal',
      merchantName: 'Toy Shop',
      merchantSlug: 'toy-shop',
      setId: '1001',
    });
    expect(result.snapshot.buyRail.popularThisWeek[0]).toMatchObject({
      currentPriceMinor: 8999,
      ctaUrl: 'https://merchant.example/1002',
      merchantName: 'Toy Shop',
      merchantSlug: 'toy-shop',
      setId: '1002',
    });
  });

  test('prevents overlap between buy rail and follow rail', async () => {
    const result = await buildHomepageCommerceSnapshot({
      ...buildFixtures(),
      now: new Date(generatedAt),
      tabLimit: 20,
    });
    const buyIds = new Set(
      [
        ...result.snapshot.buyRail.bestDeals,
        ...result.snapshot.buyRail.popularThisWeek,
        ...result.snapshot.buyRail.giftsUnder100,
      ].map((card) => card.setId),
    );
    const followIds = [
      ...result.snapshot.followRail.smartToFollow,
      ...result.snapshot.followRail.biggestPriceDrops,
      ...result.snapshot.followRail.waitCanPayOff,
    ].map((card) => card.setId);

    expect(followIds.filter((setId) => buyIds.has(setId))).toEqual([]);
  });

  test('uses the canonical deal snapshot best purchasable CTA for best deals', async () => {
    const result = await buildHomepageCommerceSnapshot({
      ...buildFixtures(),
      now: new Date(generatedAt),
    });

    expect(result.snapshot.buyRail.bestDeals[0]).toMatchObject({
      setId: '1001',
      ctaUrl: 'https://canonical.example/best-deal',
      currentPriceMinor: 7999,
    });
  });

  test('keeps shared presentation titles in homepage rails', async () => {
    const fixtures = buildFixtures();
    const result = await buildHomepageCommerceSnapshot({
      ...fixtures,
      catalogSets: [
        ...fixtures.catalogSets.filter((set) => set.setId !== '1002'),
        catalogSet('1002', {
          catalogName: 'The Lord of the Rings: Rivendell',
          displayTitle: 'In de ban van de ringen: Rivendel',
          displayTitleSource: 'rakuten-lego-eu',
          name: 'In de ban van de ringen: Rivendel',
        }),
      ],
      now: new Date(generatedAt),
    });

    expect(result.snapshot.buyRail.popularThisWeek[0]).toMatchObject({
      catalogName: 'The Lord of the Rings: Rivendell',
      displayTitle: 'In de ban van de ringen: Rivendel',
      displayTitleSource: 'rakuten-lego-eu',
      name: 'In de ban van de ringen: Rivendel',
      setId: '1002',
      slug: 'set-1002',
    });
  });

  test('keeps shared presentation titles from deal and collection rails', async () => {
    const fixtures = buildFixtures();
    const catalogSets = fixtures.catalogSets.map((set) =>
      set.setId === '1001' || set.setId === '1003'
        ? withPresentationTitle(set, 'In de ban van de ringen: Rivendel')
        : set,
    );
    const result = await buildHomepageCommerceSnapshot({
      ...fixtures,
      catalogSets,
      collectionSnapshots: [
        {
          ...fixtures.collectionSnapshots[0],
          items: [
            {
              ...fixtures.collectionSnapshots[0].items[0],
              catalogName: 'The Lord of the Rings: Rivendell',
              displayTitle: 'In de ban van de ringen: Rivendel',
              displayTitleSource: 'rakuten-lego-eu',
              name: 'In de ban van de ringen: Rivendel',
            },
          ],
        },
      ],
      dealSnapshots: [
        {
          ...fixtures.dealSnapshots[0],
          items: [
            {
              ...fixtures.dealSnapshots[0].items[0],
              catalogName: 'The Lord of the Rings: Rivendell',
              displayTitle: 'In de ban van de ringen: Rivendel',
              displayTitleSource: 'rakuten-lego-eu',
              name: 'In de ban van de ringen: Rivendel',
            },
          ],
        },
      ],
      now: new Date(generatedAt),
    });

    expect(result.snapshot.buyRail.bestDeals[0]).toMatchObject({
      catalogName: 'Beste deal',
      displayTitle: 'In de ban van de ringen: Rivendel',
      displayTitleSource: 'rakuten-lego-eu',
      name: 'In de ban van de ringen: Rivendel',
      setId: '1001',
    });
    expect(result.snapshot.buyRail.giftsUnder100[0]).toMatchObject({
      catalogName: 'Cadeau onder honderd',
      displayTitle: 'In de ban van de ringen: Rivendel',
      displayTitleSource: 'rakuten-lego-eu',
      name: 'In de ban van de ringen: Rivendel',
      setId: '1003',
    });
  });

  test('uses NL presentation titles in all homepage commerce tabs', async () => {
    const fixtures = buildFixtures();
    const catalogSets = fixtures.catalogSets.map((set) => {
      switch (set.setId) {
        case '1001':
          return withPresentationTitle(set, 'Beste deal NL');
        case '1002':
          return withPresentationTitle(set, 'Populaire koopset NL');
        case '1003':
          return withPresentationTitle(set, 'Cadeau onder honderd NL');
        case '2001':
          return withPresentationTitle(set, 'Slim volgmodel NL');
        case '2002':
          return withPresentationTitle(set, 'Prijsdaling model NL');
        case '2003':
          return withPresentationTitle(set, 'Wachten kan lonen model NL');
        default:
          return set;
      }
    });
    const result = await buildHomepageCommerceSnapshot({
      ...fixtures,
      catalogSets,
      now: new Date(generatedAt),
    });

    expect(result.snapshot.buyRail.bestDeals[0]).toMatchObject({
      displayTitle: 'Beste deal NL',
      displayTitleSource: 'rakuten-lego-eu',
      name: 'Beste deal NL',
      setId: '1001',
    });
    expect(result.snapshot.buyRail.popularThisWeek[0]).toMatchObject({
      displayTitle: 'Populaire koopset NL',
      displayTitleSource: 'rakuten-lego-eu',
      name: 'Populaire koopset NL',
      setId: '1002',
    });
    expect(result.snapshot.buyRail.giftsUnder100[0]).toMatchObject({
      displayTitle: 'Cadeau onder honderd NL',
      displayTitleSource: 'rakuten-lego-eu',
      name: 'Cadeau onder honderd NL',
      setId: '1003',
    });
    expect(result.snapshot.followRail.smartToFollow).toContainEqual(
      expect.objectContaining({
        displayTitle: 'Slim volgmodel NL',
        displayTitleSource: 'rakuten-lego-eu',
        name: 'Slim volgmodel NL',
        setId: '2001',
      }),
    );
    expect(result.snapshot.followRail.biggestPriceDrops).toContainEqual(
      expect.objectContaining({
        displayTitle: 'Prijsdaling model NL',
        displayTitleSource: 'rakuten-lego-eu',
        name: 'Prijsdaling model NL',
        setId: '2002',
      }),
    );
    expect(result.snapshot.followRail.waitCanPayOff).toContainEqual(
      expect.objectContaining({
        displayTitle: 'Wachten kan lonen model NL',
        displayTitleSource: 'rakuten-lego-eu',
        name: 'Wachten kan lonen model NL',
        setId: '2003',
      }),
    );
  });

  test('keeps fallback titles when no NL Rakuten title exists', async () => {
    const result = await buildHomepageCommerceSnapshot({
      ...buildFixtures(),
      now: new Date(generatedAt),
    });

    expect(result.snapshot.followRail.smartToFollow).toContainEqual(
      expect.objectContaining({
        displayTitle: 'Slim volgmodel',
        name: 'Slim volgmodel',
        setId: '2001',
      }),
    );
    expect(result.summary.titleAudit.smartToFollow).toMatchObject({
      fallbackTitleCount: expect.any(Number),
      missingNlTitleCount: expect.any(Number),
      nlTitleAppliedCount: 0,
    });
  });

  test('uses the under-100 collection snapshot for gifts under EUR 100', async () => {
    const result = await buildHomepageCommerceSnapshot({
      ...buildFixtures(),
      now: new Date(generatedAt),
    });

    expect(result.snapshot.buyRail.giftsUnder100[0]).toMatchObject({
      setId: '1003',
      ctaUrl: 'https://merchant.example/1003',
      currentPriceMinor: 6999,
    });
  });

  test('uses decision-engine wait state for wait can pay off', async () => {
    const result = await buildHomepageCommerceSnapshot({
      ...buildFixtures(),
      now: new Date(generatedAt),
    });

    expect(result.snapshot.followRail.waitCanPayOff).toContainEqual(
      expect.objectContaining({
        dealLabel: 'Wachten kan lonen',
        followRecommended: true,
        setId: '2003',
      }),
    );
  });

  test('degrades the popular tab when popularity data is missing', async () => {
    const fixtures = buildFixtures();
    const result = await buildHomepageCommerceSnapshot({
      ...fixtures,
      now: new Date(generatedAt),
      popularitySnapshot: {
        generatedAt,
        windows: {
          day: [],
          week: [],
        },
      },
    });

    expect(result.snapshot.buyRail.popularThisWeek).toEqual([]);
  });

  test('keeps the homepage snapshot payload compact and free of offer arrays', async () => {
    const result = await buildHomepageCommerceSnapshot({
      ...buildFixtures(),
      now: new Date(generatedAt),
    });
    const payload = JSON.stringify(result.snapshot);

    expect(payload).not.toContain('"offers"');
    expect(result.summary.payloadBytes).toBeLessThan(300_000);
  });
});
