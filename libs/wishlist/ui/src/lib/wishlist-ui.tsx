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

export function WantedSetToggleCard({
  errorMessage,
  isLoading,
  isPending,
  isWanted,
  onToggle,
  setId,
}: {
  errorMessage?: string;
  isLoading?: boolean;
  isPending?: boolean;
  isWanted: boolean;
  onToggle: () => void;
  setId: string;
}) {
  const title = isWanted
    ? 'This set is currently on your wanted list.'
    : 'Keep this set on your radar for a future purchase.';
  const actionLabel = isWanted ? 'Remove from wanted' : 'Mark as wanted';

  return (
    <article className="surface split-card">
      <div className="stack">
        <p className="eyebrow">Wanted status</p>
        <h2 className="surface-title">{title}</h2>
        <p className="muted">
          Set {setId} keeps its wanted flag independently from owned state.
        </p>
        {errorMessage ? <p className="muted">{errorMessage}</p> : null}
      </div>
      <button
        className="action-button"
        disabled={Boolean(isLoading || isPending)}
        type="button"
        onClick={onToggle}
      >
        {isLoading ? 'Checking wanted state...' : isPending ? 'Saving...' : actionLabel}
      </button>
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
