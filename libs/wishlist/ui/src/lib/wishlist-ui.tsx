import { type ReactNode } from 'react';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
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
  variant = 'default',
}: {
  errorMessage?: string;
  hasResolvedState: boolean;
  isLoading?: boolean;
  isPending?: boolean;
  isWanted: boolean;
  onToggle: () => void;
  setId: string;
  successMessage?: string;
  variant?: 'default' | 'product';
}) {
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? 'Checking wishlist save'
    : isUnavailable
      ? 'Wishlist save unavailable'
      : isWanted
        ? 'Saved to wishlist'
        : 'Save to wishlist';
  const description = isLoading
    ? 'Checking whether this set is already in your wishlist.'
    : isUnavailable
      ? 'We could not load your wishlist save right now.'
      : isWanted
        ? 'This set is in your private wishlist.'
        : 'Keep this set in your private wishlist.';
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

  if (variant === 'product') {
    return (
      <article className={styles.productToggle}>
        {errorMessage ? (
          <p aria-live="polite" className={styles.errorText}>
            {errorMessage}
          </p>
        ) : null}
        <Button
          className={`${styles.productToggleButton} ${
            isWanted
              ? styles.productToggleButtonActive
              : styles.productToggleButtonIdle
          }`}
          disabled={isUnavailable}
          isLoading={Boolean(isLoading || isPending)}
          tone="ghost"
          type="button"
          onClick={onToggle}
        >
          {isLoading
            ? 'Syncing...'
            : isPending
              ? 'Saving...'
              : isUnavailable
                ? 'Wanted unavailable'
                : isWanted
                  ? 'Remove wanted'
                  : 'Save as wanted'}
        </Button>
      </article>
    );
  }

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
      </div>
      <SectionHeading description={description} title={title} titleAs="h2" />
      <p className={styles.metaText}>Private save. Set facts stay public.</p>
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

export function CollectorWishlistPanel({
  children,
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
      ? 'Loading your wishlist'
      : state === 'signed-out'
        ? 'Sign in to see your wishlist'
        : state === 'empty'
          ? 'Nothing saved as wanted yet'
          : 'Your wishlist';
  const description =
    state === 'loading'
      ? 'Loading the sets you saved as wanted.'
      : state === 'signed-out'
        ? 'Sign in to see the sets you have marked as wanted.'
        : state === 'empty'
          ? hiddenWantedCount > 0
            ? `You have ${hiddenWantedCount} saved outside the sets currently shown on Brickhunt. Save any visible set and it will show up here too.`
            : 'Save a set as wanted from any set page and it will appear here.'
          : hiddenWantedCount > 0
            ? `Showing ${wantedCount} here today. ${hiddenWantedCount} stay saved outside the current catalog.`
            : `${wantedCount} saved.`;

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
          titleAs="h1"
        />
        <p className={styles.wishlistMeta}>
          {state === 'loading'
            ? 'Loading saves'
            : state === 'signed-out'
              ? 'Sign in to save privately'
              : `${wantedCount} shown`}
          {hiddenWantedCount > 0
            ? ` · ${hiddenWantedCount} outside today's catalog`
            : ''}
        </p>
      </div>
      <p className={styles.metaText}>
        Your saves stay private. Set pages and price checks stay public.
      </p>
      <div className={styles.destinationPanel}>
        <div className={styles.destinationLinks}>
          <ActionLink
            href={buildWebPath(webPathnames.account)}
            tone="secondary"
          >
            Open account
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.collection)}
            tone="secondary"
          >
            Open collection
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Browse catalog
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
          <ActionLink
            href={buildWebPath(webPathnames.account)}
            tone="secondary"
          >
            Open account
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Browse catalog
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
