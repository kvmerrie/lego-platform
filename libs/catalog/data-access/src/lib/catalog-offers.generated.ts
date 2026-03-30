import type { CatalogSetRecord } from '@lego-platform/catalog/util';
import { catalogSnapshot } from './catalog-snapshot.generated';

type CatalogOfferMerchant = 'bol' | 'amazon' | 'lego' | 'other';
type CatalogOfferAvailability = 'in_stock' | 'out_of_stock' | 'unknown';

export interface CatalogOfferRecord {
  availability: CatalogOfferAvailability;
  checkedAt: string;
  condition: 'new';
  currency: 'EUR';
  market: 'NL';
  merchant: CatalogOfferMerchant;
  merchantName: string;
  priceCents: number;
  setId: string;
  url: string;
}

interface CatalogOfferSeed {
  amazonAvailability?: CatalogOfferAvailability;
  amazonPriceCents?: number;
  bolAvailability?: CatalogOfferAvailability;
  bolPriceCents?: number;
  checkedAt?: string;
  legoAvailability?: CatalogOfferAvailability;
  legoPriceCents?: number;
  setId: string;
}

const DEFAULT_CHECKED_AT = '2026-03-30T11:30:00.000Z';

const curatedOfferSeeds: readonly CatalogOfferSeed[] = [
  {
    setId: '10316',
    bolPriceCents: 48999,
    legoPriceCents: 49999,
    checkedAt: '2026-03-29T09:00:00.000Z',
  },
  {
    setId: '21348',
    bolPriceCents: 34999,
    legoPriceCents: 35999,
    checkedAt: '2026-03-29T09:15:00.000Z',
  },
  {
    setId: '76269',
    bolPriceCents: 47999,
    amazonPriceCents: 48999,
    legoPriceCents: 49999,
    checkedAt: '2026-03-29T09:30:00.000Z',
  },
  {
    setId: '10332',
    bolPriceCents: 21999,
    legoPriceCents: 22999,
    checkedAt: '2026-03-29T10:00:00.000Z',
  },
  {
    setId: '10333',
    bolPriceCents: 44999,
    legoPriceCents: 45999,
    checkedAt: '2026-03-29T09:45:00.000Z',
  },
  {
    setId: '21333',
    bolPriceCents: 15999,
    legoPriceCents: 16999,
    checkedAt: '2026-03-29T10:15:00.000Z',
  },
  {
    setId: '21349',
    bolPriceCents: 9999,
    legoPriceCents: 10999,
    checkedAt: '2026-03-29T10:30:00.000Z',
  },
  {
    setId: '10305',
    bolPriceCents: 39999,
    amazonPriceCents: 40999,
    amazonAvailability: 'unknown',
    legoPriceCents: 38999,
    checkedAt: '2026-03-30T11:05:00.000Z',
  },
  {
    setId: '10294',
    bolPriceCents: 68999,
    amazonPriceCents: 69999,
    legoPriceCents: 71999,
    legoAvailability: 'out_of_stock',
    checkedAt: '2026-03-30T11:10:00.000Z',
  },
  {
    setId: '21061',
    bolPriceCents: 22999,
    amazonPriceCents: 21999,
    legoPriceCents: 23999,
    legoAvailability: 'out_of_stock',
    checkedAt: '2026-03-30T11:15:00.000Z',
  },
  {
    setId: '76419',
    bolPriceCents: 14999,
    amazonPriceCents: 15499,
    legoPriceCents: 15999,
    checkedAt: '2026-03-30T11:20:00.000Z',
  },
  {
    setId: '43222',
    bolPriceCents: 39999,
    bolAvailability: 'unknown',
    amazonPriceCents: 40999,
    legoPriceCents: 38999,
    checkedAt: '2026-03-30T11:25:00.000Z',
  },
  {
    setId: '75331',
    bolPriceCents: 57999,
    amazonPriceCents: 58999,
    legoPriceCents: 59999,
    checkedAt: '2026-03-30T11:30:00.000Z',
  },
  {
    setId: '42143',
    bolPriceCents: 41999,
    amazonPriceCents: 40999,
    legoPriceCents: 42999,
    checkedAt: '2026-03-30T11:35:00.000Z',
  },
  {
    setId: '76417',
    bolPriceCents: 40999,
    amazonPriceCents: 42499,
    legoPriceCents: 41999,
    checkedAt: '2026-03-30T11:40:00.000Z',
  },
] as const;

const curatedOfferSeedBySetId = new Map(
  curatedOfferSeeds.map((curatedOfferSeed) => [
    curatedOfferSeed.setId,
    curatedOfferSeed,
  ]),
);

