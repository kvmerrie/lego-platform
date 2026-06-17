import type {
  CatalogPublicThemeReference,
  CatalogSetDisplayTitleSource,
} from './catalog-util';

export const THEME_COMMERCE_SNAPSHOT_SORT_KEY = 'intent-v1';
export const THEME_COMMERCE_SNAPSHOT_PAGE = 1;
export const THEME_COMMERCE_SNAPSHOT_PAGE_SIZE = 1;

export type ThemeCommerceSnapshotHealth = 'empty' | 'healthy' | 'partial';

export interface ThemeCommerceCard {
  setId: string;
  slug: string;
  catalogName?: string;
  displayTitle?: string;
  displayTitleSource?: CatalogSetDisplayTitleSource;
  name: string;
  imageUrl: string;
  publicTheme?: CatalogPublicThemeReference;
  theme?: string;
  releaseYear?: number;
  pieces?: number;
  currentPriceMinor?: number;
  merchantName?: string;
  merchantSlug?: string;
  ctaUrl?: string;
  dealLabel?: string;
  confidenceLabel?: string;
  followRecommended?: boolean;
}

export interface ThemeBrowsePriceContext {
  priceLabel?: string;
  currentPriceMinor?: number;
  merchantName?: string;
  merchantSlug?: string;
  ctaUrl?: string;
  dealLabel?: string;
  confidenceLabel?: string;
}

export interface ThemeCommerceSnapshot {
  themeSlug: string;
  generatedAt: string;
  sourceVersion: string;
  featuredDeals: ThemeCommerceCard[];
  browsePriceContextBySetId: Record<string, ThemeBrowsePriceContext>;
  stats: {
    totalSetCount: number;
    pricedSetCount: number;
    featuredDealCount: number;
    snapshotHealth: ThemeCommerceSnapshotHealth;
  };
}

export function buildThemeCommerceSnapshotCollectionSlug(
  themeSlug: string,
): string {
  return `theme-commerce:${themeSlug.trim()}`;
}
