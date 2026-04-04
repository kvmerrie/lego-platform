import { type ReactNode } from 'react';
import { CollectionShelf } from '@lego-platform/collection/util';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  ActionLink,
  Button,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import { MetricCard } from '@lego-platform/shared/types';
import styles from './collection-ui.module.css';

export function CollectionMetricCard({
  metricCard,
}: {
  metricCard: MetricCard;
}) {
  return (
    <Surface
      as="article"
      className={styles.metricCard}
      elevation="rested"
      tone={metricCard.tone === 'positive' ? 'accent' : 'default'}
    >
      <Badge
        tone={
          metricCard.tone === 'positive'
            ? 'positive'
            : metricCard.tone === 'warning'
              ? 'warning'
              : metricCard.tone === 'accent'
                ? 'accent'
                : 'neutral'
        }
      >
        {metricCard.label}
      </Badge>
      <h3 className={styles.metricValue}>{metricCard.value}</h3>
      {metricCard.detail ? (
        <p className={styles.description}>{metricCard.detail}</p>
      ) : null}
    </Surface>
  );
}

export function CollectionShelfCard({
  collectionShelf,
}: {
  collectionShelf: CollectionShelf;
}) {
  return (
    <Surface as="article" className={styles.shelfCard} tone="muted">
      <div className={styles.shelfHeader}>
        <h3 className={styles.title}>{collectionShelf.name}</h3>
        <Badge tone="info">{collectionShelf.completion}</Badge>
      </div>
      <p>{collectionShelf.focus}</p>
      <p className={styles.description}>{collectionShelf.notes}</p>
    </Surface>
  );
}

export function OwnedSetToggleCard({
  errorMessage,
  hasResolvedState,
  isLoading,
  isOwned,
  isPending,
  onToggle,
  setId,
  successMessage,
  variant = 'default',
}: {
  errorMessage?: string;
  hasResolvedState: boolean;
  isLoading?: boolean;
  isOwned: boolean;
  isPending?: boolean;
  onToggle: () => void;
  setId: string;
  successMessage?: string;
  variant?: 'default' | 'product';
}) {
  const isUnavailable = !isLoading && !hasResolvedState;
  const title = isLoading
    ? 'Collectiestatus wordt gecontroleerd'
    : isUnavailable
      ? 'Collectiestatus niet beschikbaar'
      : isOwned
        ? 'In collectie'
        : 'Markeer als in collectie';
  const description = isLoading
    ? 'Controleren of deze set al in je collectie staat.'
    : isUnavailable
      ? 'Je collectiestatus kon nu niet worden geladen.'
      : isOwned
        ? 'Deze set staat in je prive collectie.'
        : 'Bewaar deze set in je prive collectie.';
  const actionLabel = isUnavailable
    ? 'Collectiestatus niet beschikbaar'
    : isOwned
      ? 'Uit collectie verwijderen'
      : 'Markeer als in collectie';
  const statusTone = isLoading
    ? 'info'
    : isUnavailable
      ? 'error'
      : isOwned
        ? 'positive'
        : 'neutral';
  const statusLabel = isLoading
    ? 'Synchroniseren'
    : isUnavailable
      ? 'Status niet beschikbaar'
      : isOwned
        ? 'In collectie'
        : 'Nog niet opgeslagen';

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
            isOwned
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
            ? 'Synchroniseren...'
            : isPending
              ? 'Opslaan...'
              : isUnavailable
                ? 'Collectie niet beschikbaar'
                : isOwned
                  ? 'Uit collectie verwijderen'
                  : 'Markeer als in collectie'}
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
        isLoading || isUnavailable ? 'muted' : isOwned ? 'accent' : 'default'
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
        tone={isOwned ? 'secondary' : 'accent'}
        type="button"
        onClick={onToggle}
      >
        {isLoading
          ? 'Collectie synchroniseren...'
          : isPending
            ? 'Opslaan...'
            : actionLabel}
      </Button>
    </Surface>
  );
}

export function CollectorCollectionPanel({
  children,
  controls,
  errorMessage,
  hiddenOwnedCount = 0,
  ownedCount = 0,
  statusMessage,
  state,
}: {
  children?: ReactNode;
  collectorName?: string;
  controls?: ReactNode;
  errorMessage?: string;
  hiddenOwnedCount?: number;
  ownedCount?: number;
  statusMessage?: string;
  state: 'empty' | 'loading' | 'populated' | 'signed-out';
}) {
  const title =
    state === 'loading'
      ? 'Je collectie wordt geladen'
      : state === 'signed-out'
        ? 'Log in om je collectie te bekijken'
        : state === 'empty'
          ? 'Nog niets in je collectie'
          : 'Je collectie';
  const description =
    state === 'loading'
      ? 'De sets in je collectie worden geladen.'
      : state === 'signed-out'
        ? 'Log in om de sets in je collectie te bekijken.'
        : state === 'empty'
          ? hiddenOwnedCount > 0
            ? `Je hebt ${hiddenOwnedCount} sets opgeslagen buiten de sets die nu op Brickhunt zichtbaar zijn. Sla een zichtbare set op en die verschijnt ook hier.`
            : 'Markeer een set als in collectie vanaf een setpagina en gebruik deze plek daarna om je collectie overzichtelijk te houden.'
          : hiddenOwnedCount > 0
            ? `Je ziet hier vandaag ${ownedCount}. ${hiddenOwnedCount} blijven opgeslagen buiten de huidige catalogus.`
            : `${ownedCount} opgeslagen.`;

  return (
    <Surface
      as="section"
      className={styles.collectionPagePanel}
      elevation="rested"
      tone={state === 'populated' ? 'default' : 'muted'}
    >
      <div className={styles.collectionHeader}>
        <SectionHeading
          description={description}
          eyebrow="Verzamelaarscollectie"
          title={title}
          titleAs="h1"
        />
        <p className={styles.collectionMeta}>
          {state === 'loading'
            ? 'Opslagen laden'
            : state === 'signed-out'
              ? 'Log in om prive op te slaan'
              : `${ownedCount} in collectie`}
          {hiddenOwnedCount > 0
            ? ` · ${hiddenOwnedCount} buiten de catalogus van vandaag`
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
            href={buildWebPath(webPathnames.wishlist)}
            tone="secondary"
          >
            Open verlanglijst
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
        <div className={styles.collectionToolbar}>{controls}</div>
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
        <div className={styles.collectionGrid}>{children}</div>
      ) : (
        <div className={styles.collectionEmptyActions}>
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

export function CollectionUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Displaystatistieken, planken en beheeroppervlakken zonder ingebakken businesslogica."
        eyebrow="Collectie-UI"
        title="Verzamelaarsoppervlakken met heldere status en acties."
      />
    </Surface>
  );
}

export default CollectionUi;
