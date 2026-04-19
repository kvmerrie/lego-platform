import { describe, expect, test, vi } from 'vitest';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import type {
  CommerceMerchant,
  CommerceOfferSeed,
} from '@lego-platform/commerce/util';
import { buildGeneratedCommerceSeedCandidateNote } from '@lego-platform/commerce/util';
import {
  generateCommerceOfferSeedCandidates,
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
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);

      if (requestUrl === 'https://www.intertoys.nl/search?searchTerm=76437') {
        return new Response(
          '<html><head><title>Zoekresultaten voor 76437 | Intertoys</title></head><body><div id="catalog-entry-list-product-grid"></div><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"settings":{"storeId":"11601","defaultLanguageId":"-1000","userData":{"HelloretailSearchConfigKey":"c856f386-0b92-414b-b5ce-5ba56777e2a6"}}}}}</script></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
            },
          },
        );
      }

      if (
        requestUrl.includes(
          'https://core.helloretail.com/api/v1/search/partnerSearch?',
        )
      ) {
        expect(requestUrl).toContain('product_count=36');
        expect(requestUrl).toContain('product_start=0');
        expect(requestUrl).toContain(
          'product_fields=title%2Curl%2CproductNumber%2Cean%2Cprice%2ColdPrice%2Ccurrency%2CtrackingCode%2CimgUrl',
        );

        return new Response(
          JSON.stringify({
            result: [
              {
                originalUrl:
                  'https://www.intertoys.nl/lego-harry-potter-het-nest-verzameleditie-76437/p/1234567',
                title: 'LEGO Harry Potter 76437 Het Nest – Verzameleditie',
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
          '<html><head><title>LEGO Harry Potter 76437 Het Nest – Verzameleditie</title></head><body><h1>LEGO Harry Potter 76437 Het Nest – Verzameleditie</h1><p>2405 stukjes</p></body></html>',
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
