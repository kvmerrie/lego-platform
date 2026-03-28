import { getWishlistOverview } from '@lego-platform/wishlist/data-access';

export function WishlistFeatureWishlistToggle() {
  const wishlistOverview = getWishlistOverview();

  return (
    <section className="surface split-card">
      <div className="stack">
        <p className="eyebrow">Quick action</p>
        <h2 className="surface-title">
          Keep {wishlistOverview.highPriority} high-priority sets under active
          review.
        </h2>
        <p className="muted">
          This foundation keeps future toggle behavior in a feature library
          rather than scattering domain events through page code.
        </p>
      </div>
      <a className="link-button" href="#pricing">
        Inspect price signals
      </a>
    </section>
  );
}

export default WishlistFeatureWishlistToggle;
