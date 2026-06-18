import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import { resolveCommerceMerchantSeoPresentation } from '@lego-platform/shared/config';
import { describe, expect, test } from 'vitest';
import {
  buildCommerceMerchantPageSnapshotRecords,
  getMerchantPageRevalidationPaths,
  type CommerceMerchantPageSnapshotMerchant,
  type CommerceMerchantPageSnapshotProfile,
} from './commerce-merchant-page-snapshot-server';

type CurrentSnapshotInput = Parameters<
  typeof buildCommerceMerchantPageSnapshotRecords
>[0]['currentSnapshots'][number];

function merchant({
  active = true,
  id,
  name,
  slug,
}: {
  active?: boolean;
  id: string;
  name: string;
  slug: string;
}): CommerceMerchantPageSnapshotMerchant {
  const seoPresentation = resolveCommerceMerchantSeoPresentation({
    affiliateNetwork: 'awin',
    merchantName: name,
    merchantSlug: slug,
  });

  return {
    affiliateNetwork: 'awin',
    createdAt: '2026-06-12T09:00:00.000Z',
    id,
    isActive: active,
    name: seoPresentation.displayName,
    notes: '',
    publicSlug: seoPresentation.publicSlug,
    seoPresentation,
    slug,
    sourceType: 'affiliate',
    updatedAt: '2026-06-12T09:00:00.000Z',
  };
}

function merchantProfile({
  displayName = 'LEGO®',
  internalSlug = 'rakuten-lego-eu',
  merchantId = 'merchant-rakuten-lego-eu',
  publicSlug = 'lego',
  seoTitle = 'LEGO profiel uit Supabase',
}: {
  displayName?: string;
  internalSlug?: string;
  merchantId?: string;
  publicSlug?: string;
  seoTitle?: string;
} = {}): CommerceMerchantPageSnapshotProfile {
  return {
    brandColor: '#ffd500',
    brandTextColor: '#111111',
    canonicalPath: `/winkels/${publicSlug}`,
    displayName,
    faviconUrl: '/merchant-favicons/lego-nl.png',
    internalSlug,
    isPublic: true,
    logoUrl: '/merchant-favicons/lego-nl.png',
    merchantId,
    publicSlug,
    seoDescription:
      'Supabase profieltekst voor de officiële LEGO winkel op Brickhunt.',
    seoTitle,
    shortDescription: 'Supabase profiel voor LEGO.',
  };
}

function catalogSet({
  id,
  name = 'Rivendell',
}: {
  id: string;
  name?: string;
}): CatalogCanonicalSet {
  return {
    createdAt: '2026-06-12T08:00:00.000Z',
    imageUrl: `https://images.example/${id}.jpg`,
    name,
    pieceCount: 6167,
    primaryTheme: 'Icons',
    releaseYear: 2023,
    secondaryLabels: [],
    setId: id,
    slug: `${name.toLowerCase().replaceAll(' ', '-')}-${id}`,
    source: 'snapshot',
    status: 'active',
    updatedAt: '2026-06-12T08:00:00.000Z',
  };
}

function snapshotOffer({
  availability = 'in_stock',
  merchantId,
  merchantName,
  merchantSlug,
  priceMinor,
  setId,
}: {
  availability?: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  priceMinor: number;
  setId: string;
}) {
  return {
    availability,
    checkedAt: '2026-06-12T10:00:00.000Z',
    currency: 'EUR',
    merchantId,
    merchantName,
    merchantSlug,
    offerSeedId: `seed-${merchantSlug}-${setId}`,
    priceMinor,
    setId,
    url: `https://${merchantSlug}.example/${setId}`,
  };
}

function currentSnapshot({
  offers,
  setId,
}: {
  offers: readonly ReturnType<typeof snapshotOffer>[];
  setId: string;
}): CurrentSnapshotInput {
  const bestOffer = offers[0];

  return {
    best_availability: bestOffer?.availability ?? null,
    best_checked_at: '2026-06-12T10:00:00.000Z',
    best_merchant_id: bestOffer?.merchantId ?? null,
    best_merchant_name: bestOffer?.merchantName ?? null,
    best_merchant_slug: bestOffer?.merchantSlug ?? null,
    best_offer_seed_id: bestOffer?.offerSeedId ?? null,
    best_price_minor: bestOffer?.priceMinor ?? null,
    best_product_url: bestOffer?.url ?? null,
    comparable_offer_count: offers.length,
    computed_at: '2026-06-12T10:05:00.000Z',
    condition: 'new',
    currency_code: 'EUR',
    next_best_price_minor: null,
    offer_count: offers.length,
    offers,
    region_code: 'NL',
    set_id: setId,
  };
}

