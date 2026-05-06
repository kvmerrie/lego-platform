import { webPathnames } from '@lego-platform/shared/config';
import { WishlistFeatureWishlistOverview } from '@lego-platform/wishlist/feature-wishlist-overview';
import { ShellWeb } from '@lego-platform/shell/web';
import { getUtilityRouteMetadata } from '../lib/utility-route-metadata';

export const metadata = getUtilityRouteMetadata(webPathnames.following);

export default function FollowingPage() {
  return (
    <ShellWeb>
      <WishlistFeatureWishlistOverview />
    </ShellWeb>
  );
}
