import { Button, Badge, SectionHeading, Surface } from '@lego-platform/shared/ui';
import { WishlistItem } from '@lego-platform/wishlist/util';
import styles from './wishlist-ui.module.css';

export function WishlistItemCard({
  wishlistItem,
}: {
  wishlistItem: WishlistItem;
}) {
  return (
    <Surface as="article" className={styles.itemCard} tone="muted">
      <div className={styles.itemHeader}>
        <h3 className={styles.title}>{wishlistItem.name}</h3>
        <Badge tone="accent">{wishlistItem.urgency}</Badge>
      </div>
      <p>{wishlistItem.reason}</p>
      <p className={styles.metaText}>Target price: {wishlistItem.targetPrice}</p>
    </Surface>
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
    <Surface
      as="article"
      className={styles.toggleCard}
      elevation="rested"
      tone={isWanted ? 'accent' : 'default'}
    >
      <div className={styles.toggleMeta}>
        <Badge tone={isWanted ? 'accent' : 'neutral'}>Wanted status</Badge>
        <Badge tone="info">Set {setId}</Badge>
      </div>
      <SectionHeading
        description={`Set ${setId} keeps its wanted flag independently from owned state.`}
        title={title}
        titleAs="h2"
      />
      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      <Button
        className={styles.toggleButton}
        isLoading={Boolean(isLoading || isPending)}
        tone={isWanted ? 'secondary' : 'accent'}
        type="button"
        onClick={onToggle}
      >
        {isLoading ? 'Checking wanted state...' : isPending ? 'Saving...' : actionLabel}
      </Button>
    </Surface>
  );
}

export function WishlistUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Focus cards and watchlist-ready states for future price triggers."
        eyebrow="Wishlist UI"
        title="Wanted-state surfaces that stay clear, calm, and collector-first."
      />
    </Surface>
  );
}

export default WishlistUi;
