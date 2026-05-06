import { webPathnames } from '@lego-platform/shared/config';
import { ShellFeatureCollectorWishlist } from '@lego-platform/shell/feature-collector-wishlist';
import { ShellWeb } from '@lego-platform/shell/web';
import { getUtilityRouteMetadata } from '../../lib/utility-route-metadata';

export const metadata = getUtilityRouteMetadata(webPathnames.wishlist);

export default function AccountWishlistPage() {
  return (
    <ShellWeb>
      <ShellFeatureCollectorWishlist />
    </ShellWeb>
  );
}
