import { WishlistItem } from '@lego-platform/wishlist/util';

export function WishlistItemCard({
  wishlistItem,
}: {
  wishlistItem: WishlistItem;
}) {
  return (
    <article className="surface stack">
      <div className="split-row">
        <h3 className="surface-title">{wishlistItem.name}</h3>
        <span className="pill">{wishlistItem.urgency}</span>
      </div>
      <p>{wishlistItem.reason}</p>
      <p className="muted">Target price: {wishlistItem.targetPrice}</p>
    </article>
  );
}

export function WishlistUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">Wishlist UI</p>
      <h2 className="surface-title">
        Focus cards and watchlist-ready states for future price triggers.
      </h2>
    </section>
  );
}

export default WishlistUi;
