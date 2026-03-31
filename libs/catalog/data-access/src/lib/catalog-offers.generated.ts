import type { CatalogSetRecord } from '@lego-platform/catalog/util';
import { catalogSetOverlays } from './catalog-overlays';
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
  amazonUrl?: string;
  bolAvailability?: CatalogOfferAvailability;
  bolPriceCents?: number;
  bolUrl?: string;
  checkedAt?: string;
  legoAvailability?: CatalogOfferAvailability;
  legoPriceCents?: number;
  legoUrl?: string;
  setId: string;
}

const DEFAULT_CHECKED_AT = '2026-03-31T10:45:00.000Z';

const catalogSetOverlayById = new Map(
  catalogSetOverlays.map((catalogSetOverlay) => [
    catalogSetOverlay.canonicalId,
    catalogSetOverlay,
  ]),
);

const curatedOfferSeeds: readonly CatalogOfferSeed[] = [
  {
    setId: '10316',
    bolPriceCents: 46999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-10316-the-lord-of-the-rings-rivendell/9300000144104277/',
    legoPriceCents: 49999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
    checkedAt: '2026-03-31T09:00:00.000Z',
  },
  {
    setId: '21348',
    bolPriceCents: 33499,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-ideas-dungeons-dragons-het-verhaal-van-de-rode-draak-21348/9300000175725314/',
    legoPriceCents: 35999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/dungeons-dragons-red-dragons-tale-21348',
    checkedAt: '2026-03-31T09:12:00.000Z',
  },
  {
    setId: '76269',
    bolPriceCents: 46999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-avengers-toren-lego-marvel/9300000168131115/',
    amazonPriceCents: 47999,
    legoPriceCents: 49999,
    legoUrl: 'https://www.lego.com/nl-nl/product/avengers-tower-76269',
    checkedAt: '2026-03-31T09:24:00.000Z',
  },
  {
    setId: '10332',
    bolPriceCents: 21499,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-icons-middeleeuws-stadsplein-10332/9300000173010312/',
    legoPriceCents: 22999,
    legoUrl: 'https://www.lego.com/nl-nl/product/medieval-town-square-10332',
    checkedAt: '2026-03-31T09:44:00.000Z',
  },
  {
    setId: '10333',
    bolPriceCents: 43999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-de-lord-of-the-rings-barad-majoor-10333/9300000180281419/',
    legoPriceCents: 45999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-barad-dur-10333',
    checkedAt: '2026-03-31T09:56:00.000Z',
  },
  {
    setId: '21333',
    bolPriceCents: 14999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-ideas-vincent-van-gogh-sterrennacht-21333/9300000070995024/',
    legoPriceCents: 16999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/vincent-van-gogh-the-starry-night-21333',
    checkedAt: '2026-03-31T10:08:00.000Z',
  },
  {
    setId: '21349',
    bolPriceCents: 9499,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-ideas-zwart-witte-kat-21349/9300000173010346/',
    legoPriceCents: 10999,
    legoUrl: 'https://www.lego.com/nl-nl/product/tuxedo-cat-21349',
    checkedAt: '2026-03-31T10:20:00.000Z',
  },
  {
    setId: '10305',
    bolPriceCents: 39999,
    amazonPriceCents: 38999,
    legoPriceCents: 37999,
    legoUrl: 'https://www.lego.com/nl-nl/product/lion-knights-castle-10305',
    checkedAt: '2026-03-31T10:24:00.000Z',
  },
  {
    setId: '10294',
    bolPriceCents: 68999,
    amazonPriceCents: 67999,
    legoPriceCents: 65999,
    legoUrl: 'https://www.lego.com/nl-nl/product/titanic-10294',
    checkedAt: '2026-03-31T10:28:00.000Z',
  },
  {
    setId: '21061',
    bolPriceCents: 23999,
    amazonPriceCents: 22999,
    legoPriceCents: 21999,
    legoUrl: 'https://www.lego.com/nl-nl/product/notre-dame-de-paris-21061',
    checkedAt: '2026-03-31T10:32:00.000Z',
  },
  {
    setId: '76419',
    bolPriceCents: 15999,
    amazonPriceCents: 15499,
    legoPriceCents: 14999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/hogwarts-castle-and-grounds-76419',
    checkedAt: '2026-03-31T10:34:00.000Z',
  },
  {
    setId: '43222',
    bolPriceCents: 39999,
    bolAvailability: 'unknown',
    amazonPriceCents: 38999,
    legoPriceCents: 37999,
    legoUrl: 'https://www.lego.com/nl-nl/product/disney-castle-43222',
    checkedAt: '2026-03-31T10:36:00.000Z',
  },
  {
    setId: '75331',
    bolPriceCents: 59999,
    amazonPriceCents: 58999,
    legoPriceCents: 57999,
    legoUrl: 'https://www.lego.com/nl-nl/product/the-razor-crest-75331',
    checkedAt: '2026-03-31T10:38:00.000Z',
  },
  {
    setId: '42143',
    bolPriceCents: 43999,
    amazonPriceCents: 42999,
    legoPriceCents: 41999,
    legoUrl: 'https://www.lego.com/nl-nl/product/ferrari-daytona-sp3-42143',
    checkedAt: '2026-03-31T10:40:00.000Z',
  },
  {
    setId: '76417',
    bolPriceCents: 41999,
    amazonPriceCents: 40999,
    legoPriceCents: 39999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/gringotts-wizarding-bank-collectors-edition-76417',
    checkedAt: '2026-03-31T10:42:00.000Z',
  },
  {
    setId: '76178',
    bolPriceCents: 33999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-spider-man-daily-bugle-76178/9300000040027340/',
    amazonPriceCents: 32999,
    legoPriceCents: 31999,
    legoUrl: 'https://www.lego.com/nl-nl/product/daily-bugle-76178',
    checkedAt: '2026-03-31T10:44:00.000Z',
  },
  {
    setId: '75367',
    bolPriceCents: 64999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-star-wars-venator-class-republic-attack-cruiser-75367/9300000161235312/',
    amazonPriceCents: 63999,
    legoPriceCents: 62999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/venator-class-republic-attack-cruiser-75367',
    checkedAt: '2026-03-31T10:46:00.000Z',
  },
  {
    setId: '21350',
    bolPriceCents: 15999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-21350-jaws-lego-ideas/9300000185934485/',
    amazonPriceCents: 15499,
    legoPriceCents: 14999,
    legoUrl: 'https://www.lego.com/nl-nl/product/jaws-21350',
    checkedAt: '2026-03-31T10:48:00.000Z',
  },
  {
    setId: '10317',
    bolPriceCents: 24999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-10317-land-rover-classic-defender-90/9300000137836645/',
    amazonPriceCents: 23999,
    legoPriceCents: 22999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/land-rover-classic-defender-90-10317',
    checkedAt: '2026-03-31T10:50:00.000Z',
  },
  {
    setId: '76437',
    bolPriceCents: 27999,
    bolUrl:
      'https://www.bol.com/be/fr/p/lego-harry-potter-le-nest-edition-collector/9300000188627176/',
    amazonPriceCents: 26999,
    legoPriceCents: 25999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/the-burrow-collectors-edition-76437',
    checkedAt: '2026-03-31T10:58:00.000Z',
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
  url,
}: {
  merchant: CatalogOfferMerchant;
  sourceSetNumber: string;
  url?: string;
}): string {
  if (url) {
    return url;
  }

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

function getOverlayDrivenBasePriceCents(setId: string): number | undefined {
  const priceRange = catalogSetOverlayById.get(setId)?.priceRange;

  if (!priceRange) {
    return undefined;
  }

  const priceBounds = [...priceRange.matchAll(/\d+/g)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value));

  if (priceBounds.length < 2) {
    return undefined;
  }

  const [lowPrice, highPrice] = priceBounds;
  const midpointPrice = (lowPrice + highPrice) / 2;

  return Math.max(2999, Math.round(midpointPrice * 0.93 * 100));
}

