import { type ReactNode } from 'react';
import {
  ActionLink,
  Badge,
  Button,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
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
      <p className={styles.metaText}>
        Target price: {wishlistItem.targetPrice}
      </p>
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
  successMessage,
}: {
  errorMessage?: string;
  hasResolvedState: boolean;
  isLoading?: boolean;
  isPending?: boolean;
  isWanted: boolean;
  onToggle: () => void;
  setId: string;
  successMessage?: string;
}) {
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? 'Checking your wanted save for this set.'
    : isUnavailable
      ? 'Wanted status is unavailable right now.'
      : isWanted
        ? 'Saved to your wanted list.'
        : 'Track this set on your wanted list.';
  const description = isLoading
    ? `Checking whether set ${setId} is saved as wanted.`
    : isUnavailable
      ? `Wanted state could not be loaded for set ${setId}.`
      : isWanted
        ? `Set ${setId} is saved as wanted on your collector account.`
        : `Save set ${setId} to your wanted list.`;
  const actionLabel = isUnavailable
    ? 'Wanted status unavailable'
    : isWanted
      ? 'Remove from wanted'
      : 'Save as wanted';
  const statusTone = isLoading
    ? 'info'
    : isUnavailable
      ? 'error'
      : isWanted
        ? 'accent'
        : 'neutral';
  const statusLabel = isLoading
    ? 'Syncing'
    : isUnavailable
      ? 'State unavailable'
      : isWanted
        ? 'Wanted saved'
        : 'Not saved yet';

  return (
    <Surface
      as="article"
      className={styles.toggleCard}
      elevation="rested"
      tone={
        isLoading || isUnavailable ? 'muted' : isWanted ? 'accent' : 'default'
      }
    >
      <div className={styles.toggleMeta}>
        <Badge tone={statusTone}>{statusLabel}</Badge>
        <Badge>Private collector state</Badge>
        <Badge tone="info">Set {setId}</Badge>
        {isPending ? <Badge tone="info">Saving</Badge> : null}
      </div>
      <SectionHeading description={description} title={title} titleAs="h2" />
      <p className={styles.metaText}>
        Private to your account. Public set facts and pricing stay shared.
      </p>
      {errorMessage ? (
        <p aria-live="polite" className={styles.errorText}>
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p aria-live="polite" className={styles.successText}>
          {successMessage}
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
        {isLoading
          ? 'Syncing wanted state...'
          : isPending
            ? 'Saving...'
            : actionLabel}
      </Button>
    </Surface>
  );
}

function formatWantedSetCount(count: number): string {
  return `${count} wanted set${count === 1 ? '' : 's'}`;
}

export function CollectorWishlistPanel({
  children,
  collectorName,
  errorMessage,
  hiddenWantedCount = 0,
  state,
  wantedCount = 0,
}: {
  children?: ReactNode;
  collectorName?: string;
  errorMessage?: string;
  hiddenWantedCount?: number;
  state: 'empty' | 'loading' | 'populated' | 'signed-out';
  wantedCount?: number;
}) {
  const title =
    state === 'loading'
      ? 'Loading your collector wishlist'
      : state === 'signed-out'
        ? 'Sign in to view your private wanted list'
        : state === 'empty'
          ? collectorName
            ? `${collectorName}, your wishlist is ready for its first tracked set`
            : 'Your wishlist is ready for its first tracked set'
          : collectorName
            ? `${collectorName}, here is your wanted list`
            : 'Your wanted list';
  const description =
    state === 'loading'
      ? 'Loading sets saved as wanted on your collector account.'
      : state === 'signed-out'
        ? 'This page shows sets saved to your private collector account as wanted.'
        : state === 'empty'
          ? hiddenWantedCount > 0
            ? `You have ${formatWantedSetCount(
                hiddenWantedCount,
              )} saved outside the current public slice. Save a featured set here to start the visible wishlist.`
            : 'Save wanted sets from set pages and they will appear here.'
          : hiddenWantedCount > 0
            ? `Showing ${formatWantedSetCount(
                wantedCount,
              )} from the current public slice. ${formatWantedSetCount(
                hiddenWantedCount,
              )} stay saved outside it.`
            : `This page shows ${formatWantedSetCount(
                wantedCount,
              )} saved as wanted on your collector account.`;

  return (
    <Surface
      as="section"
      className={styles.wishlistPagePanel}
      elevation="rested"
      tone={state === 'populated' ? 'default' : 'muted'}
    >
      <div className={styles.wishlistHeader}>
        <SectionHeading
          description={description}
          eyebrow="Collector wishlist"
          title={title}
          titleAs="h2"
        />
        <div className={styles.wishlistMeta}>
          <Badge tone={state === 'populated' ? 'accent' : 'info'}>
            {state === 'loading'
              ? 'Loading private state'
              : state === 'signed-out'
                ? 'Private collector page'
                : `${wantedCount} visible`}
          </Badge>
          <Badge tone="warning">Wanted radar</Badge>
          {hiddenWantedCount > 0 ? (
            <Badge tone="warning">
              {hiddenWantedCount} outside public slice
            </Badge>
          ) : null}
        </div>
      </div>
      <p className={styles.metaText}>
        Private to your account. Public set facts and pricing stay shared.
      </p>
      <div className={styles.destinationPanel}>
        <p className={styles.metaText}>
          Wishlist sets stay separate from your collection.
        </p>
        <div className={styles.destinationLinks}>
          <ActionLink href="/collection" tone="secondary">
            Open collection
          </ActionLink>
          <ActionLink href="/#featured-sets" tone="secondary">
            Browse featured sets
          </ActionLink>
        </div>
      </div>
      {errorMessage ? (
        <p aria-live="polite" className={styles.errorText}>
          {errorMessage}
        </p>
      ) : null}
      {state === 'populated' ? (
        <div className={styles.wishlistGrid}>{children}</div>
      ) : (
        <div className={styles.wishlistEmptyActions}>
          <ActionLink href="/#featured-sets" tone="secondary">
            Browse featured sets
          </ActionLink>
        </div>
      )}
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
