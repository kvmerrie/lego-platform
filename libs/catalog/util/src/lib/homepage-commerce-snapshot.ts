export const HOMEPAGE_COMMERCE_SNAPSHOT_COLLECTION_SLUG = 'homepage-commerce';
export const HOMEPAGE_COMMERCE_SNAPSHOT_SORT_KEY = 'intent-v1';
export const HOMEPAGE_COMMERCE_SNAPSHOT_PAGE = 1;
export const HOMEPAGE_COMMERCE_SNAPSHOT_PAGE_SIZE = 1;

export interface HomepageCommerceCard {
  setId: string;
  slug: string;
  name: string;
  imageUrl: string;
  theme?: string;
  releaseYear?: number;
  pieces?: number;
  currentPriceMinor?: number;
  merchantName?: string;
  merchantSlug?: string;
  dealLabel?: string;
  confidenceLabel?: string;
  ctaUrl?: string;
  followRecommended?: boolean;
}

export interface HomepageCommerceSnapshot {
  generatedAt: string;
  buyRail: {
    bestDeals: HomepageCommerceCard[];
    popularThisWeek: HomepageCommerceCard[];
    giftsUnder100: HomepageCommerceCard[];
  };
  followRail: {
    smartToFollow: HomepageCommerceCard[];
    biggestPriceDrops: HomepageCommerceCard[];
    waitCanPayOff: HomepageCommerceCard[];
  };
}

export function createEmptyHomepageCommerceSnapshot(
  generatedAt: string,
): HomepageCommerceSnapshot {
  return {
    generatedAt,
    buyRail: {
      bestDeals: [],
      popularThisWeek: [],
      giftsUnder100: [],
    },
    followRail: {
      smartToFollow: [],
      biggestPriceDrops: [],
      waitCanPayOff: [],
    },
  };
}
