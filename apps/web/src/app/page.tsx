import { AffiliateFeatureOffers } from '@lego-platform/affiliate/feature-offers';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import { CatalogFeatureSetList } from '@lego-platform/catalog/feature-set-list';
import { CatalogFeatureThemeList } from '@lego-platform/catalog/feature-theme-list';
import { CollectionFeatureCollectionEditor } from '@lego-platform/collection/feature-collection-editor';
import { CollectionFeatureCollectionOverview } from '@lego-platform/collection/feature-collection-overview';
import { ContentFeaturePageRenderer } from '@lego-platform/content/feature-page-renderer';
import { ContentFeaturePreview } from '@lego-platform/content/feature-preview';
import { PricingFeaturePriceHistory } from '@lego-platform/pricing/feature-price-history';
import { PricingFeaturePricePanel } from '@lego-platform/pricing/feature-price-panel';
import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuth } from '@lego-platform/user/feature-auth';
import { UserFeatureProfile } from '@lego-platform/user/feature-profile';
import { WishlistFeatureWishlistOverview } from '@lego-platform/wishlist/feature-wishlist-overview';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';

export default function Index() {
  return (
    <ShellWeb>
      <ContentFeaturePageRenderer />
      <UserFeatureAuth />
      <UserFeatureProfile />
      <CatalogFeatureSetDetail />
      <CatalogFeatureSetList />
      <CatalogFeatureThemeList />
      <CollectionFeatureCollectionOverview />
      <CollectionFeatureCollectionEditor />
      <WishlistFeatureWishlistOverview />
      <WishlistFeatureWishlistToggle />
      <PricingFeaturePricePanel />
      <PricingFeaturePriceHistory />
      <AffiliateFeatureOffers />
      <ContentFeaturePreview />
    </ShellWeb>
  );
}
