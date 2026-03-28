import {
  getWishlistOverview,
  listWishlistItems,
} from '@lego-platform/wishlist/data-access';
import { buildWishlistMetrics } from '@lego-platform/wishlist/util';
import { WishlistItemCard } from '@lego-platform/wishlist/ui';

export function WishlistFeatureWishlistOverview() {
  const wishlistOverview = getWishlistOverview();
  const wishlistMetrics = buildWishlistMetrics(wishlistOverview);
  const wishlistItems = listWishlistItems();

  return (
    <section className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Wishlist overview</p>
        <h2>
          High-intent watchlists ready for offer triggers and reminder
          workflows.
        </h2>
      </header>
      <div className="metric-grid">
        {wishlistMetrics.map((wishlistMetric) => (
          <article className="metric-card" key={wishlistMetric.label}>
            <p className="eyebrow">{wishlistMetric.label}</p>
            <h3 className="metric-value">{wishlistMetric.value}</h3>
            <p className="muted">{wishlistMetric.detail}</p>
          </article>
        ))}
      </div>
      <div className="surface-grid">
        {wishlistItems.map((wishlistItem) => (
          <WishlistItemCard key={wishlistItem.id} wishlistItem={wishlistItem} />
        ))}
      </div>
    </section>
  );
}

export default WishlistFeatureWishlistOverview;
