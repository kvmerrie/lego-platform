import { type ReactNode } from 'react';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  ActionLink,
  Badge,
  Button,
  Panel,
  VisuallyHidden,
} from '@lego-platform/shared/ui';
import {
  buildBrickhuntAnalyticsAttributes,
  type BrickhuntAnalyticsProperties,
} from '@lego-platform/shared/util';
import { WishlistItem } from '@lego-platform/wishlist/util';
import styles from './wishlist-ui.module.css';

export function WishlistItemCard({
  wishlistItem,
}: {
  wishlistItem: WishlistItem;
}) {
  return (
    <Panel
      as="article"
      className={styles.itemCard}
      spacing="compact"
      tone="muted"
    >
      <div className={styles.itemHeader}>
        <h3 className={styles.title}>{wishlistItem.name}</h3>
        <Badge tone="accent">{wishlistItem.urgency}</Badge>
      </div>
      <p>{wishlistItem.reason}</p>
      <p className={styles.metaText}>Doelprijs: {wishlistItem.targetPrice}</p>
    </Panel>
  );
}

export function WantedSetToggleCard({
  alertsEnabled,
  analyticsContext,
  errorMessage,
  followedSetCount,
  hasResolvedState,
  isAuthenticated = true,
  isLoading,
  isPending,
  isWanted,
  onToggle,
  productIntent = 'wishlist',
  setId,
  successMessage,
  variant = 'default',
}: {
  alertsEnabled?: boolean;
  analyticsContext?: BrickhuntAnalyticsProperties;
  errorMessage?: string;
  followedSetCount?: number;
  hasResolvedState: boolean;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  isPending?: boolean;
  isWanted: boolean;
  onToggle: () => void;
  productIntent?: 'price-alert' | 'wishlist';
  setId: string;
  successMessage?: string;
  variant?: 'default' | 'inline' | 'product';
}) {
  const isPriceAlert = productIntent === 'price-alert';
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? isPriceAlert
      ? 'Prijs volgen wordt gecontroleerd'
      : 'Verlanglijststatus wordt gecontroleerd'
    : isUnavailable
      ? isPriceAlert
        ? 'Prijs volgen niet beschikbaar'
        : 'Verlanglijststatus niet beschikbaar'
      : isWanted
        ? isPriceAlert
          ? 'Brickhunt volgt deze prijs'
          : 'Op verlanglijst'
        : isPriceAlert
          ? 'Volg deze prijs'
          : 'Aan verlanglijst toevoegen';
  const description = isLoading
    ? isPriceAlert
      ? 'We kijken of Brickhunt deze prijs al voor je volgt.'
      : 'Controleren of deze set al op je verlanglijst staat.'
    : !isAuthenticated
      ? isPriceAlert
        ? 'Log in om deze prijs te volgen en later terug te vinden op je verlanglijst.'
        : 'Log in om deze set op je prive verlanglijst te bewaren.'
      : isUnavailable
        ? isPriceAlert
          ? 'We konden je volgstatus nu niet laden.'
          : 'Je verlanglijststatus kon nu niet worden geladen.'
        : isWanted
          ? isPriceAlert
            ? 'Je volgt nu de prijs van deze set.'
            : 'Deze set staat op je prive verlanglijst.'
          : isPriceAlert
            ? 'Nog niet kopen? Laat Brickhunt meekijken.'
            : 'Bewaar deze set op je prive verlanglijst.';
  const actionLabel = isUnavailable
    ? isPriceAlert
      ? 'Prijs volgen niet beschikbaar'
      : 'Verlanglijststatus niet beschikbaar'
    : !isAuthenticated
      ? isPriceAlert
        ? 'Log in om te volgen'
        : 'Log in om op te slaan'
      : isWanted
        ? isPriceAlert
          ? 'Niet meer volgen'
          : 'Van verlanglijst verwijderen'
        : isPriceAlert
          ? 'Volg prijs'
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
        ? isPriceAlert
          ? 'Prijs wordt gevolgd'
          : 'Op verlanglijst'
        : !isAuthenticated
          ? 'Log in nodig'
          : isPriceAlert
            ? 'Nog niet gevolgd'
            : 'Nog niet opgeslagen';
  const metaCopy = isPriceAlert
    ? !isAuthenticated
      ? 'Log in om deze prijs te volgen. Daarna vind je de set terug op je verlanglijst.'
      : isWanted
        ? alertsEnabled
          ? 'Brickhunt houdt deze prijs voor je in de gaten. Als het moment interessanter wordt, krijg je daar een seintje over.'
          : 'Brickhunt houdt deze prijs voor je in de gaten. Zet dealupdates aan in je account als je ook een seintje wilt.'
        : 'Volg de prijs als je later sneller wilt zien wanneer dit moment beter wordt.'
    : !isAuthenticated
      ? 'Log in om sets prive op te slaan en later sneller terug te vinden.'
      : 'Prive opgeslagen. Setinformatie blijft openbaar.';
  const wishlistLinkLabel =
    typeof followedSetCount === 'number'
      ? `Open verlanglijst (${followedSetCount})`
      : 'Open verlanglijst';
  const productHelperCopy = isLoading
    ? isPriceAlert
      ? 'We kijken of Brickhunt deze prijs al voor je volgt.'
      : 'We kijken of deze set al op je prive verlanglijst staat.'
    : !isAuthenticated
      ? isPriceAlert
        ? 'Log in om deze set te volgen. Daarna vind je hem terug op je verlanglijst.'
        : 'Log in om deze set op je prive verlanglijst te bewaren.'
      : isUnavailable
        ? isPriceAlert
          ? 'Je kunt deze prijs nu niet laten volgen.'
          : 'Je kunt deze set nu niet op je verlanglijst zetten.'
        : isWanted
          ? isPriceAlert
            ? alertsEnabled
              ? 'Deze set staat nu op je verlanglijst. Als de prijs interessanter wordt, krijg je daar een seintje over.'
              : 'Deze set staat nu op je verlanglijst. Zet dealupdates aan in je account als je ook een seintje wilt.'
            : 'Deze set staat op je prive verlanglijst.'
          : isPriceAlert
            ? 'Volg deze prijs. Dan zie je sneller wanneer dit een beter moment wordt.'
            : 'Bewaar deze set om hem later sneller terug te vinden.';
  const showProductWishlistLink =
    isPriceAlert &&
    isAuthenticated &&
    !isUnavailable &&
    hasResolvedState &&
    (isWanted ||
      (typeof followedSetCount === 'number' && followedSetCount > 0));
  const showProductAccountLink =
    isPriceAlert &&
    ((!isAuthenticated && !isLoading) || (isWanted && !alertsEnabled));

  if (variant === 'inline') {
    const inlineActionLabel = isLoading
      ? 'Controleren...'
      : isPending
        ? productIntent === 'price-alert'
          ? 'Volgen...'
          : 'Bewaren...'
        : !isAuthenticated
          ? 'Log in'
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
        ? productIntent === 'price-alert'
          ? 'Volgen...'
          : 'Opslaan...'
        : !isAuthenticated
          ? productIntent === 'price-alert'
            ? 'Log in om te volgen'
            : 'Log in om op te slaan'
          : isUnavailable
            ? productIntent === 'price-alert'
              ? 'Prijs volgen niet beschikbaar'
              : 'Verlanglijst niet beschikbaar'
            : isWanted
              ? productIntent === 'price-alert'
                ? 'Volgt prijs'
                : 'Van verlanglijst verwijderen'
              : productIntent === 'price-alert'
                ? 'Volg prijs'
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
        {successMessage ? (
          <p aria-live="polite" className={styles.successText}>
            {successMessage}
          </p>
        ) : null}
        <p className={styles.toggleHelperText}>{productHelperCopy}</p>
        {showProductWishlistLink || showProductAccountLink ? (
          <div className={styles.toggleLinkRow}>
            {showProductWishlistLink ? (
              <ActionLink
                href={buildWebPath(webPathnames.wishlist)}
                tone="inline"
                {...buildBrickhuntAnalyticsAttributes({
                  event: 'open_wishlist_click',
                  properties: {
                    ...analyticsContext,
                    followedSetCount,
                  },
                })}
              >
                {wishlistLinkLabel}
              </ActionLink>
            ) : null}
            {showProductAccountLink ? (
              <ActionLink
                href={buildWebPath(webPathnames.account)}
                tone="inline"
                {...(!isAuthenticated && isPriceAlert
                  ? buildBrickhuntAnalyticsAttributes({
                      event: 'follow_price_auth_handoff',
                      properties: {
                        ...analyticsContext,
                        handoffSource: 'follow_helper_link',
                        handoffTarget: 'account',
                        signedIn: false,
                      },
                    })
                  : {})}
              >
                {!isAuthenticated ? 'Log in' : 'Zet dealupdates aan'}
              </ActionLink>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <Panel
      as="article"
      className={styles.toggleCard}
      description={description}
      elevation="rested"
      title={title}
      titleAs="h2"
      tone={
        isLoading || isUnavailable ? 'muted' : isWanted ? 'accent' : 'default'
      }
    >
      <div className={styles.toggleMeta}>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      <p className={styles.metaText}>{metaCopy}</p>
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
    </Panel>
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
            : 'Sla een set op die je wilt hebben. Hier zie je later sneller welke opnieuw de moeite waard zijn om te checken.'
          : hiddenWantedCount > 0
            ? `Je ziet hier vandaag ${wantedCount}. ${hiddenWantedCount} blijven opgeslagen buiten de huidige catalogus.`
            : `${wantedCount} opgeslagen.`;

  return (
    <Panel
      as="section"
      className={styles.wishlistPagePanel}
      description={description}
      eyebrow="Verzamelaarsverlanglijst"
      elevation="rested"
      title={title}
      titleAs="h1"
      tone={state === 'populated' ? 'default' : 'muted'}
    >
      <div className={styles.wishlistHeader}>
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
        Je opgeslagen sets blijven prive. Hier zie je sneller welke opnieuw de
        moeite waard zijn om te checken.
      </p>
      <Panel
        as="div"
        className={styles.destinationPanel}
        padding="md"
        spacing="compact"
        tone="muted"
      >
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
      </Panel>
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
    </Panel>
  );
}

export function WishlistUi() {
  return (
    <Panel
      as="section"
      className={styles.demo}
      description="Focuskaarten en verlanglijststatussen voor toekomstige prijstriggers."
      eyebrow="Verlanglijst-UI"
      title="Verlanglijstoppervlakken die helder, rustig en verzamelaarsgericht blijven."
      tone="muted"
    />
  );
}

export default WishlistUi;
