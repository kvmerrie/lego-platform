import { describe, expect, test } from 'vitest';
import {
  getBestOffer,
  getCatalogOfferComparisonInsight,
  getCatalogOfferMerchantName,
  renderAffiliateOfferSnapshotsModule,
  selectBestPurchasableOffer,
  toCatalogOffers,
  type CatalogOffer,
} from './affiliate-util';

const baseOffer: CatalogOffer = {
  setId: '10316',
  merchant: 'bol',
  merchantName: 'bol',
  url: 'https://example.test/bol',
  priceCents: 48999,
  currency: 'EUR',
  availability: 'in_stock',
  condition: 'new',
  checkedAt: '2026-06-14T10:00:00.000Z',
  market: 'NL',
};

describe('affiliate util catalog offers', () => {
  test('prefers the lowest in-stock offer for the primary CTA', () => {
    expect(
      getBestOffer([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          priceCents: 47999,
          availability: 'out_of_stock',
        },
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 49499,
        },
      ]),
    ).toMatchObject({
      merchant: 'bol',
      merchantName: 'bol',
      priceCents: 48999,
    });
  });

  test('falls back to the best availability rank when none are in stock', () => {
    expect(
      getBestOffer([
        {
          ...baseOffer,
          availability: 'out_of_stock',
          priceCents: 19999,
        },
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          availability: 'unknown',
          priceCents: 20999,
        },
      ]),
    ).toMatchObject({
      availability: 'unknown',
      priceCents: 20999,
    });
  });

  test('selects the cheaper current purchasable offer over a strategic tiebreaker', () => {
    const coolblueOffer = {
      ...baseOffer,
      merchant: 'other' as const,
      merchantName: 'Coolblue',
      merchantSlug: 'coolblue',
      priceCents: 17_900,
    };
    const proshopOffer = {
      ...baseOffer,
      merchant: 'other' as const,
      merchantName: 'Proshop',
      merchantSlug: 'proshop',
      priceCents: 17_874,
    };

    expect(
      selectBestPurchasableOffer([coolblueOffer, proshopOffer], {
        strategicTieBreakerOffer: coolblueOffer,
      }),
    ).toMatchObject({
      offer: expect.objectContaining({
        merchantSlug: 'proshop',
        priceCents: 17_874,
      }),
      priceMinor: 17_874,
      selectionReason: 'lowest_price',
      debugSignals: expect.objectContaining({
        winningMerchant: 'Proshop',
        winningMerchantSlug: 'proshop',
        winningPriceMinor: 17_874,
      }),
    });
  });

  test('filters stale strategic offers before ranking current purchasable offers', () => {
    const staleCoolblueOffer = {
      ...baseOffer,
      checkedAt: '2026-06-06T12:16:00.000Z',
      merchant: 'other' as const,
      merchantName: 'Coolblue',
      merchantSlug: 'coolblue',
      priceCents: 17_870,
    };
    const proshopOffer = {
      ...baseOffer,
      checkedAt: '2026-06-14T12:06:01.670Z',
      merchant: 'other' as const,
      merchantName: 'Proshop',
      merchantSlug: 'proshop',
      priceCents: 17_874,
    };

    expect(
      selectBestPurchasableOffer([staleCoolblueOffer, proshopOffer], {
        now: new Date('2026-06-14T12:30:00.000Z'),
        strategicTieBreakerOffer: staleCoolblueOffer,
      }),
    ).toMatchObject({
      offer: expect.objectContaining({
        merchantSlug: 'proshop',
      }),
      debugSignals: expect.objectContaining({
        staleFilteredCount: 1,
      }),
    });
  });

  test('uses trusted and strategic ranking only as exact-price tiebreakers', () => {
    const coolblueOffer = {
      ...baseOffer,
      merchant: 'other' as const,
      merchantName: 'Coolblue',
      merchantSlug: 'coolblue',
      priceCents: 17_874,
    };
    const proshopOffer = {
      ...baseOffer,
      merchant: 'other' as const,
      merchantName: 'Proshop',
      merchantSlug: 'proshop',
      priceCents: 17_874,
    };
    const mediamarktOffer = {
      ...baseOffer,
      merchant: 'other' as const,
      merchantName: 'MediaMarkt',
      merchantSlug: 'mediamarkt',
      priceCents: 17_874,
    };
    const intertoysOffer = {
      ...baseOffer,
      merchant: 'other' as const,
      merchantName: 'Intertoys',
      merchantSlug: 'intertoys',
      priceCents: 17_874,
    };

    expect(
      selectBestPurchasableOffer([proshopOffer, coolblueOffer], {
        strategicTieBreakerOffer: proshopOffer,
      }).selectionReason,
    ).toBe('trusted_tiebreak');
    expect(
      selectBestPurchasableOffer([proshopOffer, mediamarktOffer], {
        strategicTieBreakerOffer: proshopOffer,
      }).offer,
    ).toMatchObject({
      merchantSlug: 'mediamarkt',
    });
    expect(
      selectBestPurchasableOffer([proshopOffer, intertoysOffer], {
        strategicTieBreakerOffer: intertoysOffer,
      }).selectionReason,
    ).toBe('strategic_tiebreak');
  });

  test('does not let out-of-stock lower prices win over in-stock offers', () => {
    expect(
      selectBestPurchasableOffer([
        {
          ...baseOffer,
          availability: 'out_of_stock',
          merchantName: 'Proshop',
          priceCents: 10_000,
        },
        {
          ...baseOffer,
          merchantName: 'Coolblue',
          priceCents: 12_000,
        },
      ]),
    ).toMatchObject({
      offer: expect.objectContaining({
        merchantName: 'Coolblue',
        priceCents: 12_000,
      }),
      debugSignals: expect.objectContaining({
        outOfStockFilteredCount: 1,
      }),
    });
  });

  test('normalizes supported merchant names', () => {
    expect(getCatalogOfferMerchantName('bol')).toBe('bol');
    expect(getCatalogOfferMerchantName('amazon')).toBe('Amazon');
    expect(getCatalogOfferMerchantName('lego')).toBe('LEGO');
  });

  test('maps reviewed affiliate snapshots into catalog offers without losing ordering', () => {
    expect(
      toCatalogOffers([
        {
          setId: '76269',
          merchantId: 'intertoys',
          merchantName: 'Intertoys',
          outboundUrl:
            'https://www.intertoys.nl/lego-marvel-avengers-toren-76269',
          totalPriceMinor: 48999,
          currencyCode: 'EUR',
          availabilityLabel: 'Limited stock',
          condition: 'new',
          observedAt: '2026-03-31T09:30:00.000Z',
          regionCode: 'NL',
          ctaLabel: 'Shop at Intertoys',
          disclosureCopy: 'Direct merchant link.',
          displayRank: 3,
        },
        {
          setId: '76269',
          merchantId: 'lego-nl',
          merchantName: 'LEGO',
          outboundUrl:
            'https://www.lego.com/nl-nl/product/avengers-tower-76269',
          totalPriceMinor: 49999,
          currencyCode: 'EUR',
          availabilityLabel: 'In stock',
          condition: 'new',
          observedAt: '2026-03-31T09:36:00.000Z',
          regionCode: 'NL',
          ctaLabel: 'Shop at LEGO',
          disclosureCopy: 'Direct official merchant link.',
          displayRank: 1,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        merchant: 'other',
        merchantName: 'Intertoys',
        priceCents: 48999,
        availability: 'in_stock',
        url: 'https://www.intertoys.nl/lego-marvel-avengers-toren-76269',
      }),
      expect.objectContaining({
        merchant: 'lego',
        merchantName: 'LEGO',
        priceCents: 49999,
        availability: 'in_stock',
      }),
    ]);
  });

  test('flags limited reviewed coverage when only a couple of offers exist', () => {
    expect(
      getCatalogOfferComparisonInsight([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 49999,
        },
      ]),
    ).toBe('Only 2 reviewed offers so far');
  });

  test('describes when reviewed shops are tightly clustered on price', () => {
    expect(
      getCatalogOfferComparisonInsight([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          priceCents: 49499,
        },
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 49799,
        },
      ]),
    ).toBe('Small price gap across reviewed shops');
  });

  test('describes when reviewed shops have a wide price gap', () => {
    expect(
      getCatalogOfferComparisonInsight([
        baseOffer,
        {
          ...baseOffer,
          merchant: 'amazon',
          merchantName: 'Amazon',
          priceCents: 51999,
        },
        {
          ...baseOffer,
          merchant: 'lego',
          merchantName: 'LEGO',
          priceCents: 52999,
        },
      ]),
    ).toBe('Wide price gap across reviewed shops');
  });

  test('renders affiliate generated modules in a Prettier-stable shape', async () => {
    const { format } = await import('prettier');
    const renderedModule = renderAffiliateOfferSnapshotsModule([
      {
        availabilityLabel: 'In stock',
        condition: 'new',
        currencyCode: 'EUR',
        ctaLabel: 'Shop at LEGO',
        disclosureCopy: 'Direct official merchant link.',
        displayRank: 1,
        merchantId: 'lego-nl',
        merchantName: 'LEGO',
        observedAt: '2026-04-03T09:00:00.000Z',
        outboundUrl: 'https://www.lego.com/nl-nl/product/rivendell-10316',
        regionCode: 'NL',
        setId: '10316',
        totalPriceMinor: 49999,
      },
    ]);

    await expect(
      format(renderedModule, {
        parser: 'typescript',
        singleQuote: true,
      }),
    ).resolves.toBe(renderedModule);
  });
});
