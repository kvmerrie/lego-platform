export type CollectionCommerceIntent = 'follow' | 'merchant' | 'setdetail';

export interface CollectionCommerceCard {
  setId: string;
  slug: string;
  currentPriceMinor?: number;
  merchantName?: string;
  merchantSlug?: string;
  dealLabel?: string;
  confidenceLabel?: string;
  primaryActionHref?: string;
  commerceIntent?: CollectionCommerceIntent;
  followRecommended?: boolean;
}
