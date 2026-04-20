import { describe, expect, test, vi } from 'vitest';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import type {
  CommerceMerchant,
  CommerceOfferSeed,
} from '@lego-platform/commerce/util';
import { buildGeneratedCommerceSeedCandidateNote } from '@lego-platform/commerce/util';
import {
  generateCommerceOfferSeedCandidates,
  listCommercePrimaryCoverageGapAudit,
  listCommercePrimaryCoverageReport,
  validateGeneratedCommerceOfferSeedCandidates,
} from './commerce-seed-generation-data-access-server';

const baseCatalogSet: CatalogCanonicalSet = {
  createdAt: '2026-04-19T08:00:00.000Z',
  imageUrl: 'https://cdn.rebrickable.com/media/sets/76437-1/1000.jpg',
  name: 'The Burrow – Collectors’ Edition',
  pieceCount: 2405,
  primaryTheme: 'Harry Potter',
  releaseYear: 2026,
  secondaryLabels: [],
  setId: '76437',
  slug: 'the-burrow-collectors-edition-76437',
  source: 'rebrickable',
  sourceSetNumber: '76437-1',
  status: 'active',
  updatedAt: '2026-04-19T08:00:00.000Z',
};

const retiredCatalogSet: CatalogCanonicalSet = {
  ...baseCatalogSet,
  setId: '70728',
  slug: 'battle-for-ninjago-city-70728',
  sourceSetNumber: '70728-1',
  name: 'Battle for NINJAGO City',
  primaryTheme: 'NINJAGO',
  pieceCount: 1223,
};

const activeMerchants: CommerceMerchant[] = [
  {
    id: 'merchant-intertoys',
    slug: 'intertoys',
    name: 'Intertoys',
    isActive: true,
    sourceType: 'direct',
    notes: '',
    createdAt: '2026-04-19T08:00:00.000Z',
    updatedAt: '2026-04-19T08:00:00.000Z',
  },
  {
    id: 'merchant-lego',
    slug: 'lego-nl',
    name: 'LEGO',
    isActive: true,
    sourceType: 'direct',
    notes: '',
    createdAt: '2026-04-19T08:00:00.000Z',
    updatedAt: '2026-04-19T08:00:00.000Z',
  },
  {
    id: 'merchant-bol',
    slug: 'bol',
    name: 'bol',
    isActive: true,
    sourceType: 'direct',
    notes: '',
    createdAt: '2026-04-19T08:00:00.000Z',
    updatedAt: '2026-04-19T08:00:00.000Z',
  },
  {
    id: 'merchant-misterbricks',
    slug: 'misterbricks',
    name: 'MisterBricks',
    isActive: true,
    sourceType: 'direct',
    notes: '',
    createdAt: '2026-04-19T08:00:00.000Z',
    updatedAt: '2026-04-19T08:00:00.000Z',
  },
];

const kruidvatMerchant: CommerceMerchant = {
  id: 'merchant-kruidvat',
  slug: 'kruidvat',
  name: 'Kruidvat',
  isActive: true,
  sourceType: 'direct',
  notes: '',
  createdAt: '2026-04-19T08:00:00.000Z',
  updatedAt: '2026-04-19T08:00:00.000Z',
};

const wehkampMerchant: CommerceMerchant = {
  id: 'merchant-wehkamp',
  slug: 'wehkamp',
  name: 'Wehkamp',
  isActive: true,
  sourceType: 'direct',
  notes: '',
  createdAt: '2026-04-19T08:00:00.000Z',
  updatedAt: '2026-04-19T08:00:00.000Z',
};

