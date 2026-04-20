import type { CatalogSetSummary } from '@lego-platform/catalog/util';
import type { PricingObservationSeed } from '@lego-platform/pricing/data-access-server';
import type { PriceHistoryPoint } from '@lego-platform/pricing/util';
import { describe, expect, test, vi } from 'vitest';

import {
  loadCommerceSyncInputs,
  resolveCommerceCatalogSetSummaries,
  runCommerceSync,
  type CommerceSyncDependencies,
} from '@lego-platform/api/data-access-server';

function createCatalogSetSummary(
  overrides: Partial<CatalogSetSummary> & Pick<CatalogSetSummary, 'id'>,
): CatalogSetSummary {
  return {
    id: overrides.id,
    slug: overrides.slug ?? `set-${overrides.id}`,
    name: overrides.name ?? `Set ${overrides.id}`,
    theme: overrides.theme ?? 'Icons',
    releaseYear: overrides.releaseYear ?? 2026,
    pieces: overrides.pieces ?? 1000,
    collectorAngle:
      overrides.collectorAngle ??
      'Deze set blijft hangen door een sterke display-uitstraling.',
    imageUrl: overrides.imageUrl,
    images: overrides.images,
    primaryImage: overrides.primaryImage,
  };
}

function createPricingObservation(
  overrides: Partial<PricingObservationSeed> &
    Pick<PricingObservationSeed, 'setId'>,
): PricingObservationSeed {
  return {
    setId: overrides.setId,
    merchantId: overrides.merchantId ?? 'bol',
    merchantProductUrl:
      overrides.merchantProductUrl ??
      `https://www.bol.com/nl/nl/p/set-${overrides.setId}/`,
    totalPriceMinor: overrides.totalPriceMinor ?? 19999,
    availability: overrides.availability ?? 'in_stock',
    observedAt: overrides.observedAt ?? '2026-04-19T10:00:00.000Z',
    regionCode: overrides.regionCode ?? 'NL',
    currencyCode: overrides.currencyCode ?? 'EUR',
    condition: overrides.condition ?? 'new',
  };
}

function createPriceHistoryPoint(
  overrides: Partial<PriceHistoryPoint> & Pick<PriceHistoryPoint, 'setId'>,
): PriceHistoryPoint {
  return {
    setId: overrides.setId,
    regionCode: overrides.regionCode ?? 'NL',
    currencyCode: overrides.currencyCode ?? 'EUR',
    condition: overrides.condition ?? 'new',
    headlinePriceMinor: overrides.headlinePriceMinor ?? 19999,
    lowestMerchantId: overrides.lowestMerchantId ?? 'bol',
    observedAt: overrides.observedAt ?? '2026-04-19T10:00:00.000Z',
    recordedOn: overrides.recordedOn ?? '2026-04-19',
    referencePriceMinor: overrides.referencePriceMinor ?? 21999,
  };
}

describe('commerce sync catalog validation', () => {
  test('accepts a set present in the current canonical catalog', async () => {
    const catalogSetSummary = createCatalogSetSummary({
      id: '72037',
      slug: 'mario-kart-set-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
      pieces: 1972,
    });

    await expect(
      resolveCommerceCatalogSetSummaries({
        setIds: [catalogSetSummary.id],
        listCatalogSetSummariesFn: async () => [catalogSetSummary],
      }),
    ).resolves.toEqual([catalogSetSummary]);
  });

  test('rejects a set missing from the current canonical catalog', async () => {
    await expect(
      resolveCommerceCatalogSetSummaries({
        setIds: ['72037'],
        listCatalogSetSummariesFn: async () => [],
      }),
    ).rejects.toThrow(
      'Commerce-enabled set 72037 is missing from the current canonical catalog.',
    );
  });

  test('returns current catalog metadata for commerce-enabled sets', async () => {
    const firstCatalogSetSummary = createCatalogSetSummary({
      id: '72037',
      slug: 'mario-kart-set-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
      pieces: 1972,
    });
    const secondCatalogSetSummary = createCatalogSetSummary({
      id: '10316',
      slug: 'rivendell-10316',
      name: 'Rivendell',
      theme: 'Icons',
      pieces: 6167,
      releaseYear: 2023,
      imageUrl: 'https://cdn.rebrickable.com/media/sets/10316-1/1000.jpg',
    });

    const resolvedSummaries = await resolveCommerceCatalogSetSummaries({
      setIds: [firstCatalogSetSummary.id, secondCatalogSetSummary.id],
      listCatalogSetSummariesFn: async () => [
        secondCatalogSetSummary,
        firstCatalogSetSummary,
      ],
    });

    expect(resolvedSummaries).toEqual([
      firstCatalogSetSummary,
      secondCatalogSetSummary,
    ]);
  });
});

