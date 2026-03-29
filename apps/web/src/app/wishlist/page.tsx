import { ShellFeatureCollectorWishlist } from '@lego-platform/shell/feature-collector-wishlist';
import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuth } from '@lego-platform/user/feature-auth';

export default function WishlistPage() {
  return (
    <ShellWeb>
      <section aria-label="Collector account">
        <UserFeatureAuth />
      </section>
      <ShellFeatureCollectorWishlist />
    </ShellWeb>
  );
}
