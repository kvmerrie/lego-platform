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
    ? `Loading whether set ${setId} is already attached to your signed-in collector account as wanted.`
    : isUnavailable
      ? `Set ${setId} cannot be updated until the wanted-state query succeeds.`
      : isWanted
        ? `Set ${setId} is privately saved as wanted on your collector account. This stays independent from owned state and does not change public catalog information.`
        : `Save set ${setId} to your private wanted list so it stays on your radar without changing owned state or public catalog information.`;
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
        Personal to your collector account. Public set facts and reviewed buying
        guidance stay unchanged for other visitors.
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
      ? 'Checking the sets privately saved as wanted on your collector account.'
      : state === 'signed-out'
        ? 'This page only shows sets saved to your signed-in collector account as wanted. Public catalog browsing still works for everyone.'
        : state === 'empty'
          ? hiddenWantedCount > 0
            ? `You have ${formatWantedSetCount(
                hiddenWantedCount,
              )} saved outside the current public catalog slice. Save a featured set as wanted to start building the visible wishlist here.`
            : 'Save sets as wanted from their detail pages and they will appear here as your private wishlist for future tracking.'
          : hiddenWantedCount > 0
            ? `Showing ${formatWantedSetCount(
                wantedCount,
              )} from the current public catalog slice. ${formatWantedSetCount(
                hiddenWantedCount,
              )} ${
                hiddenWantedCount === 1 ? 'stays' : 'stay'
              } saved on your account but ${
                hiddenWantedCount === 1 ? 'sits' : 'sit'
              } outside the public curated catalog right now.`
            : `This page shows ${formatWantedSetCount(
                wantedCount,
              )} privately saved on your collector account as future targets.`;

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
        Private to your collector account. Public set facts, reviewed pricing,
        and curated buying guidance remain shared catalog information.
      </p>
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