describe('commerce sync scoped runs', () => {
  test('filters loaded sync inputs by requested set ids', async () => {
    const result = await loadCommerceSyncInputs({
      listActiveCommerceRefreshSeedsFn: vi.fn().mockResolvedValue([
        {
          merchant: {
            id: 'merchant-bol',
            slug: 'bol',
            name: 'bol',
            isActive: true,
            sourceType: 'affiliate',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-10316-bol',
            setId: '10316',
            merchantId: 'merchant-bol',
            productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
            latestOffer: {
              id: 'offer-10316-bol',
              offerSeedId: 'seed-10316-bol',
              setId: '10316',
              merchantId: 'merchant-bol',
              productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-04-19T10:00:00.000Z',
              observedAt: '2026-04-19T10:00:00.000Z',
              priceMinor: 42999,
              createdAt: '2026-04-19T10:00:00.000Z',
              updatedAt: '2026-04-19T10:00:00.000Z',
            },
          },
        },
        {
          merchant: {
            id: 'merchant-lego',
            slug: 'lego-nl',
            name: 'LEGO',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-76437-lego',
            setId: '76437',
            merchantId: 'merchant-lego',
            productUrl:
              'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
            latestOffer: {
              id: 'offer-76437-lego',
              offerSeedId: 'seed-76437-lego',
              setId: '76437',
              merchantId: 'merchant-lego',
              productUrl:
                'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-04-19T10:00:00.000Z',
              observedAt: '2026-04-19T10:00:00.000Z',
              priceMinor: 29999,
              createdAt: '2026-04-19T10:00:00.000Z',
              updatedAt: '2026-04-19T10:00:00.000Z',
            },
          },
        },
      ]),
      setIds: ['76437'],
    });

    expect(result.refreshSeeds).toHaveLength(1);
    expect(result.refreshSeeds[0]?.offerSeed.setId).toBe('76437');
    expect(result.syncInputs.enabledSetIds).toEqual(['76437']);
  });

  test('filters loaded sync inputs by requested merchant slugs', async () => {
    const listActiveCommerceRefreshSeedsFn = vi.fn().mockResolvedValue([
      {
        merchant: {
          id: 'merchant-bol',
          slug: 'bol',
          name: 'bol',
          isActive: true,
          sourceType: 'affiliate',
          notes: '',
          createdAt: '2026-04-19T10:00:00.000Z',
          updatedAt: '2026-04-19T10:00:00.000Z',
        },
        offerSeed: {
          id: 'seed-10316-bol',
          setId: '10316',
          merchantId: 'merchant-bol',
          productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-19T10:00:00.000Z',
          updatedAt: '2026-04-19T10:00:00.000Z',
          latestOffer: {
            id: 'offer-10316-bol',
            offerSeedId: 'seed-10316-bol',
            setId: '10316',
            merchantId: 'merchant-bol',
            productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            fetchedAt: '2026-04-19T10:00:00.000Z',
            observedAt: '2026-04-19T10:00:00.000Z',
            priceMinor: 42999,
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
        },
      },
      {
        merchant: {
          id: 'merchant-lego',
          slug: 'lego-nl',
          name: 'LEGO',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-19T10:00:00.000Z',
          updatedAt: '2026-04-19T10:00:00.000Z',
        },
        offerSeed: {
          id: 'seed-76437-lego',
          setId: '76437',
          merchantId: 'merchant-lego',
          productUrl:
            'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-19T10:00:00.000Z',
          updatedAt: '2026-04-19T10:00:00.000Z',
          latestOffer: {
            id: 'offer-76437-lego',
            offerSeedId: 'seed-76437-lego',
            setId: '76437',
            merchantId: 'merchant-lego',
            productUrl:
              'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            fetchedAt: '2026-04-19T10:00:00.000Z',
            observedAt: '2026-04-19T10:00:00.000Z',
            priceMinor: 29999,
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
        },
      },
    ]);

    const result = await loadCommerceSyncInputs({
      listActiveCommerceRefreshSeedsFn,
      merchantSlugs: ['lego-nl'],
    });

    expect(listActiveCommerceRefreshSeedsFn).toHaveBeenCalledWith({
      merchantSlugs: ['lego-nl'],
    });
    expect(result.refreshSeeds).toHaveLength(1);
    expect(result.refreshSeeds[0]?.merchant.slug).toBe('lego-nl');
    expect(result.syncInputs.enabledSetIds).toEqual(['76437']);
  });

  test('passes explicitly requested non-default refresh merchants through loadCommerceSyncInputs', async () => {
    const listActiveCommerceRefreshSeedsFn = vi.fn().mockResolvedValue([
      {
        merchant: {
          id: 'merchant-wehkamp',
          slug: 'wehkamp',
          name: 'Wehkamp',
          isActive: true,
          sourceType: 'direct',
          notes: '',
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
        offerSeed: {
          id: 'seed-21366-wehkamp',
          setId: '21366',
          merchantId: 'merchant-wehkamp',
          productUrl:
            'https://www.wehkamp.nl/lego-ideas-drijvende-zeeotters-bouwpakket-voor-volwassenen-21366-17517964/',
          isActive: true,
          validationStatus: 'valid',
          notes: '',
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
          latestOffer: {
            id: 'offer-21366-wehkamp',
            offerSeedId: 'seed-21366-wehkamp',
            setId: '21366',
            merchantId: 'merchant-wehkamp',
            productUrl:
              'https://www.wehkamp.nl/lego-ideas-drijvende-zeeotters-bouwpakket-voor-volwassenen-21366-17517964/',
            fetchStatus: 'success',
            availability: 'in_stock',
            currencyCode: 'EUR',
            fetchedAt: '2026-04-20T10:00:00.000Z',
            observedAt: '2026-04-20T10:00:00.000Z',
            priceMinor: 7999,
            createdAt: '2026-04-20T10:00:00.000Z',
            updatedAt: '2026-04-20T10:00:00.000Z',
          },
        },
      },
    ]);

    const result = await loadCommerceSyncInputs({
      listActiveCommerceRefreshSeedsFn,
      merchantSlugs: ['wehkamp'],
      setIds: ['21366'],
    });

    expect(listActiveCommerceRefreshSeedsFn).toHaveBeenCalledWith({
      merchantSlugs: ['wehkamp'],
    });
    expect(result.refreshSeeds).toHaveLength(1);
    expect(result.refreshSeeds[0]?.merchant.slug).toBe('wehkamp');
    expect(result.syncInputs.enabledSetIds).toEqual(['21366']);
  });

  test('combines requested set ids and merchant slugs when loading sync inputs', async () => {
    const result = await loadCommerceSyncInputs({
      listActiveCommerceRefreshSeedsFn: vi.fn().mockResolvedValue([
        {
          merchant: {
            id: 'merchant-bol',
            slug: 'bol',
            name: 'bol',
            isActive: true,
            sourceType: 'affiliate',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-10316-bol',
            setId: '10316',
            merchantId: 'merchant-bol',
            productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
            latestOffer: {
              id: 'offer-10316-bol',
              offerSeedId: 'seed-10316-bol',
              setId: '10316',
              merchantId: 'merchant-bol',
              productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-04-19T10:00:00.000Z',
              observedAt: '2026-04-19T10:00:00.000Z',
              priceMinor: 42999,
              createdAt: '2026-04-19T10:00:00.000Z',
              updatedAt: '2026-04-19T10:00:00.000Z',
            },
          },
        },
        {
          merchant: {
            id: 'merchant-lego',
            slug: 'lego-nl',
            name: 'LEGO',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-10316-lego',
            setId: '10316',
            merchantId: 'merchant-lego',
            productUrl: 'https://www.lego.com/nl-nl/product/rivendell-10316',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
            latestOffer: {
              id: 'offer-10316-lego',
              offerSeedId: 'seed-10316-lego',
              setId: '10316',
              merchantId: 'merchant-lego',
              productUrl: 'https://www.lego.com/nl-nl/product/rivendell-10316',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-04-19T10:00:00.000Z',
              observedAt: '2026-04-19T10:00:00.000Z',
              priceMinor: 43999,
              createdAt: '2026-04-19T10:00:00.000Z',
              updatedAt: '2026-04-19T10:00:00.000Z',
            },
          },
        },
        {
          merchant: {
            id: 'merchant-lego',
            slug: 'lego-nl',
            name: 'LEGO',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-76437-lego',
            setId: '76437',
            merchantId: 'merchant-lego',
            productUrl:
              'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
            latestOffer: {
              id: 'offer-76437-lego',
              offerSeedId: 'seed-76437-lego',
              setId: '76437',
              merchantId: 'merchant-lego',
              productUrl:
                'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-04-19T10:00:00.000Z',
              observedAt: '2026-04-19T10:00:00.000Z',
              priceMinor: 29999,
              createdAt: '2026-04-19T10:00:00.000Z',
              updatedAt: '2026-04-19T10:00:00.000Z',
            },
          },
        },
      ]),
      merchantSlugs: ['lego-nl'],
      setIds: ['10316'],
    });

    expect(result.refreshSeeds).toHaveLength(1);
    expect(result.refreshSeeds[0]?.offerSeed.setId).toBe('10316');
    expect(result.refreshSeeds[0]?.merchant.slug).toBe('lego-nl');
    expect(result.syncInputs.enabledSetIds).toEqual(['10316']);
  });

  test('keeps default sync inputs unchanged without a merchant filter', async () => {
    const result = await loadCommerceSyncInputs({
      listActiveCommerceRefreshSeedsFn: vi.fn().mockResolvedValue([
        {
          merchant: {
            id: 'merchant-bol',
            slug: 'bol',
            name: 'bol',
            isActive: true,
            sourceType: 'affiliate',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-10316-bol',
            setId: '10316',
            merchantId: 'merchant-bol',
            productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
            latestOffer: {
              id: 'offer-10316-bol',
              offerSeedId: 'seed-10316-bol',
              setId: '10316',
              merchantId: 'merchant-bol',
              productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-04-19T10:00:00.000Z',
              observedAt: '2026-04-19T10:00:00.000Z',
              priceMinor: 42999,
              createdAt: '2026-04-19T10:00:00.000Z',
              updatedAt: '2026-04-19T10:00:00.000Z',
            },
          },
        },
        {
          merchant: {
            id: 'merchant-lego',
            slug: 'lego-nl',
            name: 'LEGO',
            isActive: true,
            sourceType: 'direct',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
          },
          offerSeed: {
            id: 'seed-76437-lego',
            setId: '76437',
            merchantId: 'merchant-lego',
            productUrl:
              'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
            isActive: true,
            validationStatus: 'valid',
            notes: '',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
            latestOffer: {
              id: 'offer-76437-lego',
              offerSeedId: 'seed-76437-lego',
              setId: '76437',
              merchantId: 'merchant-lego',
              productUrl:
                'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
              fetchStatus: 'success',
              availability: 'in_stock',
              currencyCode: 'EUR',
              fetchedAt: '2026-04-19T10:00:00.000Z',
              observedAt: '2026-04-19T10:00:00.000Z',
              priceMinor: 29999,
              createdAt: '2026-04-19T10:00:00.000Z',
              updatedAt: '2026-04-19T10:00:00.000Z',
            },
          },
        },
      ]),
    });

    expect(result.refreshSeeds).toHaveLength(2);
    expect(result.syncInputs.enabledSetIds).toEqual(['10316', '76437']);
  });

  test('passes scoped set ids through refresh loading and reports subset metrics', async () => {
    const loadCommerceSyncInputsFn = vi
      .fn<NonNullable<CommerceSyncDependencies['loadCommerceSyncInputsFn']>>()
      .mockImplementation(async ({ setIds } = {}) => ({
        refreshSeeds: setIds?.includes('10316')
          ? [
              {
                merchant: {
                  id: 'merchant-bol',
                  slug: 'bol',
                  name: 'bol',
                  isActive: true,
                  sourceType: 'affiliate',
                  notes: '',
                  createdAt: '2026-04-19T10:00:00.000Z',
                  updatedAt: '2026-04-19T10:00:00.000Z',
                },
                offerSeed: {
                  id: 'seed-10316-bol',
                  setId: '10316',
                  merchantId: 'merchant-bol',
                  productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
                  isActive: true,
                  validationStatus: 'valid',
                  notes: '',
                  createdAt: '2026-04-19T10:00:00.000Z',
                  updatedAt: '2026-04-19T10:00:00.000Z',
                  latestOffer: {
                    id: 'offer-10316-bol',
                    offerSeedId: 'seed-10316-bol',
                    setId: '10316',
                    merchantId: 'merchant-bol',
                    productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
                    fetchStatus: 'success',
                    availability: 'in_stock',
                    currencyCode: 'EUR',
                    fetchedAt: '2026-04-19T10:00:00.000Z',
                    observedAt: '2026-04-19T10:00:00.000Z',
                    priceMinor: 42999,
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                  },
                  merchant: {
                    id: 'merchant-bol',
                    slug: 'bol',
                    name: 'bol',
                    isActive: true,
                    sourceType: 'affiliate',
                    notes: '',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                  },
                },
              },
            ]
          : [
              {
                merchant: {
                  id: 'merchant-bol',
                  slug: 'bol',
                  name: 'bol',
                  isActive: true,
                  sourceType: 'affiliate',
                  notes: '',
                  createdAt: '2026-04-19T10:00:00.000Z',
                  updatedAt: '2026-04-19T10:00:00.000Z',
                },
                offerSeed: {
                  id: 'seed-10316-bol',
                  setId: '10316',
                  merchantId: 'merchant-bol',
                  productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
                  isActive: true,
                  validationStatus: 'valid',
                  notes: '',
                  createdAt: '2026-04-19T10:00:00.000Z',
                  updatedAt: '2026-04-19T10:00:00.000Z',
                },
              },
              {
                merchant: {
                  id: 'merchant-lego',
                  slug: 'lego-nl',
                  name: 'LEGO',
                  isActive: true,
                  sourceType: 'direct',
                  notes: '',
                  createdAt: '2026-04-19T10:00:00.000Z',
                  updatedAt: '2026-04-19T10:00:00.000Z',
                },
                offerSeed: {
                  id: 'seed-76437-lego',
                  setId: '76437',
                  merchantId: 'merchant-lego',
                  productUrl:
                    'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
                  isActive: true,
                  validationStatus: 'valid',
                  notes: '',
                  createdAt: '2026-04-19T10:00:00.000Z',
                  updatedAt: '2026-04-19T10:00:00.000Z',
                },
              },
            ],
        syncInputs: setIds?.includes('10316')
          ? {
              activeMerchantCount: 1,
              affiliateMerchantConfigs: [
                {
                  merchantId: 'bol',
                  displayName: 'bol',
                  regionCode: 'NL',
                  currencyCode: 'EUR',
                  enabled: true,
                  displayRank: 1,
                  urlHost: 'bol.com',
                  disclosureCopy: 'Direct merchant link.',
                  ctaLabel: 'Bekijk bij bol',
                },
              ],
              enabledSetIds: ['10316'],
              merchantSummaries: [
                {
                  merchantId: 'bol',
                  displayName: 'bol',
                },
              ],
              pricingObservationSeeds: [
                createPricingObservation({
                  setId: '10316',
                  merchantId: 'bol',
                  totalPriceMinor: 42999,
                }),
              ],
            }
          : {
              activeMerchantCount: 2,
              affiliateMerchantConfigs: [
                {
                  merchantId: 'bol',
                  displayName: 'bol',
                  regionCode: 'NL',
                  currencyCode: 'EUR',
                  enabled: true,
                  displayRank: 1,
                  urlHost: 'bol.com',
                  disclosureCopy: 'Direct merchant link.',
                  ctaLabel: 'Bekijk bij bol',
                },
                {
                  merchantId: 'lego-nl',
                  displayName: 'LEGO',
                  regionCode: 'NL',
                  currencyCode: 'EUR',
                  enabled: true,
                  displayRank: 2,
                  urlHost: 'lego.com',
                  disclosureCopy: 'Direct merchant link.',
                  ctaLabel: 'Bekijk bij LEGO',
                },
              ],
              enabledSetIds: ['10316', '76437'],
              merchantSummaries: [
                {
                  merchantId: 'bol',
                  displayName: 'bol',
                },
                {
                  merchantId: 'lego-nl',
                  displayName: 'LEGO',
                },
              ],
              pricingObservationSeeds: [
                createPricingObservation({
                  setId: '10316',
                  merchantId: 'bol',
                  totalPriceMinor: 42999,
                }),
                createPricingObservation({
                  setId: '76437',
                  merchantId: 'lego-nl',
                  merchantProductUrl:
                    'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
                  totalPriceMinor: 29999,
                }),
              ],
            },
      }));
    const refreshCommerceOfferSeedsFn = vi
      .fn<
        NonNullable<CommerceSyncDependencies['refreshCommerceOfferSeedsFn']>
      >()
      .mockResolvedValue({
        totalCount: 1,
        successCount: 1,
        unavailableCount: 0,
        invalidCount: 0,
        staleCount: 0,
      });
    const writePricingGeneratedArtifactsFn = vi
      .fn<
        NonNullable<
          CommerceSyncDependencies['writePricingGeneratedArtifactsFn']
        >
      >()
      .mockResolvedValue({
        isClean: true,
        manifestPath: '/tmp/brickhunt/pricing-sync-manifest.generated.ts',
        observationsPath: '/tmp/brickhunt/pricing-observations.generated.ts',
        panelSnapshotsPath: '/tmp/brickhunt/price-panel-snapshots.generated.ts',
        stalePaths: [],
      });
    const writeAffiliateGeneratedArtifactsFn = vi
      .fn<
        NonNullable<
          CommerceSyncDependencies['writeAffiliateGeneratedArtifactsFn']
        >
      >()
      .mockResolvedValue({
        isClean: true,
        manifestPath: '/tmp/brickhunt/affiliate-sync-manifest.generated.ts',
        offersPath: '/tmp/brickhunt/affiliate-offers.generated.ts',
        stalePaths: [],
      });
    const upsertDailyPriceHistoryPointsFn = vi
      .fn<
        NonNullable<CommerceSyncDependencies['upsertDailyPriceHistoryPointsFn']>
      >()
      .mockResolvedValue([createPriceHistoryPoint({ setId: '10316' })]);

    const result = await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: async () => [
          createCatalogSetSummary({ id: '10316' }),
          createCatalogSetSummary({ id: '76437' }),
        ],
        loadCommerceSyncInputsFn,
        refreshCommerceOfferSeedsFn,
        upsertDailyPriceHistoryPointsFn,
        writeAffiliateGeneratedArtifactsFn,
        writePricingGeneratedArtifactsFn,
      },
      mode: 'write',
      setIds: ['10316'],
      workspaceRoot: '/tmp/brickhunt',
    });

    expect(loadCommerceSyncInputsFn).toHaveBeenNthCalledWith(1, {
      setIds: ['10316'],
    });
    expect(loadCommerceSyncInputsFn).toHaveBeenNthCalledWith(2, {
      setIds: ['10316'],
    });
    expect(loadCommerceSyncInputsFn).toHaveBeenNthCalledWith(3);
    expect(refreshCommerceOfferSeedsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshSeeds: expect.arrayContaining([
          expect.objectContaining({
            offerSeed: expect.objectContaining({
              setId: '10316',
            }),
          }),
        ]),
      }),
    );
    expect(result).toMatchObject({
      scoped: true,
      scopedSetIds: ['10316'],
      enabledSetCount: 1,
      pricePanelSnapshotCount: 1,
      pricingObservationCount: 1,
      affiliateOfferCount: 1,
      merchantCount: 1,
      refreshSuccessCount: 1,
      refreshStaleCount: 0,
    });
    expect(writePricingGeneratedArtifactsFn).toHaveBeenCalledTimes(1);
    expect(writeAffiliateGeneratedArtifactsFn).toHaveBeenCalledTimes(1);
  });

  test('passes merchant slugs through refresh loading and keeps default full-write behavior intact', async () => {
    const loadCommerceSyncInputsFn = vi
      .fn<NonNullable<CommerceSyncDependencies['loadCommerceSyncInputsFn']>>()
      .mockImplementation(async ({ merchantSlugs, setIds } = {}) => ({
        refreshSeeds:
          merchantSlugs?.includes('lego-nl') && setIds?.includes('76437')
            ? [
                {
                  merchant: {
                    id: 'merchant-lego',
                    slug: 'lego-nl',
                    name: 'LEGO',
                    isActive: true,
                    sourceType: 'direct',
                    notes: '',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                  },
                  offerSeed: {
                    id: 'seed-76437-lego',
                    setId: '76437',
                    merchantId: 'merchant-lego',
                    productUrl:
                      'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
                    isActive: true,
                    validationStatus: 'valid',
                    notes: '',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                    latestOffer: {
                      id: 'offer-76437-lego',
                      offerSeedId: 'seed-76437-lego',
                      setId: '76437',
                      merchantId: 'merchant-lego',
                      productUrl:
                        'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
                      fetchStatus: 'success',
                      availability: 'in_stock',
                      currencyCode: 'EUR',
                      fetchedAt: '2026-04-19T10:00:00.000Z',
                      observedAt: '2026-04-19T10:00:00.000Z',
                      priceMinor: 29999,
                      createdAt: '2026-04-19T10:00:00.000Z',
                      updatedAt: '2026-04-19T10:00:00.000Z',
                    },
                  },
                },
              ]
            : [
                {
                  merchant: {
                    id: 'merchant-bol',
                    slug: 'bol',
                    name: 'bol',
                    isActive: true,
                    sourceType: 'affiliate',
                    notes: '',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                  },
                  offerSeed: {
                    id: 'seed-10316-bol',
                    setId: '10316',
                    merchantId: 'merchant-bol',
                    productUrl: 'https://www.bol.com/nl/nl/p/rivendell-10316/',
                    isActive: true,
                    validationStatus: 'valid',
                    notes: '',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                  },
                },
                {
                  merchant: {
                    id: 'merchant-lego',
                    slug: 'lego-nl',
                    name: 'LEGO',
                    isActive: true,
                    sourceType: 'direct',
                    notes: '',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                  },
                  offerSeed: {
                    id: 'seed-76437-lego',
                    setId: '76437',
                    merchantId: 'merchant-lego',
                    productUrl:
                      'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
                    isActive: true,
                    validationStatus: 'valid',
                    notes: '',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                  },
                },
              ],
        syncInputs:
          merchantSlugs?.includes('lego-nl') && setIds?.includes('76437')
            ? {
                activeMerchantCount: 1,
                affiliateMerchantConfigs: [
                  {
                    merchantId: 'lego-nl',
                    displayName: 'LEGO',
                    regionCode: 'NL',
                    currencyCode: 'EUR',
                    enabled: true,
                    displayRank: 1,
                    urlHost: 'lego.com',
                    disclosureCopy: 'Direct merchant link.',
                    ctaLabel: 'Bekijk bij LEGO',
                  },
                ],
                enabledSetIds: ['76437'],
                merchantSummaries: [
                  {
                    merchantId: 'lego-nl',
                    displayName: 'LEGO',
                  },
                ],
                pricingObservationSeeds: [
                  createPricingObservation({
                    setId: '76437',
                    merchantId: 'lego-nl',
                    merchantProductUrl:
                      'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
                    totalPriceMinor: 29999,
                  }),
                ],
              }
            : {
                activeMerchantCount: 2,
                affiliateMerchantConfigs: [
                  {
                    merchantId: 'bol',
                    displayName: 'bol',
                    regionCode: 'NL',
                    currencyCode: 'EUR',
                    enabled: true,
                    displayRank: 1,
                    urlHost: 'bol.com',
                    disclosureCopy: 'Direct merchant link.',
                    ctaLabel: 'Bekijk bij bol',
                  },
                  {
                    merchantId: 'lego-nl',
                    displayName: 'LEGO',
                    regionCode: 'NL',
                    currencyCode: 'EUR',
                    enabled: true,
                    displayRank: 2,
                    urlHost: 'lego.com',
                    disclosureCopy: 'Direct merchant link.',
                    ctaLabel: 'Bekijk bij LEGO',
                  },
                ],
                enabledSetIds: ['10316', '76437'],
                merchantSummaries: [
                  {
                    merchantId: 'bol',
                    displayName: 'bol',
                  },
                  {
                    merchantId: 'lego-nl',
                    displayName: 'LEGO',
                  },
                ],
                pricingObservationSeeds: [
                  createPricingObservation({
                    setId: '10316',
                    merchantId: 'bol',
                    totalPriceMinor: 42999,
                  }),
                  createPricingObservation({
                    setId: '76437',
                    merchantId: 'lego-nl',
                    merchantProductUrl:
                      'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
                    totalPriceMinor: 29999,
                  }),
                ],
              },
      }));
    const refreshCommerceOfferSeedsFn = vi
      .fn<
        NonNullable<CommerceSyncDependencies['refreshCommerceOfferSeedsFn']>
      >()
      .mockResolvedValue({
        totalCount: 1,
        successCount: 1,
        unavailableCount: 0,
        invalidCount: 0,
        staleCount: 0,
      });
    const writePricingGeneratedArtifactsFn = vi
      .fn<
        NonNullable<
          CommerceSyncDependencies['writePricingGeneratedArtifactsFn']
        >
      >()
      .mockResolvedValue({
        isClean: true,
        manifestPath: '/tmp/brickhunt/pricing-sync-manifest.generated.ts',
        observationsPath: '/tmp/brickhunt/pricing-observations.generated.ts',
        panelSnapshotsPath: '/tmp/brickhunt/price-panel-snapshots.generated.ts',
        stalePaths: [],
      });
    const writeAffiliateGeneratedArtifactsFn = vi
      .fn<
        NonNullable<
          CommerceSyncDependencies['writeAffiliateGeneratedArtifactsFn']
        >
      >()
      .mockResolvedValue({
        isClean: true,
        manifestPath: '/tmp/brickhunt/affiliate-sync-manifest.generated.ts',
        offersPath: '/tmp/brickhunt/affiliate-offers.generated.ts',
        stalePaths: [],
      });
    const upsertDailyPriceHistoryPointsFn = vi
      .fn<
        NonNullable<CommerceSyncDependencies['upsertDailyPriceHistoryPointsFn']>
      >()
      .mockResolvedValue([createPriceHistoryPoint({ setId: '76437' })]);

    const result = await runCommerceSync({
      dependencies: {
        listCatalogSetSummariesFn: async () => [
          createCatalogSetSummary({ id: '10316' }),
          createCatalogSetSummary({ id: '76437' }),
        ],
        loadCommerceSyncInputsFn,
        refreshCommerceOfferSeedsFn,
        upsertDailyPriceHistoryPointsFn,
        writeAffiliateGeneratedArtifactsFn,
        writePricingGeneratedArtifactsFn,
      },
      merchantSlugs: ['lego-nl'],
      mode: 'write',
      setIds: ['76437'],
      workspaceRoot: '/tmp/brickhunt',
    });

    expect(loadCommerceSyncInputsFn).toHaveBeenNthCalledWith(1, {
      merchantSlugs: ['lego-nl'],
      setIds: ['76437'],
    });
    expect(loadCommerceSyncInputsFn).toHaveBeenNthCalledWith(2, {
      merchantSlugs: ['lego-nl'],
      setIds: ['76437'],
    });
    expect(refreshCommerceOfferSeedsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshSeeds: expect.arrayContaining([
          expect.objectContaining({
            merchant: expect.objectContaining({
              slug: 'lego-nl',
            }),
            offerSeed: expect.objectContaining({
              setId: '76437',
            }),
          }),
        ]),
      }),
    );
    expect(result).toMatchObject({
      scoped: true,
      scopedMerchantSlugs: ['lego-nl'],
      scopedSetIds: ['76437'],
      enabledSetCount: 1,
      merchantCount: 1,
      refreshSuccessCount: 1,
    });
  });
});
