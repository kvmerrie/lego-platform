import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import type { CatalogSetCardPriceContext } from '@lego-platform/catalog/ui';

export interface ArticleSetSpotlightItem {
  availabilityLabel?: string;
  ctaHref: string;
  ctaLabel?: string;
  priceContext?: CatalogSetCardPriceContext;
  priceValue?: string;
  setSummary: CatalogHomepageSetCard;
}