function getCatalogOfferMerchantName(merchant: CatalogOfferMerchant): string {
  if (merchant === 'amazon') {
    return 'Amazon';
  }

  if (merchant === 'lego') {
    return 'LEGO';
  }

  if (merchant === 'other') {
    return 'Other';
  }

  return 'bol';
}

function createMerchantUrl({
  merchant,
  sourceSetNumber,
}: {
  merchant: CatalogOfferMerchant;
  sourceSetNumber: string;
}): string {
  const query = encodeURIComponent(`LEGO ${sourceSetNumber}`);

  if (merchant === 'bol') {
    return `https://www.bol.com/nl/nl/s/?searchtext=${query}`;
  }

  if (merchant === 'amazon') {
    return `https://www.amazon.nl/s?k=${query}`;
  }

  if (merchant === 'lego') {
    return `https://www.lego.com/nl-nl/search?q=${encodeURIComponent(sourceSetNumber)}`;
  }

  return `https://www.google.com/search?q=${query}`;
}

function createDefaultOfferSeed({
  catalogSetRecord,
  index,
}: {
  catalogSetRecord: CatalogSetRecord;
  index: number;
}): CatalogOfferSeed {
  const basePriceCents = Math.max(
    3499,
    Math.round(
      (catalogSetRecord.pieces * 0.084 +
        Math.max(catalogSetRecord.releaseYear - 2020, 0) * 1.25) *
        100,
    ),
  );

  return {
    setId: catalogSetRecord.canonicalId,
    bolPriceCents: basePriceCents - 600 - (index % 3) * 100,
    amazonPriceCents: basePriceCents + (index % 2 === 0 ? 100 : 300),
    amazonAvailability: index % 6 === 0 ? 'unknown' : 'in_stock',
    legoPriceCents: basePriceCents + 900,
    legoAvailability: index % 9 === 0 ? 'out_of_stock' : 'in_stock',
  };
}

function createCatalogOffer({
  availability = 'in_stock',
  checkedAt,
  merchant,
  priceCents,
  sourceSetNumber,
  setId,
}: {
  availability?: CatalogOfferAvailability;
  checkedAt: string;
  merchant: CatalogOfferMerchant;
  priceCents: number;
  sourceSetNumber: string;
  setId: string;
}): CatalogOfferRecord {
  return {
    setId,
    merchant,
    merchantName: getCatalogOfferMerchantName(merchant),
    url: createMerchantUrl({
      merchant,
      sourceSetNumber,
    }),
    priceCents,
    currency: 'EUR',
    availability,
    condition: 'new',
    checkedAt,
    market: 'NL',
  };
}

function createCatalogOffersForSet({
  catalogSetRecord,
  index,
}: {
  catalogSetRecord: CatalogSetRecord;
  index: number;
}): CatalogOfferRecord[] {
  const offerSeed =
    curatedOfferSeedBySetId.get(catalogSetRecord.canonicalId) ??
    createDefaultOfferSeed({
      catalogSetRecord,
      index,
    });
  const checkedAt = offerSeed.checkedAt ?? DEFAULT_CHECKED_AT;
  const catalogOffers: CatalogOfferRecord[] = [];

  if (typeof offerSeed.bolPriceCents === 'number') {
    catalogOffers.push(
      createCatalogOffer({
        setId: catalogSetRecord.canonicalId,
        sourceSetNumber: catalogSetRecord.sourceSetNumber,
        merchant: 'bol',
        priceCents: offerSeed.bolPriceCents,
        availability: offerSeed.bolAvailability,
        checkedAt,
      }),
    );
  }

  if (typeof offerSeed.amazonPriceCents === 'number') {
    catalogOffers.push(
      createCatalogOffer({
        setId: catalogSetRecord.canonicalId,
        sourceSetNumber: catalogSetRecord.sourceSetNumber,
        merchant: 'amazon',
        priceCents: offerSeed.amazonPriceCents,
        availability: offerSeed.amazonAvailability,
        checkedAt,
      }),
    );
  }

  if (typeof offerSeed.legoPriceCents === 'number') {
    catalogOffers.push(
      createCatalogOffer({
        setId: catalogSetRecord.canonicalId,
        sourceSetNumber: catalogSetRecord.sourceSetNumber,
        merchant: 'lego',
        priceCents: offerSeed.legoPriceCents,
        availability: offerSeed.legoAvailability,
        checkedAt,
      }),
    );
  }

  return catalogOffers;
}

export const catalogOffers: readonly CatalogOfferRecord[] =
  catalogSnapshot.setRecords.flatMap((catalogSetRecord, index) =>
    createCatalogOffersForSet({
      catalogSetRecord,
      index,
    }),
  );