function createDefaultOfferSeed({
  catalogSetRecord,
  index,
}: {
  catalogSetRecord: CatalogSetRecord;
  index: number;
}): CatalogOfferSeed {
  const basePriceCents =
    getOverlayDrivenBasePriceCents(catalogSetRecord.canonicalId) ??
    Math.max(
      3499,
      Math.round(
        (catalogSetRecord.pieces * 0.084 +
          Math.max(catalogSetRecord.releaseYear - 2020, 0) * 1.25) *
          100,
      ),
    );
  const bolDiscountCents = Math.max(250, Math.round(basePriceCents * 0.018));
  const amazonPremiumCents = Math.max(150, Math.round(basePriceCents * 0.012));
  const legoPremiumCents = Math.max(400, Math.round(basePriceCents * 0.03));

  return {
    setId: catalogSetRecord.canonicalId,
    bolPriceCents: Math.max(
      1999,
      basePriceCents - bolDiscountCents - (index % 3) * 100,
    ),
    amazonPriceCents: basePriceCents + amazonPremiumCents + (index % 2) * 100,
    amazonAvailability: index % 6 === 0 ? 'unknown' : 'in_stock',
    legoPriceCents: basePriceCents + legoPremiumCents,
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
  url,
}: {
  availability?: CatalogOfferAvailability;
  checkedAt: string;
  merchant: CatalogOfferMerchant;
  priceCents: number;
  sourceSetNumber: string;
  setId: string;
  url?: string;
}): CatalogOfferRecord {
  return {
    setId,
    merchant,
    merchantName: getCatalogOfferMerchantName(merchant),
    url: createMerchantUrl({
      merchant,
      sourceSetNumber,
      url,
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
        url: offerSeed.bolUrl,
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
        url: offerSeed.amazonUrl,
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
        url: offerSeed.legoUrl,
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