describe('commerce seed generation data access server', () => {
  test('defaults generation to primary merchants and only includes blocked merchants when explicitly requested', async () => {
    const merchants: CommerceMerchant[] = [
      ...activeMerchants,
      {
        id: 'merchant-top1toys',
        slug: 'top1toys',
        name: 'Top1Toys',
        isActive: true,
        sourceType: 'direct',
        notes: '',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
      },
      {
        id: 'merchant-amazon',
        slug: 'amazon-nl',
        name: 'Amazon',
        isActive: true,
        sourceType: 'affiliate',
        notes: '',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
      },
    ];

    const defaultSummary = await generateCommerceOfferSeedCandidates({
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => merchants),
      listCommerceOfferSeedsFn: vi.fn(async () => []),
    });

    expect(defaultSummary.supportedMerchantSlugs).toEqual([
      'intertoys',
      'lego-nl',
      'bol',
      'misterbricks',
    ]);

    const explicitBlockedSummary = await generateCommerceOfferSeedCandidates({
      filters: {
        merchantSlugs: ['amazon-nl'],
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => merchants),
      listCommerceOfferSeedsFn: vi.fn(async () => []),
    });

    expect(explicitBlockedSummary.supportedMerchantSlugs).toEqual([
      'amazon-nl',
    ]);
  });

  test('reports primary coverage gaps and supports deterministic batch selection', async () => {
    const secondaryCatalogSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10316',
      slug: 'rivendell-10316',
      sourceSetNumber: '10316-1',
      name: 'Rivendell',
      primaryTheme: 'Icons',
      pieceCount: 6167,
    };
    const thirdCatalogSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '21061',
      slug: 'notre-dame-de-paris-21061',
      sourceSetNumber: '21061-1',
      name: 'Notre-Dame de Paris',
      primaryTheme: 'Architecture',
      pieceCount: 4383,
    };
    const coverageMerchants: CommerceMerchant[] = [
      ...activeMerchants,
      {
        id: 'merchant-top1toys',
        slug: 'top1toys',
        name: 'Top1Toys',
        isActive: true,
        sourceType: 'direct',
        notes: '',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
      },
    ];
    const coverageSeeds: CommerceOfferSeed[] = [
      {
        id: 'seed-10316-lego',
        setId: '10316',
        merchantId: 'merchant-lego',
        productUrl: 'https://www.lego.com/rivendell',
        isActive: false,
        validationStatus: 'pending',
        notes: buildGeneratedCommerceSeedCandidateNote({
          merchantSlug: 'lego-nl',
          setId: '10316',
        }),
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: coverageMerchants[1],
      },
      {
        id: 'seed-21061-lego',
        setId: '21061',
        merchantId: 'merchant-lego',
        productUrl: 'https://www.lego.com/notre-dame',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: coverageMerchants[1],
        latestOffer: {
          id: 'offer-21061-lego',
          offerSeedId: 'seed-21061-lego',
          setId: '21061',
          merchantId: 'merchant-lego',
          productUrl: 'https://www.lego.com/notre-dame',
          fetchStatus: 'success',
          priceMinor: 22999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
    ];

    const summary = await listCommercePrimaryCoverageReport({
      filters: {
        primaryCoverageStatus: 'no_primary_seeds',
        batchSize: 1,
        batchIndex: 0,
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        secondaryCatalogSet,
        baseCatalogSet,
        thirdCatalogSet,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => coverageMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => coverageSeeds),
    });

    expect(summary.primaryMerchantSlugs).toEqual([
      'bol',
      'intertoys',
      'lego-nl',
      'misterbricks',
    ]);
    expect(summary.totalSetCount).toBe(3);
    expect(summary.noPrimarySeedsCount).toBe(1);
    expect(summary.noValidPrimaryOffersCount).toBe(1);
    expect(summary.partialPrimaryCoverageCount).toBe(1);
    expect(summary.fullPrimaryCoverageCount).toBe(0);
    expect(summary.selectedSetCount).toBe(1);
    expect(summary.rows.map((row) => row.setId)).toEqual(['76437']);
  });

  test('excludes retired sets from default coverage metrics and batch selection, but includes them when explicitly requested', async () => {
    const summary = await listCommercePrimaryCoverageReport({
      filters: {
        primaryCoverageStatus: 'no_primary_seeds',
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        retiredCatalogSet,
        baseCatalogSet,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => []),
    });

    expect(summary.totalSetCount).toBe(1);
    expect(summary.noPrimarySeedsCount).toBe(1);
    expect(summary.rows.map((row) => row.setId)).toEqual(['76437']);

    const includedSummary = await listCommercePrimaryCoverageReport({
      filters: {
        includeNonActive: true,
        primaryCoverageStatus: 'no_primary_seeds',
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        retiredCatalogSet,
        baseCatalogSet,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => []),
    });

    expect(includedSummary.totalSetCount).toBe(2);
    expect(includedSummary.noPrimarySeedsCount).toBe(2);
    expect(includedSummary.rows.map((row) => row.setId)).toEqual([
      '70728',
      '76437',
    ]);
  });

  test('still allows direct set-id targeting for a retired set', async () => {
    const createCommerceOfferSeedFn = vi.fn(async () => undefined as never);

    const summary = await generateCommerceOfferSeedCandidates({
      filters: {
        setIds: ['70728'],
      },
      write: true,
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        retiredCatalogSet,
        baseCatalogSet,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => []),
      createCommerceOfferSeedFn,
    });

    expect(summary.candidateCount).toBe(4);
    expect(createCommerceOfferSeedFn).toHaveBeenCalledTimes(4);
    expect(
      createCommerceOfferSeedFn.mock.calls.every(
        (call) => call[0].input.setId === '70728',
      ),
    ).toBe(true);
  });

  test('audits actionable partial-coverage gaps with aggregate merchant and gap summaries', async () => {
    const partialSetWithMissingSeed: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '76437',
      slug: 'the-burrow-collectors-edition-76437',
      sourceSetNumber: '76437-1',
      name: 'The Burrow – Collectors’ Edition',
      primaryTheme: 'Harry Potter',
    };
    const partialSetWithRefreshGap: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10316',
      slug: 'rivendell-10316',
      sourceSetNumber: '10316-1',
      name: 'Rivendell',
      primaryTheme: 'Icons',
      pieceCount: 6167,
    };
    const fullCoverageSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '21061',
      slug: 'notre-dame-de-paris-21061',
      sourceSetNumber: '21061-1',
      name: 'Notre-Dame de Paris',
      primaryTheme: 'Architecture',
      pieceCount: 4383,
    };
    const coverageSeeds: CommerceOfferSeed[] = [
      {
        id: 'seed-76437-intertoys',
        setId: '76437',
        merchantId: 'merchant-intertoys',
        productUrl: 'https://www.intertoys.nl/76437',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[0],
        latestOffer: {
          id: 'offer-76437-intertoys',
          offerSeedId: 'seed-76437-intertoys',
          setId: '76437',
          merchantId: 'merchant-intertoys',
          productUrl: 'https://www.intertoys.nl/76437',
          fetchStatus: 'success',
          priceMinor: 25999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-76437-lego',
        setId: '76437',
        merchantId: 'merchant-lego',
        productUrl:
          'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[1],
        latestOffer: {
          id: 'offer-76437-lego',
          offerSeedId: 'seed-76437-lego',
          setId: '76437',
          merchantId: 'merchant-lego',
          productUrl:
            'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
          fetchStatus: 'success',
          priceMinor: 25999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-76437-bol',
        setId: '76437',
        merchantId: 'merchant-bol',
        productUrl:
          'https://www.bol.com/nl/nl/p/lego-harry-potter-het-nest-verzameleditie/9300000188627176/',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[2],
        latestOffer: {
          id: 'offer-76437-bol',
          offerSeedId: 'seed-76437-bol',
          setId: '76437',
          merchantId: 'merchant-bol',
          productUrl:
            'https://www.bol.com/nl/nl/p/lego-harry-potter-het-nest-verzameleditie/9300000188627176/',
          fetchStatus: 'success',
          priceMinor: 24999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-10316-intertoys',
        setId: '10316',
        merchantId: 'merchant-intertoys',
        productUrl: 'https://www.intertoys.nl/10316',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[0],
        latestOffer: {
          id: 'offer-10316-intertoys',
          offerSeedId: 'seed-10316-intertoys',
          setId: '10316',
          merchantId: 'merchant-intertoys',
          productUrl: 'https://www.intertoys.nl/10316',
          fetchStatus: 'success',
          priceMinor: 44999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-10316-lego',
        setId: '10316',
        merchantId: 'merchant-lego',
        productUrl: 'https://www.lego.com/nl-nl/product/rivendell-10316',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[1],
        latestOffer: {
          id: 'offer-10316-lego',
          offerSeedId: 'seed-10316-lego',
          setId: '10316',
          merchantId: 'merchant-lego',
          productUrl: 'https://www.lego.com/nl-nl/product/rivendell-10316',
          fetchStatus: 'error',
          errorMessage:
            'Main offer block did not expose a usable price or stock signal.',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-10316-bol',
        setId: '10316',
        merchantId: 'merchant-bol',
        productUrl: 'https://www.bol.com/nl/nl/s/?searchtext=10316',
        isActive: false,
        validationStatus: 'stale',
        notes: buildGeneratedCommerceSeedCandidateNote({
          merchantSlug: 'bol',
          setId: '10316',
        }),
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:30:00.000Z',
        merchant: activeMerchants[2],
        latestOffer: {
          id: 'offer-10316-bol',
          offerSeedId: 'seed-10316-bol',
          setId: '10316',
          merchantId: 'merchant-bol',
          productUrl: 'https://www.bol.com/nl/nl/s/?searchtext=10316',
          fetchStatus: 'error',
          errorMessage: 'Main offer state was ambiguous.',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-10316-misterbricks',
        setId: '10316',
        merchantId: 'merchant-misterbricks',
        productUrl: 'https://misterbricks.nl/rivendell-10316',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[3],
        latestOffer: {
          id: 'offer-10316-misterbricks',
          offerSeedId: 'seed-10316-misterbricks',
          setId: '10316',
          merchantId: 'merchant-misterbricks',
          productUrl: 'https://misterbricks.nl/rivendell-10316',
          fetchStatus: 'success',
          priceMinor: 43999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-21061-intertoys',
        setId: '21061',
        merchantId: 'merchant-intertoys',
        productUrl: 'https://www.intertoys.nl/21061',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[0],
        latestOffer: {
          id: 'offer-21061-intertoys',
          offerSeedId: 'seed-21061-intertoys',
          setId: '21061',
          merchantId: 'merchant-intertoys',
          productUrl: 'https://www.intertoys.nl/21061',
          fetchStatus: 'success',
          priceMinor: 21999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-21061-lego',
        setId: '21061',
        merchantId: 'merchant-lego',
        productUrl:
          'https://www.lego.com/nl-nl/product/notre-dame-de-paris-21061',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[1],
        latestOffer: {
          id: 'offer-21061-lego',
          offerSeedId: 'seed-21061-lego',
          setId: '21061',
          merchantId: 'merchant-lego',
          productUrl:
            'https://www.lego.com/nl-nl/product/notre-dame-de-paris-21061',
          fetchStatus: 'success',
          priceMinor: 22999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-21061-bol',
        setId: '21061',
        merchantId: 'merchant-bol',
        productUrl:
          'https://www.bol.com/nl/nl/p/notre-dame-de-paris/9300000000000001/',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[2],
        latestOffer: {
          id: 'offer-21061-bol',
          offerSeedId: 'seed-21061-bol',
          setId: '21061',
          merchantId: 'merchant-bol',
          productUrl:
            'https://www.bol.com/nl/nl/p/notre-dame-de-paris/9300000000000001/',
          fetchStatus: 'success',
          priceMinor: 22499,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-21061-misterbricks',
        setId: '21061',
        merchantId: 'merchant-misterbricks',
        productUrl: 'https://misterbricks.nl/notre-dame-de-paris-21061',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[3],
        latestOffer: {
          id: 'offer-21061-misterbricks',
          offerSeedId: 'seed-21061-misterbricks',
          setId: '21061',
          merchantId: 'merchant-misterbricks',
          productUrl: 'https://misterbricks.nl/notre-dame-de-paris-21061',
          fetchStatus: 'success',
          priceMinor: 21999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
    ];

    const summary = await listCommercePrimaryCoverageGapAudit({
      filters: {
        primaryCoverageStatus: 'partial_primary_coverage',
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        partialSetWithRefreshGap,
        partialSetWithMissingSeed,
        fullCoverageSet,
        retiredCatalogSet,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => coverageSeeds),
    });

    expect(summary.totalSetCount).toBe(3);
    expect(summary.selectedSetCount).toBe(2);
    expect(summary.summary.actionablePartialSetCount).toBe(2);
    expect(summary.summary.missingValidOfferCountsByMerchant).toEqual([
      {
        merchantName: 'bol',
        merchantSlug: 'bol',
        missingValidOfferCount: 1,
      },
      {
        merchantName: 'LEGO',
        merchantSlug: 'lego-nl',
        missingValidOfferCount: 1,
      },
      {
        merchantName: 'MisterBricks',
        merchantSlug: 'misterbricks',
        missingValidOfferCount: 1,
      },
    ]);
    expect(summary.summary.gapCountsByType).toEqual([
      {
        gapType: 'missing_seed',
        count: 1,
      },
      {
        gapType: 'refresh_error',
        count: 1,
      },
      {
        gapType: 'seed_stale',
        count: 1,
      },
    ]);
    expect(summary.summary.countsByRecoveryPriority).toEqual([
      {
        recoveryPriority: 'recover_now',
        count: 1,
      },
      {
        recoveryPriority: 'verify_first',
        count: 2,
      },
    ]);
    expect(summary.summary.recoverNowCount).toBe(1);
    expect(summary.summary.verifyFirstCount).toBe(2);
    expect(summary.summary.parkedCount).toBe(0);
    expect(summary.summary.setsMissingSeedCount).toBe(1);
    expect(summary.summary.setsWithFullSeedButMissingOfferCount).toBe(1);
    expect(summary.rows.map((row) => row.setId)).toEqual(['76437', '10316']);
    expect(summary.rows[0]?.merchantGaps).toEqual([
      expect.objectContaining({
        merchantSlug: 'misterbricks',
        gapType: 'missing_seed',
        hasSeed: false,
        recoveryPriority: 'recover_now',
      }),
    ]);
    expect(summary.rows[1]?.merchantGaps).toHaveLength(2);
    expect(summary.rows[1]?.merchantGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          merchantSlug: 'lego-nl',
          gapType: 'refresh_error',
          hasSeed: true,
          recoveryPriority: 'verify_first',
          seedValidationStatus: 'valid',
          latestRefreshStatus: 'error',
          latestRefreshReason:
            'Main offer block did not expose a usable price or stock signal.',
        }),
        expect.objectContaining({
          merchantSlug: 'bol',
          gapType: 'seed_stale',
          hasSeed: true,
          recoveryPriority: 'verify_first',
          seedValidationStatus: 'stale',
          latestRefreshStatus: 'error',
          latestRefreshReason: 'Main offer state was ambiguous.',
        }),
      ]),
    );
  });

  test('supports deterministic merchant-scoped and direct set-id gap audits', async () => {
    const partialSetWithMissingSeed: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '76437',
      slug: 'the-burrow-collectors-edition-76437',
      sourceSetNumber: '76437-1',
      name: 'The Burrow – Collectors’ Edition',
      primaryTheme: 'Harry Potter',
    };
    const partialSetWithRefreshGap: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10316',
      slug: 'rivendell-10316',
      sourceSetNumber: '10316-1',
      name: 'Rivendell',
      primaryTheme: 'Icons',
      pieceCount: 6167,
    };
    const retiredPartialSet: CatalogCanonicalSet = {
      ...retiredCatalogSet,
      setId: '70728',
      sourceSetNumber: '70728-1',
    };
    const coverageSeeds: CommerceOfferSeed[] = [
      {
        id: 'seed-10316-intertoys',
        setId: '10316',
        merchantId: 'merchant-intertoys',
        productUrl: 'https://www.intertoys.nl/10316',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[0],
        latestOffer: {
          id: 'offer-10316-intertoys',
          offerSeedId: 'seed-10316-intertoys',
          setId: '10316',
          merchantId: 'merchant-intertoys',
          productUrl: 'https://www.intertoys.nl/10316',
          fetchStatus: 'success',
          priceMinor: 44999,
          currencyCode: 'EUR',
          availability: 'in_stock',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-10316-lego',
        setId: '10316',
        merchantId: 'merchant-lego',
        productUrl: 'https://www.lego.com/nl-nl/product/rivendell-10316',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[1],
        latestOffer: {
          id: 'offer-10316-lego',
          offerSeedId: 'seed-10316-lego',
          setId: '10316',
          merchantId: 'merchant-lego',
          productUrl: 'https://www.lego.com/nl-nl/product/rivendell-10316',
          fetchStatus: 'error',
          errorMessage:
            'Main offer block did not expose a usable price or stock signal.',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      {
        id: 'seed-70728-lego',
        setId: '70728',
        merchantId: 'merchant-lego',
        productUrl: 'https://www.lego.com/nl-nl/search?q=70728',
        isActive: false,
        validationStatus: 'stale',
        notes: buildGeneratedCommerceSeedCandidateNote({
          merchantSlug: 'lego-nl',
          setId: '70728',
        }),
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[1],
      },
    ];

    const merchantScopedSummary = await listCommercePrimaryCoverageGapAudit({
      filters: {
        merchantSlugs: ['lego-nl'],
        primaryCoverageStatus: 'partial_primary_coverage',
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        partialSetWithMissingSeed,
        partialSetWithRefreshGap,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => coverageSeeds),
    });

    expect(merchantScopedSummary.auditedMerchantSlugs).toEqual(['lego-nl']);
    expect(merchantScopedSummary.rows.map((row) => row.setId)).toEqual([
      '10316',
    ]);
    expect(merchantScopedSummary.rows[0]?.merchantGaps).toEqual([
      expect.objectContaining({
        merchantSlug: 'lego-nl',
        gapType: 'refresh_error',
      }),
    ]);

    const directSetSummary = await listCommercePrimaryCoverageGapAudit({
      filters: {
        setIds: ['70728'],
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        retiredPartialSet,
        partialSetWithRefreshGap,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => coverageSeeds),
    });

    expect(directSetSummary.selectedSetCount).toBe(1);
    expect(directSetSummary.rows.map((row) => row.setId)).toEqual(['70728']);
  });

  test('classifies recovery priority conservatively and sorts recover-now rows above parked rows', async () => {
    const missingSeedSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '76437',
      sourceSetNumber: '76437-1',
      slug: 'the-burrow-collectors-edition-76437',
      name: 'The Burrow – Collectors’ Edition',
      primaryTheme: 'Harry Potter',
    };
    const parkedRefreshSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10305',
      sourceSetNumber: '10305-1',
      slug: 'lion-knights-castle-10305',
      name: "Lion Knights' Castle",
      primaryTheme: 'Icons',
    };
    const parkedIntertoysSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10300',
      sourceSetNumber: '10300-1',
      slug: 'back-to-the-future-time-machine-10300',
      name: 'Back to the Future Time Machine',
      primaryTheme: 'Icons',
    };
    const parkedMisterbricksSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10320',
      sourceSetNumber: '10320-1',
      slug: 'eldorado-fortress-10320',
      name: 'Eldorado Fortress',
      primaryTheme: 'Icons',
    };
    const verifyFirstSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '21061',
      sourceSetNumber: '21061-1',
      slug: 'notre-dame-de-paris-21061',
      name: 'Notre-Dame de Paris',
      primaryTheme: 'Architecture',
    };
    const buildValidCoverageSeed = ({
      merchant,
      productUrl,
      setId,
    }: {
      merchant: CommerceMerchant;
      productUrl: string;
      setId: string;
    }): CommerceOfferSeed => ({
      id: `seed-${setId}-${merchant.slug}`,
      setId,
      merchantId: merchant.id,
      productUrl,
      isActive: true,
      validationStatus: 'valid',
      notes: 'validated',
      createdAt: '2026-04-19T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
      merchant,
      latestOffer: {
        id: `offer-${setId}-${merchant.slug}`,
        offerSeedId: `seed-${setId}-${merchant.slug}`,
        setId,
        merchantId: merchant.id,
        productUrl,
        fetchStatus: 'success',
        priceMinor: 19999,
        currencyCode: 'EUR',
        availability: 'in_stock',
        observedAt: '2026-04-19T09:00:00.000Z',
        fetchedAt: '2026-04-19T09:00:00.000Z',
        createdAt: '2026-04-19T09:00:00.000Z',
        updatedAt: '2026-04-19T09:00:00.000Z',
      },
    });
    const coverageSeeds: CommerceOfferSeed[] = [
      ...activeMerchants
        .filter((merchant) => merchant.slug !== 'misterbricks')
        .map((merchant) =>
          buildValidCoverageSeed({
            merchant,
            productUrl: `https://${merchant.slug}.example.com/76437`,
            setId: '76437',
          }),
        ),
      ...activeMerchants
        .filter((merchant) => merchant.slug !== 'lego-nl')
        .map((merchant) =>
          buildValidCoverageSeed({
            merchant,
            productUrl: `https://${merchant.slug}.example.com/10305`,
            setId: '10305',
          }),
        ),
      {
        id: 'seed-10305-lego',
        setId: '10305',
        merchantId: 'merchant-lego',
        productUrl:
          'https://www.lego.com/nl-nl/product/lion-knights-castle-10305',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[1],
        latestOffer: {
          id: 'offer-10305-lego',
          offerSeedId: 'seed-10305-lego',
          setId: '10305',
          merchantId: 'merchant-lego',
          productUrl:
            'https://www.lego.com/nl-nl/product/lion-knights-castle-10305',
          fetchStatus: 'unavailable',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
      ...activeMerchants
        .filter((merchant) => merchant.slug !== 'intertoys')
        .map((merchant) =>
          buildValidCoverageSeed({
            merchant,
            productUrl: `https://${merchant.slug}.example.com/10300`,
            setId: '10300',
          }),
        ),
      {
        id: 'seed-10300-intertoys',
        setId: '10300',
        merchantId: 'merchant-intertoys',
        productUrl: 'https://www.intertoys.nl/search?searchTerm=10300',
        isActive: false,
        validationStatus: 'invalid',
        notes: buildGeneratedCommerceSeedCandidateNote({
          merchantSlug: 'intertoys',
          setId: '10300',
        }),
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[0],
      },
      ...activeMerchants
        .filter((merchant) => merchant.slug !== 'misterbricks')
        .map((merchant) =>
          buildValidCoverageSeed({
            merchant,
            productUrl: `https://${merchant.slug}.example.com/10320`,
            setId: '10320',
          }),
        ),
      {
        id: 'seed-10320-misterbricks',
        setId: '10320',
        merchantId: 'merchant-misterbricks',
        productUrl: 'https://misterbricks.nl/catalogsearch/result/?q=10320',
        isActive: false,
        validationStatus: 'stale',
        notes: buildGeneratedCommerceSeedCandidateNote({
          merchantSlug: 'misterbricks',
          setId: '10320',
        }),
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[3],
      },
      ...activeMerchants
        .filter((merchant) => merchant.slug !== 'lego-nl')
        .map((merchant) =>
          buildValidCoverageSeed({
            merchant,
            productUrl: `https://${merchant.slug}.example.com/21061`,
            setId: '21061',
          }),
        ),
      {
        id: 'seed-21061-lego',
        setId: '21061',
        merchantId: 'merchant-lego',
        productUrl:
          'https://www.lego.com/nl-nl/product/notre-dame-de-paris-21061',
        isActive: true,
        validationStatus: 'valid',
        notes: 'validated',
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        merchant: activeMerchants[1],
        latestOffer: {
          id: 'offer-21061-lego',
          offerSeedId: 'seed-21061-lego',
          setId: '21061',
          merchantId: 'merchant-lego',
          productUrl:
            'https://www.lego.com/nl-nl/product/notre-dame-de-paris-21061',
          fetchStatus: 'error',
          errorMessage: 'Temporary merchant refresh error.',
          observedAt: '2026-04-19T09:00:00.000Z',
          fetchedAt: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
          updatedAt: '2026-04-19T09:00:00.000Z',
        },
      },
    ];

    const summary = await listCommercePrimaryCoverageGapAudit({
      filters: {
        primaryCoverageStatus: 'all',
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        parkedRefreshSet,
        parkedIntertoysSet,
        parkedMisterbricksSet,
        verifyFirstSet,
        missingSeedSet,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(async () => coverageSeeds),
    });

    expect(summary.rows.map((row) => row.setId)).toEqual([
      '76437',
      '21061',
      '10300',
      '10305',
      '10320',
    ]);
    expect(summary.rows[0]?.merchantGaps[0]).toEqual(
      expect.objectContaining({
        merchantSlug: 'misterbricks',
        gapType: 'missing_seed',
        recoveryPriority: 'recover_now',
      }),
    );
    expect(summary.rows[1]?.merchantGaps[0]).toEqual(
      expect.objectContaining({
        merchantSlug: 'lego-nl',
        gapType: 'refresh_error',
        recoveryPriority: 'verify_first',
      }),
    );
    expect(summary.rows[2]?.merchantGaps[0]).toEqual(
      expect.objectContaining({
        merchantSlug: 'intertoys',
        gapType: 'seed_invalid',
        recoveryPriority: 'parked',
      }),
    );
    expect(summary.rows[3]?.merchantGaps[0]).toEqual(
      expect.objectContaining({
        merchantSlug: 'lego-nl',
        gapType: 'refresh_unavailable',
        recoveryPriority: 'parked',
      }),
    );
    expect(summary.rows[4]?.merchantGaps[0]).toEqual(
      expect.objectContaining({
        merchantSlug: 'misterbricks',
        gapType: 'seed_stale',
        recoveryPriority: 'parked',
      }),
    );
  });

  test('generates only the selected primary-coverage batch when requested', async () => {
    const firstSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10316',
      slug: 'rivendell-10316',
      sourceSetNumber: '10316-1',
      name: 'Rivendell',
      primaryTheme: 'Icons',
      pieceCount: 6167,
    };
    const secondSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '21061',
      slug: 'notre-dame-de-paris-21061',
      sourceSetNumber: '21061-1',
      name: 'Notre-Dame de Paris',
      primaryTheme: 'Architecture',
      pieceCount: 4383,
    };
    const createCommerceOfferSeedFn = vi.fn(async () => undefined as never);

    const summary = await generateCommerceOfferSeedCandidates({
      filters: {
        primaryCoverageStatus: 'no_primary_seeds',
        batchSize: 1,
        batchIndex: 0,
      },
      write: true,
      listCanonicalCatalogSetsFn: vi.fn(async () => [
        firstSet,
        baseCatalogSet,
        secondSet,
      ]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-10316-lego',
              setId: '10316',
              merchantId: 'merchant-lego',
              productUrl: 'https://www.lego.com/rivendell',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'lego-nl',
                setId: '10316',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[1],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      createCommerceOfferSeedFn,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        candidateCount: 4,
        insertedCount: 4,
      }),
    );
    expect(
      createCommerceOfferSeedFn.mock.calls.map((call) => call[0].input.setId),
    ).toEqual(['21061', '21061', '21061', '21061']);
  });

  test('generates pending search-url candidates with insert, update, and skip behavior', async () => {
    const createCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);

    const summary = await generateCommerceOfferSeedCandidates({
      write: true,
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => activeMerchants),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-intertoys',
              setId: '76437',
              merchantId: 'merchant-intertoys',
              productUrl: 'https://www.intertoys.nl/search?searchTerm=oude-url',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'intertoys',
                setId: '76437',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[0],
            },
            {
              id: 'seed-lego',
              setId: '76437',
              merchantId: 'merchant-lego',
              productUrl:
                'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
              isActive: true,
              validationStatus: 'valid',
              notes: 'handmatig bevestigd',
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[1],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      createCommerceOfferSeedFn,
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        candidateCount: 4,
        insertedCount: 2,
        updatedCount: 1,
        skippedCount: 1,
      }),
    );
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-intertoys',
      input: expect.objectContaining({
        setId: '76437',
        merchantId: 'merchant-intertoys',
        productUrl: 'https://www.intertoys.nl/search?searchTerm=76437',
        isActive: false,
        validationStatus: 'pending',
      }),
    });
    expect(createCommerceOfferSeedFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        setId: '76437',
        merchantId: 'merchant-bol',
        productUrl: 'https://www.bol.com/nl/nl/s/?searchtext=76437',
        isActive: false,
        validationStatus: 'pending',
      }),
    });
    expect(createCommerceOfferSeedFn).toHaveBeenCalledWith({
      input: expect.objectContaining({
        setId: '76437',
        merchantId: 'merchant-misterbricks',
        productUrl: 'https://misterbricks.nl/catalogsearch/result/?q=76437',
        isActive: false,
        validationStatus: 'pending',
      }),
    });
  });

  test('promotes a pending search-url candidate to a validated product seed', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          '<html><body><a href="/the-burrow-collectors-edition-76437">LEGO Harry Potter 76437 The Burrow Collectors Edition</a></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          '<html><body><h1>LEGO Harry Potter 76437 The Burrow Collectors Edition</h1><p>2405 stukjes</p></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        ),
      );

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[0]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-intertoys',
              setId: '76437',
              merchantId: 'merchant-intertoys',
              productUrl: 'https://www.intertoys.nl/search?searchTerm=76437',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'intertoys',
                setId: '76437',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[0],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-intertoys',
      input: expect.objectContaining({
        productUrl:
          'https://www.intertoys.nl/the-burrow-collectors-edition-76437',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('validates an image-only localized product candidate without being derailed by accessory noise elsewhere on the page', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          '<html><body><a href="/lego-harry-potter-76437-het-nest-verzameleditie.html"><img alt="LEGO Harry Potter 76437 Het Nest – Verzameleditie" /></a><a href="/led-lighting-kit-for-76437">LED lighting kit for LEGO 76437</a></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          '<html><head><title>LEGO Harry Potter 76437 Het Nest – Verzameleditie</title><meta name="description" content="LEGO Harry Potter 76437 Het Nest – Verzameleditie" /></head><body><h1>LEGO Harry Potter 76437 Het Nest – Verzameleditie</h1><section>Gerelateerde producten: LED lighting kit</section></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        ),
      );

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[3]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-misterbricks',
              setId: '76437',
              merchantId: 'merchant-misterbricks',
              productUrl:
                'https://misterbricks.nl/catalogsearch/result/?q=76437',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'misterbricks',
                setId: '76437',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[3],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-misterbricks',
      input: expect.objectContaining({
        productUrl:
          'https://misterbricks.nl/lego-harry-potter-76437-het-nest-verzameleditie.html',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('keeps a Misterbricks search URL valid when it resolves directly to the product page', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const marioKartSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '72050',
      slug: 'mario-kart-luigi-standard-kart-72050',
      sourceSetNumber: '72050-1',
      name: 'Mario Kart - Luigi & Standard Kart',
      primaryTheme: 'Super Mario',
      pieceCount: 174,
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      expect(requestUrl).toBe(
        'https://misterbricks.nl/catalogsearch/result/?q=72050',
      );

      const response = new Response(
        '<html><head><title>LEGO Super Mario 72050 Mario Kart - Luigi & Standard Kart</title></head><body><h1>LEGO Super Mario 72050 Mario Kart - Luigi & Standard Kart</h1><p>174 onderdelen</p></body></html>',
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        },
      );

      Object.defineProperty(response, 'url', {
        value:
          'https://misterbricks.nl/lego-super-mario-72050-mario-kart-luigi-en-mach-8.html',
      });

      return response;
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [marioKartSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[3]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-misterbricks-72050',
              setId: '72050',
              merchantId: 'merchant-misterbricks',
              productUrl:
                'https://misterbricks.nl/catalogsearch/result/?q=72050',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'misterbricks',
                setId: '72050',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[3],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-misterbricks-72050',
      input: expect.objectContaining({
        productUrl:
          'https://misterbricks.nl/lego-super-mario-72050-mario-kart-luigi-en-mach-8.html',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('prefers a Misterbricks product card over taxonomy links when the search page contains a real product result', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const lionKnightsSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10305',
      slug: 'leeuwenridder-kasteel-10305',
      sourceSetNumber: '10305-1',
      name: 'Leeuwenridder kasteel',
      primaryTheme: 'Icons',
      pieceCount: 4514,
    };
    const fetchedUrls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      fetchedUrls.push(requestUrl);

      if (
        requestUrl === 'https://misterbricks.nl/catalogsearch/result/?q=10305'
      ) {
        return new Response(
          `
            <html>
              <body>
                <a href="https://misterbricks.nl/lego-art">LEGO Art</a>
                <a href="https://misterbricks.nl/lego-city">LEGO City</a>
                <ol class="products list items product-items">
                  <li class="item product product-item">
                    <div class="product-item-info" data-container="product-grid">
                      <a href="https://misterbricks.nl/lego-icons-10305-leeuwenridder-kasteel.html" class="product photo product-item-photo" tabindex="-1">
                        <img alt="LEGO Icons 10305 Leeuwenridder kasteel" />
                      </a>
                      <a class="product-item-link" href="https://misterbricks.nl/lego-icons-10305-leeuwenridder-kasteel.html">
                        LEGO Icons 10305 Leeuwenridder kasteel
                      </a>
                    </div>
                  </li>
                </ol>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      if (
        requestUrl ===
        'https://misterbricks.nl/lego-icons-10305-leeuwenridder-kasteel.html'
      ) {
        return new Response(
          '<html><head><title>LEGO Icons 10305 Leeuwenridder kasteel</title></head><body><h1>LEGO Icons 10305 Leeuwenridder kasteel</h1><p>4514 onderdelen</p></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`);
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [lionKnightsSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[3]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-misterbricks-10305',
              setId: '10305',
              merchantId: 'merchant-misterbricks',
              productUrl:
                'https://misterbricks.nl/catalogsearch/result/?q=10305',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'misterbricks',
                setId: '10305',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[3],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(fetchedUrls).toEqual([
      'https://misterbricks.nl/catalogsearch/result/?q=10305',
      'https://misterbricks.nl/lego-icons-10305-leeuwenridder-kasteel.html',
    ]);
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-misterbricks-10305',
      input: expect.objectContaining({
        productUrl:
          'https://misterbricks.nl/lego-icons-10305-leeuwenridder-kasteel.html',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('keeps Misterbricks no-results pages invalid instead of following category links', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const artSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '21333',
      slug: 'vincent-van-gogh-the-starry-night-21333',
      sourceSetNumber: '21333-1',
      name: 'The Starry Night',
      primaryTheme: 'Ideas',
      pieceCount: 2316,
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (
        requestUrl !== 'https://misterbricks.nl/catalogsearch/result/?q=21333'
      ) {
        throw new Error(`Unexpected fetch url: ${requestUrl}`);
      }

      return new Response(
        `
          <html>
            <body>
              <div class="message notice">
                Uw zoekopdracht heeft geen resultaten opgeleverd.
              </div>
              <a href="https://misterbricks.nl/lego-art">LEGO Art</a>
              <a href="https://misterbricks.nl/lego-city">LEGO City</a>
              <a href="https://misterbricks.nl/catalogsearch/result/?q=213335">Bedoelde u 213335?</a>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        },
      );
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [artSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[3]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-misterbricks-21333',
              setId: '21333',
              merchantId: 'merchant-misterbricks',
              productUrl:
                'https://misterbricks.nl/catalogsearch/result/?q=21333',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'misterbricks',
                setId: '21333',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[3],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 0,
      invalidCount: 0,
      staleCount: 1,
      skippedCount: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-misterbricks-21333',
      input: expect.objectContaining({
        isActive: false,
        validationStatus: 'stale',
      }),
    });
  });

  test('prefers a Kruidvat product detail url over taxonomy links when the search page contains a real product result', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const groguSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '75403',
      slug: 'grogu-met-zweefkinderwagen-75403',
      sourceSetNumber: '75403-1',
      name: 'Grogu met Zweefkinderwagen',
      primaryTheme: 'Star Wars',
      pieceCount: 1048,
    };
    const fetchedUrls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      fetchedUrls.push(requestUrl);

      if (requestUrl === 'https://www.kruidvat.nl/search?q=75403') {
        return new Response(
          `
            <html>
              <body>
                <a href="https://www.kruidvat.nl/speelgoed/lego/lego-star-wars">LEGO Star Wars</a>
                <a href="https://www.kruidvat.nl/speelgoed/lego/lego-icons">LEGO Icons</a>
                <a href="https://www.kruidvat.nl/lego-star-wars-75403-grogu-met-zweefkinderwagen/p/6231972">
                  LEGO Star Wars 75403 Grogu met Zweefkinderwagen
                </a>
                <a href="https://www.kruidvat.nl/lego-star-wars-75411-darth-maul-mecha/p/6346821">
                  LEGO Star Wars 75411 Darth Maul Mecha
                </a>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      if (
        requestUrl ===
        'https://www.kruidvat.nl/lego-star-wars-75403-grogu-met-zweefkinderwagen/p/6231972'
      ) {
        return new Response(
          `
            <html>
              <head>
                <title>LEGO Star Wars 75403 Grogu met Zweefkinderwagen</title>
              </head>
              <body>
                <h1>LEGO Star Wars 75403 Grogu met Zweefkinderwagen</h1>
                <p>1048 onderdelen</p>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`);
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      filters: {
        merchantSlugs: ['kruidvat'],
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [groguSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [kruidvatMerchant]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-kruidvat-75403',
              setId: '75403',
              merchantId: 'merchant-kruidvat',
              productUrl: 'https://www.kruidvat.nl/search?q=75403',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'kruidvat',
                setId: '75403',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: kruidvatMerchant,
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(fetchedUrls).toEqual([
      'https://www.kruidvat.nl/search?q=75403',
      'https://www.kruidvat.nl/lego-star-wars-75403-grogu-met-zweefkinderwagen/p/6231972',
    ]);
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-kruidvat-75403',
      input: expect.objectContaining({
        productUrl:
          'https://www.kruidvat.nl/lego-star-wars-75403-grogu-met-zweefkinderwagen/p/6231972',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('keeps Kruidvat taxonomy-only search pages stale instead of validating category links', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const ideasSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '21340',
      slug: 'tales-of-the-space-age-21340',
      sourceSetNumber: '21340-1',
      name: 'Tales of the Space Age',
      primaryTheme: 'Ideas',
      pieceCount: 688,
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (requestUrl !== 'https://www.kruidvat.nl/search?q=21340') {
        throw new Error(`Unexpected fetch url: ${requestUrl}`);
      }

      return new Response(
        `
          <html>
            <body>
              <div class="search-result-count">0 producten gevonden</div>
              <a href="https://www.kruidvat.nl/speelgoed/lego/lego-art">LEGO Art</a>
              <a href="https://www.kruidvat.nl/speelgoed/lego/lego-ideas">LEGO Ideas</a>
              <a href="https://www.kruidvat.nl/exclusief-assortiment-lego">Exclusief Assortiment LEGO</a>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        },
      );
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      filters: {
        merchantSlugs: ['kruidvat'],
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [ideasSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [kruidvatMerchant]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-kruidvat-21340',
              setId: '21340',
              merchantId: 'merchant-kruidvat',
              productUrl: 'https://www.kruidvat.nl/search?q=21340',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'kruidvat',
                setId: '21340',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: kruidvatMerchant,
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 0,
      invalidCount: 0,
      staleCount: 1,
      skippedCount: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-kruidvat-21340',
      input: expect.objectContaining({
        isActive: false,
        validationStatus: 'stale',
      }),
    });
  });

  test('prefers a Wehkamp product tile with an exact set id over nearby search matches', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const darthMaulSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '75411',
      slug: 'darth-maul-mecha-75411',
      sourceSetNumber: '75411-1',
      name: 'Darth Maul Mecha',
      primaryTheme: 'Star Wars',
      pieceCount: 143,
    };
    const fetchedUrls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      fetchedUrls.push(requestUrl);

      if (
        requestUrl === 'https://www.wehkamp.nl/zoeken/?term=75411&type=manual'
      ) {
        return new Response(
          `
            <html>
              <body>
                <article class="position-relative full-height UI_ProductTile_productTile">
                  <a
                    href="https://www.wehkamp.nl/lego-star-wars-the-clone-wars-darth-maul-mecha-75411-17380916/"
                    class="UI_ProductTileLink_tileLink full-height"
                  >
                    <h3>LEGO Star Wars</h3>
                    <h3>The Clone Wars Darth Maul Mecha 75411</h3>
                    <span>morgen in huis</span>
                  </a>
                </article>
                <article class="position-relative full-height UI_ProductTile_productTile">
                  <a
                    href="https://www.wehkamp.nl/lego-marvel-spider-man-vs-doc-ock-metroscene-76321-17408412/"
                    class="UI_ProductTileLink_tileLink full-height"
                  >
                    <h3>LEGO Marvel</h3>
                    <h3>Spider-Man vs. Doc Ock metroscene 76321</h3>
                  </a>
                </article>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      if (
        requestUrl ===
        'https://www.wehkamp.nl/lego-star-wars-the-clone-wars-darth-maul-mecha-75411-17380916/'
      ) {
        return new Response(
          `
            <html>
              <head>
                <title>LEGO Star Wars The Clone Wars Darth Maul Mecha 75411</title>
              </head>
              <body>
                <h1>LEGO Star Wars The Clone Wars Darth Maul Mecha 75411</h1>
                <p>143 onderdelen</p>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`);
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-20T10:00:00.000Z'),
      fetchImpl,
      filters: {
        merchantSlugs: ['wehkamp'],
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [darthMaulSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [wehkampMerchant]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-wehkamp-75411',
              setId: '75411',
              merchantId: 'merchant-wehkamp',
              productUrl:
                'https://www.wehkamp.nl/zoeken/?term=75411&type=manual',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'wehkamp',
                setId: '75411',
              }),
              createdAt: '2026-04-20T08:00:00.000Z',
              updatedAt: '2026-04-20T08:00:00.000Z',
              merchant: wehkampMerchant,
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(fetchedUrls).toEqual([
      'https://www.wehkamp.nl/zoeken/?term=75411&type=manual',
      'https://www.wehkamp.nl/lego-star-wars-the-clone-wars-darth-maul-mecha-75411-17380916/',
    ]);
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-wehkamp-75411',
      input: expect.objectContaining({
        productUrl:
          'https://www.wehkamp.nl/lego-star-wars-the-clone-wars-darth-maul-mecha-75411-17380916/',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('keeps Wehkamp search pages stale when only nearby set-number matches are present', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const groguSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '75403',
      slug: 'grogu-met-zweefkinderwagen-75403',
      sourceSetNumber: '75403-1',
      name: 'Grogu met Zweefkinderwagen',
      primaryTheme: 'Star Wars',
      pieceCount: 1048,
    };
    const fetchedUrls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      fetchedUrls.push(requestUrl);

      if (
        requestUrl !== 'https://www.wehkamp.nl/zoeken/?term=75403&type=manual'
      ) {
        throw new Error(`Unexpected fetch url: ${requestUrl}`);
      }

      return new Response(
        `
          <html>
            <body>
              <article class="position-relative full-height UI_ProductTile_productTile">
                <a
                  href="https://www.wehkamp.nl/lego-star-wars-logo-decoratie-bouwpakket-voor-volwassenen-75407-17363468/"
                  class="UI_ProductTileLink_tileLink full-height"
                >
                  <h3>LEGO Star Wars</h3>
                  <h3>Logo Decoratie Bouwpakket voor volwassenen 75407</h3>
                </a>
              </article>
              <article class="position-relative full-height UI_ProductTile_productTile">
                <a
                  href="https://www.wehkamp.nl/lego-star-wars-de-mandalorian-en-grogus-speederbike-set-75436-17478772/"
                  class="UI_ProductTileLink_tileLink full-height"
                >
                  <h3>LEGO Star Wars</h3>
                  <h3>De Mandalorian en Grogus Speederbike Set 75436</h3>
                </a>
              </article>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        },
      );
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-20T10:00:00.000Z'),
      fetchImpl,
      filters: {
        merchantSlugs: ['wehkamp'],
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [groguSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [wehkampMerchant]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-wehkamp-75403',
              setId: '75403',
              merchantId: 'merchant-wehkamp',
              productUrl:
                'https://www.wehkamp.nl/zoeken/?term=75403&type=manual',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'wehkamp',
                setId: '75403',
              }),
              createdAt: '2026-04-20T08:00:00.000Z',
              updatedAt: '2026-04-20T08:00:00.000Z',
              merchant: wehkampMerchant,
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 0,
      invalidCount: 0,
      staleCount: 1,
      skippedCount: 0,
    });
    expect(fetchedUrls).toEqual([
      'https://www.wehkamp.nl/zoeken/?term=75403&type=manual',
    ]);
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-wehkamp-75403',
      input: expect.objectContaining({
        isActive: false,
        validationStatus: 'stale',
      }),
    });
  });

  test('can recheck a previously rejected generated seed when validation logic improves', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        '<html><head><title>LEGO Harry Potter 76437 Het Nest – Verzameleditie</title></head><body><h1>LEGO Harry Potter 76437 Het Nest – Verzameleditie</h1></body></html>',
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        },
      ),
    );

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      filters: {
        recheckGenerated: true,
      },
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[2]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-bol',
              setId: '76437',
              merchantId: 'merchant-bol',
              productUrl:
                'https://www.bol.com/nl/nl/p/lego-harry-potter-het-nest-verzameleditie/9300000188627176/',
              isActive: false,
              validationStatus: 'invalid',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'bol',
                setId: '76437',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[2],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-bol',
      input: expect.objectContaining({
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('uses LEGO search GraphQL redirects and normalizes them back to the requested locale', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (requestUrl === 'https://www.lego.com/nl-nl/search?q=76437') {
        return new Response(
          '<html><head><title>Zoekresultaten voor 76437 | LEGO® Shop NL</title></head><body><div id="__next"></div></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      if (requestUrl === 'https://www.lego.com/api/graphql') {
        expect(init?.method).toBe('POST');

        return new Response(
          JSON.stringify({
            data: {
              searchProducts: {
                __typename: 'RedirectAction',
                url: '/en-us/product/the-burrow-collectors-edition-76437',
              },
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      }

      if (
        requestUrl ===
        'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437'
      ) {
        return new Response(
          '<html><head><title>LEGO Harry Potter 76437 The Burrow Collectors’ Edition</title></head><body><h1>LEGO Harry Potter 76437 The Burrow Collectors’ Edition</h1><p>2405 pieces</p></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`);
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[1]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-lego',
              setId: '76437',
              merchantId: 'merchant-lego',
              productUrl: 'https://www.lego.com/nl-nl/search?q=76437',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'lego-nl',
                setId: '76437',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[1],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-lego',
      input: expect.objectContaining({
        productUrl:
          'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('uses Intertoys Hello Retail partnerSearch results when the search page shell does not include product cards', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (requestUrl === 'https://www.intertoys.nl/search?searchTerm=76437') {
        return new Response(
          '<html><head><title>Zoekresultaten voor 76437 | Intertoys</title></head><body><div id="catalog-entry-list-product-grid"></div><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"settings":{"storeId":"11601","defaultLanguageId":"-1000","userData":{"HelloretailSearchConfigKey":"c856f386-0b92-414b-b5ce-5ba56777e2a6","HelloRetailUUID":"website-uuid-123"}}}}}</script></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      if (
        requestUrl ===
        'https://core.helloretail.com/api/v1/search/partnerSearch'
      ) {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toEqual(
          expect.objectContaining({
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/x-www-form-urlencoded',
          }),
        );

        const requestBody = new URLSearchParams(String(init?.body ?? ''));

        expect(requestBody.get('product_count')).toBe('36');
        expect(requestBody.get('product_start')).toBe('0');
        expect(requestBody.get('websiteUuid')).toBe('website-uuid-123');
        expect(['76437', 'LEGO 76437']).toContain(requestBody.get('q'));

        return new Response(
          JSON.stringify({
            result: [
              {
                brand: 'LEGO',
                originalUrl:
                  'https://www.intertoys.nl/lego-harry-potter-het-nest-verzameleditie-76437/p/1234567',
                title: 'LEGO Harry Potter The Burrow Collectors Edition 76437',
                description:
                  'LEGO Harry Potter The Burrow Collectors Edition 76437 met 2405 stukjes.',
                keywords:
                  'LEGO Harry Potter The Burrow Collectors Edition 76437 2405 stukjes',
                extraData: {
                  legoNr: '76437',
                },
                productNumber: '2005436',
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      }

      if (
        requestUrl ===
        'https://www.intertoys.nl/lego-harry-potter-het-nest-verzameleditie-76437/p/1234567'
      ) {
        return new Response(
          '<html><head><title>LEGO Harry Potter The Burrow Collectors Edition 76437</title></head><body><h1>LEGO Harry Potter The Burrow Collectors Edition 76437</h1><p>2405 stukjes</p></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`);
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[0]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-intertoys',
              setId: '76437',
              merchantId: 'merchant-intertoys',
              productUrl: 'https://www.intertoys.nl/search?searchTerm=76437',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'intertoys',
                setId: '76437',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[0],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 1,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-intertoys',
      input: expect.objectContaining({
        productUrl:
          'https://www.intertoys.nl/lego-harry-potter-het-nest-verzameleditie-76437/p/1234567',
        isActive: true,
        validationStatus: 'valid',
      }),
    });
  });

  test('keeps an Intertoys numeric collision invalid when the result metadata is not a LEGO product hit', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const collisionSet: CatalogCanonicalSet = {
      ...baseCatalogSet,
      setId: '10333',
      slug: 'the-lord-of-the-rings-barad-dur-10333',
      sourceSetNumber: '10333-1',
      name: 'The Lord of the Rings: Barad-dur',
      primaryTheme: 'Icons',
      pieceCount: 5471,
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (requestUrl === 'https://www.intertoys.nl/search?searchTerm=10333') {
        return new Response(
          '<html><head><title>Zoekresultaten voor 10333 | Intertoys</title></head><body><div id="catalog-entry-list-product-grid"></div><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"settings":{"storeId":"11601","defaultLanguageId":"-1000","userData":{"HelloretailSearchConfigKey":"c856f386-0b92-414b-b5ce-5ba56777e2a6","HelloRetailUUID":"website-uuid-123"}}}}}</script></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      if (
        requestUrl ===
        'https://core.helloretail.com/api/v1/search/partnerSearch'
      ) {
        const requestBody = new URLSearchParams(String(init?.body ?? ''));

        if (requestBody.get('q') === '10333') {
          return new Response(
            JSON.stringify({
              result: [
                {
                  originalUrl: 'https://www.intertoys.nl/beverbende/p/7654321',
                  title: 'Beverbende',
                  description:
                    'Behendigheidsspel met vallende bevers voor kinderen.',
                  productNumber: '1016187',
                },
              ],
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );
        }

        return new Response(
          JSON.stringify({
            result: [],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`);
    });

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [collisionSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[0]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-intertoys-10333',
              setId: '10333',
              merchantId: 'merchant-intertoys',
              productUrl: 'https://www.intertoys.nl/search?searchTerm=10333',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'intertoys',
                setId: '10333',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[0],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 0,
      invalidCount: 1,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-intertoys-10333',
      input: expect.objectContaining({
        productUrl: 'https://www.intertoys.nl/search?searchTerm=10333',
        isActive: false,
        validationStatus: 'invalid',
      }),
    });
  });

  test('rejects a pending candidate when the search result clearly points at accessory noise', async () => {
    const updateCommerceOfferSeedFn = vi.fn(async () => undefined as never);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        '<html><body><a href="/led-lighting-kit-for-76437">LED lighting kit for LEGO 76437</a></body></html>',
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        },
      ),
    );

    const summary = await validateGeneratedCommerceOfferSeedCandidates({
      write: true,
      now: new Date('2026-04-19T10:00:00.000Z'),
      fetchImpl,
      listCanonicalCatalogSetsFn: vi.fn(async () => [baseCatalogSet]),
      listCommerceBenchmarkSetsFn: vi.fn(async () => []),
      listCommerceMerchantsFn: vi.fn(async () => [activeMerchants[0]]),
      listCommerceOfferSeedsFn: vi.fn(
        async () =>
          [
            {
              id: 'seed-intertoys',
              setId: '76437',
              merchantId: 'merchant-intertoys',
              productUrl: 'https://www.intertoys.nl/search?searchTerm=76437',
              isActive: false,
              validationStatus: 'pending',
              notes: buildGeneratedCommerceSeedCandidateNote({
                merchantSlug: 'intertoys',
                setId: '76437',
              }),
              createdAt: '2026-04-19T08:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              merchant: activeMerchants[0],
            },
          ] satisfies CommerceOfferSeed[],
      ),
      updateCommerceOfferSeedFn,
    });

    expect(summary).toEqual({
      processedCount: 1,
      validCount: 0,
      invalidCount: 1,
      staleCount: 0,
      skippedCount: 0,
    });
    expect(updateCommerceOfferSeedFn).toHaveBeenCalledWith({
      offerSeedId: 'seed-intertoys',
      input: expect.objectContaining({
        productUrl: 'https://www.intertoys.nl/search?searchTerm=76437',
        isActive: false,
        validationStatus: 'invalid',
      }),
    });
  });
});
