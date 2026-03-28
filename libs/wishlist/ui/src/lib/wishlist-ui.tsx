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
  hasResolvedState,
  isLoading,
  isPending,
  isWanted,
  onToggle,
  setId,
}: {
  errorMessage?: string;
  hasResolvedState: boolean;
  isLoading?: boolean;
  isPending?: boolean;
  isWanted: boolean;
  onToggle: () => void;
  setId: string;
}) {
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? 'Checking wanted status for this set.'
    : isUnavailable
      ? 'Wanted status is unavailable right now.'
      : isWanted
        ? 'This set is currently on your wanted list.'
        : 'Keep this set on your radar for a future purchase.';
  const description = isLoading
    ? `Loading the current wanted flag for set ${setId}.`
    : isUnavailable
      ? `Set ${setId} cannot be updated until the wanted-state query succeeds.`
      : `Set ${setId} keeps its wanted flag independently from owned state.`;
  const actionLabel = isUnavailable
    ? 'Wanted status unavailable'
    : isWanted
      ? 'Remove from wanted'
      : 'Mark as wanted';
  const statusTone = isLoading
    ? 'info'
    : isUnavailable
      ? 'error'
      : isWanted
        ? 'accent'
        : 'neutral';
  const statusLabel = isLoading
    ? 'Loading state'
    : isUnavailable
      ? 'State unavailable'
      : isWanted
        ? 'Wanted'
        : 'Not wanted';

  return (
    <Surface
      as="article"
      className={styles.toggleCard}
      elevation="rested"
      tone={isLoading || isUnavailable ? 'muted' : isWanted ? 'accent' : 'default'}
    >
      <div className={styles.toggleMeta}>
        <Badge tone={statusTone}>{statusLabel}</Badge>
        <Badge tone="info">Set {setId}</Badge>
        {isPending ? <Badge tone="info">Saving</Badge> : null}
      </div>
      <SectionHeading description={description} title={title} titleAs="h2" />
      {errorMessage ? (
        <p aria-live="polite" className={styles.errorText}>
          {errorMessage}
        </p>
      ) : null}
      <Button
        className={styles.toggleButton}
        disabled={isUnavailable}
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