const activeMerchants = [
  merchant({
    id: 'merchant-goodbricks',
    name: 'Goodbricks',
    slug: 'goodbricks',
  }),
  merchant({
    id: 'merchant-lego',
    name: 'LEGO',
    slug: 'lego',
  }),
  merchant({
    id: 'merchant-bol',
    name: 'bol',
    slug: 'bol',
  }),
] as const;

describe('commerce merchant page snapshot builder', () => {
  test('uses public merchant slugs for merchant page revalidation paths', () => {
    expect(
      getMerchantPageRevalidationPaths(['rakuten-lego-eu', 'goodbricks']),
    ).toEqual(['/winkels', '/winkels/lego', '/winkels/goodbricks']);
  });

  test('uses merchant profile public slugs for merchant page revalidation paths', () => {
    expect(
      getMerchantPageRevalidationPaths(
        ['source-shop-eu', 'goodbricks'],
        [
          merchantProfile({
            displayName: 'Source Shop',
            internalSlug: 'source-shop-eu',
            merchantId: 'merchant-source-shop-eu',
            publicSlug: 'source-shop',
          }),
        ],
      ),
    ).toEqual(['/winkels', '/winkels/source-shop', '/winkels/goodbricks']);
  });

  test('ranks best deals where the merchant is cheapest', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [catalogSet({ id: '10316' })],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              merchantId: 'merchant-goodbricks',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceMinor: 9_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-lego',
              merchantName: 'LEGO',
              merchantSlug: 'lego',
              priceMinor: 10_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-bol',
              merchantName: 'bol',
              merchantSlug: 'bol',
              priceMinor: 12_000,
              setId: '10316',
            }),
          ],
          setId: '10316',
        }),
      ],
      merchants: activeMerchants,
    });
    const goodbricks = records.find(
      (record) => record.merchantSlug === 'goodbricks',
    );

    expect(goodbricks?.snapshot.bestDeals[0]).toMatchObject({
      nextBestPriceMinor: 10_000,
      priceMinor: 9_000,
      savingsMinor: 1_000,
      savingsPercentage: 10,
      set: {
        id: '10316',
      },
    });
    expect(
      records.find((record) => record.merchantSlug === 'lego')?.snapshot
        .dealCount,
    ).toBe(0);
  });

  test('uses the canonical current-offer snapshot best merchant for equal prices', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [catalogSet({ id: '10316' })],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              merchantId: 'merchant-goodbricks',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceMinor: 10_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-bol',
              merchantName: 'bol',
              merchantSlug: 'bol',
              priceMinor: 10_000,
              setId: '10316',
            }),
          ],
          setId: '10316',
        }),
      ],
      merchants: activeMerchants,
    });

    expect(
      records.find((record) => record.merchantSlug === 'goodbricks')?.snapshot
        .bestDeals[0],
    ).toMatchObject({
      merchant: expect.objectContaining({
        slug: 'goodbricks',
      }),
      priceMinor: 10_000,
      set: {
        id: '10316',
      },
    });
    expect(
      records.find((record) => record.merchantSlug === 'bol')?.snapshot
        .dealCount,
    ).toBe(0);
  });

  test('uses presentation titles on merchant page deals without changing merchant identity', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [
        catalogSet({
          id: '10316',
          name: 'In de ban van de ringen: Rivendel',
        }),
      ],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              merchantId: 'merchant-lego',
              merchantName: 'LEGO',
              merchantSlug: 'lego',
              priceMinor: 10_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-bol',
              merchantName: 'bol',
              merchantSlug: 'bol',
              priceMinor: 12_000,
              setId: '10316',
            }),
          ],
          setId: '10316',
        }),
      ],
      merchantProfiles: [merchantProfile()],
      merchants: activeMerchants,
    });

    const legoRecord = records.find((record) => record.merchantSlug === 'lego');

    expect(legoRecord?.snapshot.bestDeals[0]?.set).toMatchObject({
      id: '10316',
      name: 'In de ban van de ringen: Rivendel',
      slug: 'in-de-ban-van-de-ringen:-rivendel-10316',
    });
    expect(legoRecord?.snapshot.bestDeals[0]?.merchant).toMatchObject({
      publicSlug: 'lego',
      slug: 'lego',
    });
  });

  test('separates only-at-this-merchant deals from savings deals', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [catalogSet({ id: '75355', name: 'X-wing Starfighter' })],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              merchantId: 'merchant-goodbricks',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceMinor: 19_995,
              setId: '75355',
            }),
          ],
          setId: '75355',
        }),
      ],
      merchants: activeMerchants,
    });
    const goodbricks = records.find(
      (record) => record.merchantSlug === 'goodbricks',
    );

    expect(goodbricks?.snapshot.bestDeals).toEqual([]);
    expect(goodbricks?.snapshot.onlyAtMerchantDeals[0]).toMatchObject({
      nextBestPriceMinor: undefined,
      priceMinor: 19_995,
      set: {
        name: 'X-wing Starfighter',
      },
    });
  });

  test('excludes inactive merchants from snapshots and comparisons', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [catalogSet({ id: '10316' })],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              merchantId: 'merchant-goodbricks',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceMinor: 9_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-inactive',
              merchantName: 'Inactive Shop',
              merchantSlug: 'inactive-shop',
              priceMinor: 8_000,
              setId: '10316',
            }),
          ],
          setId: '10316',
        }),
      ],
      merchants: [
        activeMerchants[0],
        merchant({
          active: false,
          id: 'merchant-inactive',
          name: 'Inactive Shop',
          slug: 'inactive-shop',
        }),
      ],
    });

    expect(records.map((record) => record.merchantSlug)).toEqual([
      'goodbricks',
    ]);
    expect(records[0]?.snapshot.onlyAtMerchantDealCount).toBe(1);
  });

  test('keeps rakuten LEGO active while excluding inactive legacy merchants', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [catalogSet({ id: '10316' })],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              merchantId: 'merchant-rakuten-lego-eu',
              merchantName: 'LEGO',
              merchantSlug: 'rakuten-lego-eu',
              priceMinor: 9_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-lego-nl',
              merchantName: 'LEGO',
              merchantSlug: 'lego-nl',
              priceMinor: 8_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-top1toys',
              merchantName: 'Top1Toys',
              merchantSlug: 'top1toys',
              priceMinor: 7_500,
              setId: '10316',
            }),
          ],
          setId: '10316',
        }),
      ],
      merchants: [
        merchant({
          id: 'merchant-rakuten-lego-eu',
          name: 'LEGO',
          slug: 'rakuten-lego-eu',
        }),
        merchant({
          active: false,
          id: 'merchant-lego-nl',
          name: 'LEGO',
          slug: 'lego-nl',
        }),
        merchant({
          active: false,
          id: 'merchant-top1toys',
          name: 'Top1Toys',
          slug: 'top1toys',
        }),
      ],
    });

    expect(records.map((record) => record.merchantSlug)).toEqual([
      'rakuten-lego-eu',
    ]);
    expect(records[0]).toMatchObject({
      merchantName: 'LEGO®',
      merchantSlug: 'rakuten-lego-eu',
      snapshot: {
        dealCount: 1,
        merchant: {
          name: 'LEGO®',
          publicSlug: 'lego',
          slug: 'rakuten-lego-eu',
        },
        onlyAtMerchantDealCount: 1,
      },
    });
  });

  test('embeds Supabase merchant profile metadata while keeping the internal merchant slug', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [catalogSet({ id: '10316' })],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              merchantId: 'merchant-rakuten-lego-eu',
              merchantName: 'Rakuten LEGO EU',
              merchantSlug: 'rakuten-lego-eu',
              priceMinor: 9_000,
              setId: '10316',
            }),
          ],
          setId: '10316',
        }),
      ],
      merchantProfiles: [merchantProfile()],
      merchants: [
        merchant({
          id: 'merchant-rakuten-lego-eu',
          name: 'Rakuten LEGO EU',
          slug: 'rakuten-lego-eu',
        }),
      ],
    });

    expect(records[0]).toMatchObject({
      merchantName: 'LEGO®',
      merchantSlug: 'rakuten-lego-eu',
      snapshot: {
        merchant: {
          name: 'LEGO®',
          publicSlug: 'lego',
          seoPresentation: {
            seoDescription:
              'Supabase profieltekst voor de officiële LEGO winkel op Brickhunt.',
            seoTitle: 'LEGO profiel uit Supabase',
          },
          slug: 'rakuten-lego-eu',
        },
        onlyAtMerchantDeals: [
          {
            merchant: {
              name: 'LEGO®',
              publicSlug: 'lego',
              slug: 'rakuten-lego-eu',
            },
          },
        ],
      },
    });
  });

  test('excludes offers that are not in stock or do not have a positive price', () => {
    const records = buildCommerceMerchantPageSnapshotRecords({
      catalogSets: [catalogSet({ id: '10316' })],
      currentSnapshots: [
        currentSnapshot({
          offers: [
            snapshotOffer({
              availability: 'out_of_stock',
              merchantId: 'merchant-goodbricks',
              merchantName: 'Goodbricks',
              merchantSlug: 'goodbricks',
              priceMinor: 7_000,
              setId: '10316',
            }),
            snapshotOffer({
              merchantId: 'merchant-lego',
              merchantName: 'LEGO',
              merchantSlug: 'lego',
              priceMinor: 0,
              setId: '10316',
            }),
          ],
          setId: '10316',
        }),
      ],
      merchants: activeMerchants,
    });

    expect(records.every((record) => record.snapshot.dealCount === 0)).toBe(
      true,
    );
    expect(records.every((record) => record.snapshot.offerCount === 0)).toBe(
      true,
    );
  });
});
