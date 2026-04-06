import { type ReactNode } from 'react';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  ActionLink,
  Badge,
  Button,
  SectionHeading,
  Surface,
  VisuallyHidden,
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
      <p className={styles.metaText}>Doelprijs: {wishlistItem.targetPrice}</p>
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
  productIntent = 'wishlist',
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
  productIntent?: 'price-alert' | 'wishlist';
  setId: string;
  successMessage?: string;
  variant?: 'default' | 'inline' | 'product';
}) {
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? 'Verlanglijststatus wordt gecontroleerd'
    : isUnavailable
      ? 'Verlanglijststatus niet beschikbaar'
      : isWanted
        ? 'Op verlanglijst'
        : 'Aan verlanglijst toevoegen';
  const description = isLoading
    ? 'Controleren of deze set al op je verlanglijst staat.'
    : isUnavailable
      ? 'Je verlanglijststatus kon nu niet worden geladen.'
      : isWanted
        ? 'Deze set staat op je prive verlanglijst.'
        : 'Bewaar deze set op je prive verlanglijst.';
  const actionLabel = isUnavailable
    ? 'Verlanglijststatus niet beschikbaar'
    : isWanted
      ? 'Van verlanglijst verwijderen'
      : 'Aan verlanglijst toevoegen';
  const statusTone = isLoading
    ? 'info'
    : isUnavailable
      ? 'error'
      : isWanted
        ? 'accent'
        : 'neutral';
  const statusLabel = isLoading
    ? 'Synchroniseren'
    : isUnavailable
      ? 'Status niet beschikbaar'
      : isWanted
        ? 'Op verlanglijst'
        : 'Nog niet opgeslagen';

  if (variant === 'inline') {
    const inlineActionLabel = isLoading
      ? 'Controleren...'
      : isPending
        ? productIntent === 'price-alert'
          ? 'Volgen...'
          : 'Bewaren...'
        : isUnavailable
          ? productIntent === 'price-alert'
            ? 'Volgen niet beschikbaar'
            : 'Bewaren niet beschikbaar'
          : isWanted
            ? productIntent === 'price-alert'
              ? 'Volgt prijs'
              : 'Bewaard'
            : productIntent === 'price-alert'
              ? 'Volg prijs'
              : 'Bewaar';

    return (
      <article className={styles.inlineToggle}>
        {successMessage ? (
          <VisuallyHidden>
            <span aria-live="polite">{successMessage}</span>
          </VisuallyHidden>
        ) : null}
        {errorMessage ? (
          <p aria-live="polite" className={styles.errorText}>
            {errorMessage}
          </p>
        ) : null}
        <Button
          className={`${styles.inlineToggleButton} ${
            isWanted
              ? styles.inlineToggleButtonActive
              : styles.inlineToggleButtonIdle
          }`}
          disabled={isUnavailable}
          isLoading={Boolean(isLoading || isPending)}
          tone="ghost"
          type="button"
          onClick={onToggle}
        >
          {inlineActionLabel}
        </Button>
      </article>
    );
  }

  if (variant === 'product') {
    const productActionLabel = isLoading
      ? 'Synchroniseren...'
      : isPending
        ? 'Opslaan...'
        : isUnavailable
          ? productIntent === 'price-alert'
            ? 'Prijsalert niet beschikbaar'
            : 'Verlanglijst niet beschikbaar'
          : isWanted
            ? productIntent === 'price-alert'
              ? 'Zet prijsalert uit'
              : 'Van verlanglijst verwijderen'
            : productIntent === 'price-alert'
              ? 'Zet prijsalert aan'
              : 'Aan verlanglijst toevoegen';

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
          {productActionLabel}
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
      <p className={styles.metaText}>
        Prive opgeslagen. Setinformatie blijft openbaar.
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
          ? 'Verlanglijst synchroniseren...'
          : isPending
            ? 'Opslaan...'
            : actionLabel}
      </Button>
    </Surface>
  );
}

export function CollectorWishlistPanel({
  children,
  controls,
  errorMessage,
  hiddenWantedCount = 0,
  statusMessage,
  state,
  wantedCount = 0,
}: {
  children?: ReactNode;
  collectorName?: string;
  controls?: ReactNode;
  errorMessage?: string;
  hiddenWantedCount?: number;
  statusMessage?: string;
  state: 'empty' | 'loading' | 'populated' | 'signed-out';
  wantedCount?: number;
}) {
  const title =
    state === 'loading'
      ? 'Je verlanglijst wordt geladen'
      : state === 'signed-out'
        ? 'Log in om je verlanglijst te bekijken'
        : state === 'empty'
          ? 'Nog niets op je verlanglijst'
          : 'Je verlanglijst';
  const description =
    state === 'loading'
      ? 'De sets op je verlanglijst worden geladen.'
      : state === 'signed-out'
        ? 'Log in om de sets op je verlanglijst te bekijken.'
        : state === 'empty'
          ? hiddenWantedCount > 0
            ? `Je hebt ${hiddenWantedCount} sets opgeslagen buiten de sets die nu op Brickhunt zichtbaar zijn. Sla een zichtbare set op en die verschijnt ook hier.`
            : 'Sla een set op die je wilt hebben en kom hier terug om te vergelijken welke de moeite waard zijn om in de gaten te houden.'
          : hiddenWantedCount > 0
            ? `Je ziet hier vandaag ${wantedCount}. ${hiddenWantedCount} blijven opgeslagen buiten de huidige catalogus.`
            : `${wantedCount} opgeslagen.`;

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
          eyebrow="Verzamelaarsverlanglijst"
          title={title}
          titleAs="h1"
        />
        <p className={styles.wishlistMeta}>
          {state === 'loading'
            ? 'Opslagen laden'
            : state === 'signed-out'
              ? 'Log in om prive op te slaan'
              : `${wantedCount} op verlanglijst`}
          {hiddenWantedCount > 0
            ? ` · ${hiddenWantedCount} buiten de catalogus van vandaag`
            : ''}
        </p>
      </div>
      <p className={styles.metaText}>
        Je opgeslagen sets blijven prive. Setpagina's en prijschecks blijven
        openbaar.
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
            Open collectie
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Bekijk catalogus
          </ActionLink>
          <ActionLink href={buildWebPath(webPathnames.themes)} tone="secondary">
            Bekijk thema's
          </ActionLink>
        </div>
      </div>
      {controls ? (
        <div className={styles.wishlistToolbar}>{controls}</div>
      ) : null}
      {statusMessage ? (
        <p aria-live="polite" className={styles.successText}>
          {statusMessage}
        </p>
      ) : null}
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
            Bekijk catalogus
          </ActionLink>
          <ActionLink href={buildWebPath(webPathnames.themes)} tone="secondary">
            Bekijk thema's
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
        description="Focuskaarten en verlanglijststatussen voor toekomstige prijstriggers."
        eyebrow="Verlanglijst-UI"
        title="Verlanglijstoppervlakken die helder, rustig en verzamelaarsgericht blijven."
      />
    </Surface>
  );
}

export default WishlistUi;
