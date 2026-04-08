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
    amazonUrl:
      'https://www.amazon.nl/LEGO-Icons-Lord-Rings-Volwassenen/dp/B0D5W8J5YV?crid=1QE7VASRCMMR9&dib=eyJ2IjoiMSJ9.eV5BU8F5Ha1yyEu_F_vgmEKim5bT_3YvCs2RerWlwJyWuIR9CHE9Z1hlZtZXid3H67EJUcgC2FBFejFah9GZBvHM3e-FY5Skj2G4BeG6EiNfmz_uw5MBLdskSzhbaBp1xL5AlIObvlQ1VWGXkp6wDCOUDihWjMu5rigLD4RZ48L5ZvW9EDEm6_8oc3zdOBNnpzK62sNU5exLTk_Htx2KQMPRsia_KBNTyBOu5axXB8hBuHkLbdq7u9LJpG9QuqrxQrW3gZE7pLNIeT8yVzIr1PWxhZVjX4p64JyYwJAWnXI.EqW7AfVVNsD_wUsKUmLmC1-aSmZh5idcYTmfiq9FBiM&dib_tag=se&keywords=lego+barad+dur&qid=1775676559&sprefix=lego+barad+%2Caps%2C97&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=227c8553e0817d5fd416b416863617b2&ref_=as_li_ss_tl',
    amazonPriceCents: 42829,
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
    legoPriceCents: 37999,
    legoUrl: 'https://www.lego.com/nl-nl/product/lion-knights-castle-10305',
    checkedAt: '2026-03-31T10:24:00.000Z',
  },
  {
    setId: '10294',
    legoPriceCents: 65999,
    legoUrl: 'https://www.lego.com/nl-nl/product/titanic-10294',
    checkedAt: '2026-03-31T10:28:00.000Z',
  },
  {
    setId: '21061',
    legoPriceCents: 21999,
    legoUrl: 'https://www.lego.com/nl-nl/product/notre-dame-de-paris-21061',
    checkedAt: '2026-03-31T10:32:00.000Z',
  },
  {
    setId: '76419',
    legoPriceCents: 14999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/hogwarts-castle-and-grounds-76419',
    checkedAt: '2026-03-31T10:34:00.000Z',
  },
  {
    setId: '43222',
    legoPriceCents: 37999,
    legoUrl: 'https://www.lego.com/nl-nl/product/disney-castle-43222',
    checkedAt: '2026-03-31T10:36:00.000Z',
  },
  {
    setId: '75331',
    legoPriceCents: 57999,
    legoUrl: 'https://www.lego.com/nl-nl/product/the-razor-crest-75331',
    checkedAt: '2026-03-31T10:38:00.000Z',
  },
  {
    setId: '42143',
    legoPriceCents: 41999,
    legoUrl: 'https://www.lego.com/nl-nl/product/ferrari-daytona-sp3-42143',
    checkedAt: '2026-03-31T10:40:00.000Z',
  },
  {
    setId: '76417',
    legoPriceCents: 39999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/gringotts-wizarding-bank-collectors-edition-76417',
    checkedAt: '2026-03-31T10:42:00.000Z',
  },
  {
    setId: '76178',
    bolPriceCents: 32999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-spider-man-daily-bugle-76178/9300000040027340/',
    legoPriceCents: 33999,
    legoUrl: 'https://www.lego.com/nl-nl/product/daily-bugle-76178',
    checkedAt: '2026-03-31T10:44:00.000Z',
  },
  {
    setId: '75367',
    bolPriceCents: 63999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-star-wars-venator-class-republic-attack-cruiser-75367/9300000161235312/',
    legoPriceCents: 64999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/venator-class-republic-attack-cruiser-75367',
    checkedAt: '2026-03-31T10:52:00.000Z',
  },
  {
    setId: '21350',
    bolPriceCents: 15499,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-21350-jaws-lego-ideas/9300000185934485/',
    legoPriceCents: 15999,
    legoUrl: 'https://www.lego.com/nl-nl/product/jaws-21350',
    checkedAt: '2026-03-31T11:00:00.000Z',
  },
  {
    setId: '10317',
    bolPriceCents: 22999,
    bolUrl:
      'https://www.bol.com/nl/nl/p/lego-10317-land-rover-classic-defender-90/9300000137836645/',
    legoPriceCents: 23999,
    legoUrl:
      'https://www.lego.com/nl-nl/product/land-rover-classic-defender-90-10317',
    checkedAt: '2026-03-31T11:08:00.000Z',
  },
  {
    setId: '76437',
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
  url,
}: {
  merchant: CatalogOfferMerchant;
  url?: string;
}): string {
  if (!url) {
    throw new Error(`Missing direct ${merchant} offer URL.`);
  }

  return url;
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
    legoPriceCents:
      basePriceCents + Math.max(300, Math.round(basePriceCents * 0.018)),
    legoAvailability: index % 9 === 0 ? 'out_of_stock' : 'in_stock',
    legoUrl: `https://www.lego.com/nl-nl/product/${catalogSetRecord.slug}`,
  };
}

function createCatalogOffer({
  availability = 'in_stock',
  checkedAt,
  merchant,
  priceCents,
  setId,
  url,
}: {
  availability?: CatalogOfferAvailability;
  checkedAt: string;
  merchant: CatalogOfferMerchant;
  priceCents: number;
  setId: string;
  url?: string;
}): CatalogOfferRecord {
  return {
    setId,
    merchant,
    merchantName: getCatalogOfferMerchantName(merchant),
    url: createMerchantUrl({
      merchant,
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

  if (
    typeof offerSeed.bolPriceCents === 'number' &&
    typeof offerSeed.bolUrl === 'string'
  ) {
    catalogOffers.push(
      createCatalogOffer({
        setId: catalogSetRecord.canonicalId,
        merchant: 'bol',
        priceCents: offerSeed.bolPriceCents,
        availability: offerSeed.bolAvailability,
        checkedAt,
        url: offerSeed.bolUrl,
      }),
    );
  }

  if (
    typeof offerSeed.amazonPriceCents === 'number' &&
    typeof offerSeed.amazonUrl === 'string'
  ) {
    catalogOffers.push(
      createCatalogOffer({
        setId: catalogSetRecord.canonicalId,
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
