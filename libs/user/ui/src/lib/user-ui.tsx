import {
  CollectorProfile,
  getCollectorSetCounts,
  getUserInitials,
  isAuthenticatedSession,
  UpdateCollectorProfileInput,
  UserProfile,
  UserSession,
} from '@lego-platform/user/util';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import {
  ActionLink,
  Badge,
  Button,
  SectionHeading,
  Surface,
  VisuallyHidden,
} from '@lego-platform/shared/ui';
import styles from './user-ui.module.css';

export function UserIdentityCard({
  userProfile,
}: {
  userProfile: UserProfile;
}) {
  return (
    <Surface
      as="article"
      className={`${styles.card} ${styles.identityCard}`}
      elevation="rested"
      tone="muted"
    >
      <div aria-hidden="true" className={styles.avatarBadge}>
        {getUserInitials(userProfile.name)}
      </div>
      <div className={styles.identityMeta}>
        <h3 className={styles.title}>{userProfile.name}</h3>
        <p className={styles.description}>
          {userProfile.location} · {userProfile.tier}
        </p>
        <p className={styles.supportNote}>{userProfile.collectionFocus}</p>
      </div>
    </Surface>
  );
}

export function UserShellAccountStatusCard({
  errorMessage,
  isAuthActionPending,
  isAuthAvailable = true,
  isLoading,
  onSignOut,
  statusMessage,
  userSession,
}: {
  errorMessage?: string;
  isAuthActionPending?: boolean;
  isAuthAvailable?: boolean;
  isLoading?: boolean;
  onSignOut?: () => void;
  statusMessage?: string;
  userSession: UserSession;
}) {
  if (isLoading) {
    return (
      <Surface
        as="aside"
        className={`${styles.card} ${styles.shellStatusCard}`}
        tone="muted"
      >
        <div className={styles.sessionContent}>
          <SectionHeading
            description="Je account, opgeslagen sets en profiel worden geladen."
            eyebrow="Accountstatus"
            title="Je account wordt gecontroleerd"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          synchroniseren
        </Badge>
      </Surface>
    );
  }

  if (!isAuthenticatedSession(userSession)) {
    return (
      <Surface
        as="aside"
        className={`${styles.card} ${styles.shellStatusCard}`}
        tone="muted"
      >
        <div className={styles.sessionContent}>
          <p className={styles.statusMeta}>
            {isAuthAvailable
              ? 'Uitgelogd · Sla collectie en verlanglijst prive op'
              : 'Uitgelogd · Inloggen niet beschikbaar'}
          </p>
          <SectionHeading
            description={
              isAuthAvailable
                ? 'Log in met e-mail en wachtwoord of met Google om je collectie, verlanglijst en verzamelaarsgegevens op een plek te bewaren.'
                : 'Bladeren werkt hier nog steeds, maar prive opgeslagen verzamelaarsgegevens zijn in deze omgeving niet beschikbaar.'
            }
            eyebrow="Accountstatus"
            title="Log in om sets op te slaan"
          />
          <div className={styles.shellStatusActions}>
            <ActionLink
              href={buildWebPath(webPathnames.collection)}
              tone={isAuthAvailable ? 'accent' : 'secondary'}
            >
              {isAuthAvailable
                ? 'Log in om prive op te slaan'
                : 'Open collectie'}
            </ActionLink>
            <ActionLink
              href={buildWebPath(webPathnames.wishlist)}
              tone="secondary"
            >
              Open verlanglijst
            </ActionLink>
          </div>
          {statusMessage ? (
            <p aria-live="polite" className={styles.infoText}>
              {statusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p aria-live="polite" className={styles.errorText}>
              {errorMessage}
            </p>
          ) : null}
        </div>
        <Badge className={styles.sessionStatus} tone="warning">
          uitgelogd
        </Badge>
      </Surface>
    );
  }

  const collectorSetCounts = getCollectorSetCounts(userSession);

  return (
    <Surface
      as="aside"
      className={`${styles.card} ${styles.shellStatusCard}`}
      elevation="rested"
    >
      <div className={styles.sessionContent}>
        <p className={styles.statusMeta}>
          Ingelogd · {userSession.collector.tier}
        </p>
        <SectionHeading
          description="Je opgeslagen sets en verzamelaarsgegevens zijn een klik verwijderd."
          eyebrow="Accountstatus"
          title={userSession.collector.name}
        />
        <div className={styles.shellStatusIdentity}>
          <div aria-hidden="true" className={styles.avatarBadge}>
            {getUserInitials(userSession.collector.name)}
          </div>
          <div className={styles.shellStatusMeta}>
            <p className={styles.paneValue}>@{userSession.collector.id}</p>
            <p className={styles.metaText}>
              {userSession.collector.location} · {userSession.collector.tier}
            </p>
          </div>
        </div>
        <p className={styles.supportNote}>
          {userSession.collector.collectionFocus}
        </p>
        <p className={styles.sessionCounts}>
          {collectorSetCounts.ownedCount} in collectie opgeslagen ·{' '}
          {collectorSetCounts.wantedCount} op verlanglijst opgeslagen
        </p>
        <div className={styles.shellStatusActions}>
          <ActionLink
            href={buildWebPath(webPathnames.collection)}
            tone="secondary"
          >
            Open collectie ({collectorSetCounts.ownedCount})
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.wishlist)}
            tone="secondary"
          >
            Open verlanglijst ({collectorSetCounts.wantedCount})
          </ActionLink>
          <Button
            isLoading={Boolean(isAuthActionPending)}
            tone="ghost"
            type="button"
            onClick={onSignOut}
          >
            Uitloggen
          </Button>
        </div>
        {statusMessage ? (
          <p aria-live="polite" className={styles.infoText}>
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p aria-live="polite" className={styles.errorText}>
            {errorMessage}
          </p>
        ) : null}
      </div>
      <Badge className={styles.sessionStatus} tone="positive">
        ingelogd
      </Badge>
    </Surface>
  );
}

export function UserSessionCard({
  authMode = 'sign-in',
  authEmail,
  authPassword,
  authPasswordConfirmation,
  authStatusMessage,
  errorMessage,
  isAuthActionPending,
  isAuthAvailable = true,
  isLoading,
  isPasswordRecoveryMode,
  onAuthEmailChange,
  onAuthModeChange,
  onAuthPasswordChange,
  onAuthPasswordConfirmationChange,
  onCompletePasswordRecovery,
  onGoogleSignIn,
  onPasswordRecoveryChange,
  onPasswordRecoveryConfirmationChange,
  onPrimaryAuthAction,
  onSignOut,
  passwordRecoveryConfirmation,
  passwordRecoveryValue,
  userSession,
}: {
  authMode?: 'magic-link' | 'reset-password' | 'sign-in' | 'sign-up';
  authEmail?: string;
  authPassword?: string;
  authPasswordConfirmation?: string;
  authStatusMessage?: string;
  errorMessage?: string;
  isAuthActionPending?: boolean;
  isAuthAvailable?: boolean;
  isLoading?: boolean;
  isPasswordRecoveryMode?: boolean;
  onAuthEmailChange?: (value: string) => void;
  onAuthModeChange?: (
    mode: 'magic-link' | 'reset-password' | 'sign-in' | 'sign-up',
  ) => void;
  onAuthPasswordChange?: (value: string) => void;
  onAuthPasswordConfirmationChange?: (value: string) => void;
  onCompletePasswordRecovery?: () => void;
  onGoogleSignIn?: () => void;
  onPasswordRecoveryChange?: (value: string) => void;
  onPasswordRecoveryConfirmationChange?: (value: string) => void;
  onPrimaryAuthAction?: () => void;
  onSignOut?: () => void;
  passwordRecoveryConfirmation?: string;
  passwordRecoveryValue?: string;
  userSession: UserSession;
}) {
  if (isLoading) {
    return (
      <Surface
        as="article"
        className={`${styles.card} ${styles.splitCard}`}
        tone="muted"
      >
        <div className={styles.sessionContent}>
          <SectionHeading
            description="Het verzamelaarsaccount voor deze set wordt gecontroleerd."
            eyebrow="Verzamelaarsaccount"
            title="Verzamelaarsaccount wordt gecontroleerd"
            titleAs="h1"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          synchroniseren
        </Badge>
      </Surface>
    );
  }

  if (!isAuthenticatedSession(userSession)) {
    const isMagicLinkMode = authMode === 'magic-link';
    const isResetMode = authMode === 'reset-password';
    const isSignUpMode = authMode === 'sign-up';

    return (
      <Surface
        as="article"
        className={`${styles.card} ${styles.splitCard}`}
        tone="muted"
      >
        <div className={styles.sessionContent}>
          <SectionHeading
            description={
              isAuthAvailable
                ? isResetMode
                  ? 'Stuur een herstelmail en open daarna de veilige link daarin om een nieuw wachtwoord te kiezen.'
                  : isMagicLinkMode
                    ? 'Gebruik je liever geen wachtwoord? Kies dan voor een eenmalige e-maillink.'
                    : isSignUpMode
                      ? 'Maak een account aan om verlanglijst, collectie en verzamelaarsgegevens op een prive plek te bewaren.'
                      : 'Log eerst in met e-mail en wachtwoord. Google is beschikbaar wanneer deze omgeving dat ondersteunt en de magic link blijft hier als terugvaloptie.'
                : 'Bladeren werkt hier nog steeds, maar opgeslagen verzamelaarsacties blijven in deze omgeving uitgeschakeld.'
            }
            eyebrow="Account"
            title="Log in om je account te openen"
            titleAs="h1"
          />
          <form
            className={styles.authForm}
            onSubmit={(event) => {
              event.preventDefault();
              onPrimaryAuthAction?.();
            }}
          >
            <div className={styles.inputCluster}>
              <label className={styles.formField}>
                <span className={styles.fieldLabel}>E-mailadres</span>
                <input
                  autoComplete="email"
                  className={styles.textInput}
                  inputMode="email"
                  name="email"
                  placeholder="collector@example.com"
                  type="email"
                  value={authEmail ?? ''}
                  onChange={(event) => onAuthEmailChange?.(event.target.value)}
                />
                <span className={styles.fieldHint}>
                  {isMagicLinkMode
                    ? 'Wacht ongeveer een minuut voordat je om nog een link vraagt.'
                    : isResetMode
                      ? 'Gebruik hetzelfde e-mailadres als waarmee je het account hebt aangemaakt.'
                      : 'Je collectie en verlanglijst blijven aan dit account gekoppeld.'}
                </span>
              </label>
              {!isMagicLinkMode && !isResetMode ? (
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>Wachtwoord</span>
                  <input
                    autoComplete={
                      isSignUpMode ? 'new-password' : 'current-password'
                    }
                    className={styles.textInput}
                    name="password"
                    placeholder={
                      isSignUpMode
                        ? 'Kies een wachtwoord'
                        : 'Vul je wachtwoord in'
                    }
                    type="password"
                    value={authPassword ?? ''}
                    onChange={(event) =>
                      onAuthPasswordChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Gebruik minimaal 8 tekens.
                  </span>
                </label>
              ) : null}
              {isSignUpMode ? (
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>Bevestig wachtwoord</span>
                  <input
                    autoComplete="new-password"
                    className={styles.textInput}
                    name="confirmPassword"
                    placeholder="Bevestig je wachtwoord"
                    type="password"
                    value={authPasswordConfirmation ?? ''}
                    onChange={(event) =>
                      onAuthPasswordConfirmationChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Herhaal het wachtwoord een keer zodat dit account klaar is
                    voor gebruik.
                  </span>
                </label>
              ) : null}
            </div>
            <div className={styles.authActionGrid}>
              <Button
                disabled={!isAuthAvailable}
                isLoading={Boolean(isAuthActionPending)}
                tone="accent"
                type="submit"
              >
                {isAuthActionPending
                  ? isResetMode
                    ? 'Herstelmail wordt verstuurd...'
                    : isMagicLinkMode
                      ? 'Inloglink wordt verstuurd...'
                      : isSignUpMode
                        ? 'Account wordt aangemaakt...'
                        : 'Inloggen...'
                  : isResetMode
                    ? 'Verstuur herstelmail'
                    : isMagicLinkMode
                      ? authStatusMessage
                        ? 'Verstuur nog een e-maillink'
                        : 'E-mail-inloglink'
                      : isSignUpMode
                        ? 'Account aanmaken'
                        : 'Inloggen'}
              </Button>
              {!isMagicLinkMode && !isResetMode ? (
                <Button
                  disabled={!isAuthAvailable}
                  isLoading={Boolean(isAuthActionPending)}
                  tone="secondary"
                  type="button"
                  onClick={onGoogleSignIn}
                >
                  Doorgaan met Google
                </Button>
              ) : null}
            </div>
          </form>
          <div className={styles.authModeLinks}>
            {authMode !== 'sign-in' ? (
              <Button
                disabled={!isAuthAvailable}
                tone="ghost"
                type="button"
                onClick={() => onAuthModeChange?.('sign-in')}
              >
                Gebruik e-mail en wachtwoord
              </Button>
            ) : (
              <Button
                disabled={!isAuthAvailable}
                tone="ghost"
                type="button"
                onClick={() => onAuthModeChange?.('sign-up')}
              >
                Account aanmaken
              </Button>
            )}
            {authMode !== 'reset-password' ? (
              <Button
                disabled={!isAuthAvailable}
                tone="ghost"
                type="button"
                onClick={() => onAuthModeChange?.('reset-password')}
              >
                Wachtwoord vergeten?
              </Button>
            ) : null}
            {authMode !== 'magic-link' ? (
              <Button
                disabled={!isAuthAvailable}
                tone="ghost"
                type="button"
                onClick={() => onAuthModeChange?.('magic-link')}
              >
                Gebruik liever een magic link
              </Button>
            ) : null}
          </div>
          <p className={styles.supportNote}>
            Je kunt ook uitgelogd sets bekijken en reviewed prijzen vergelijken.
            Inloggen ontgrendelt alleen je prive verzamelstatus.
          </p>
          {authStatusMessage ? (
            <p aria-live="polite" className={styles.infoText}>
              {authStatusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p aria-live="polite" className={styles.errorText}>
              {errorMessage}
            </p>
          ) : null}
        </div>
        <Badge className={styles.sessionStatus} tone="warning">
          niet ingelogd
        </Badge>
      </Surface>
    );
  }

  const collectorSetCounts = getCollectorSetCounts(userSession);

  return (
    <Surface
      as="article"
      className={`${styles.card} ${styles.splitCard}`}
      elevation="rested"
    >
      <div className={styles.sessionContent}>
        <p className={styles.statusMeta}>
          Account · {userSession.collector.tier}
        </p>
        <SectionHeading
          description="Collectie, verlanglijst en accountgegevens op een plek."
          eyebrow="Verzamelaarsaccount"
          title="Je account"
          titleAs="h1"
        />
        <div className={styles.sessionHeader}>
          <div className={styles.sessionIdentity}>
            <div aria-hidden="true" className={styles.avatarBadge}>
              {getUserInitials(userSession.collector.name)}
            </div>
            <div className={styles.sessionIdentityText}>
              <h2 className={styles.title}>{userSession.collector.name}</h2>
              <p className={styles.metaText}>
                {userSession.collector.location} · {userSession.collector.id}
              </p>
              {userSession.account?.email ? (
                <p className={styles.metaText}>{userSession.account.email}</p>
              ) : null}
            </div>
          </div>
          <p className={styles.description}>
            {userSession.collector.collectionFocus}
          </p>
        </div>
        <div className={styles.identitySplitGrid}>
          <div className={styles.identityPane}>
            <p className={styles.paneLabel}>Inlog-e-mail</p>
            <p className={styles.paneValue}>
              {userSession.account?.email ?? 'Ingelogde verzamelaarsessie'}
            </p>
            <p className={styles.paneNote}>
              Gebruikt voor inloggen en accountherstel.
            </p>
          </div>
          <div className={styles.identityPane}>
            <p className={styles.paneLabel}>Verzamelaarsnaam</p>
            <p className={styles.paneValue}>@{userSession.collector.id}</p>
            <p className={styles.paneNote}>
              Zichtbaar op je account en opgeslagen sets.
            </p>
          </div>
        </div>
        <p className={styles.sessionCounts}>
          {collectorSetCounts.ownedCount} in collectie opgeslagen ·{' '}
          {collectorSetCounts.wantedCount} op verlanglijst opgeslagen
        </p>
        {isPasswordRecoveryMode ? (
          <form
            className={styles.recoveryForm}
            onSubmit={(event) => {
              event.preventDefault();
              onCompletePasswordRecovery?.();
            }}
          >
            <div className={styles.destinationPanel}>
              <SectionHeading
                description="Kies een nieuw wachtwoord voor dit account. Je collectie en verlanglijst blijven behouden."
                eyebrow="Wachtwoordherstel"
                title="Rond je wachtwoordherstel af"
                titleAs="h2"
              />
              <div className={styles.inputCluster}>
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>Nieuw wachtwoord</span>
                  <input
                    autoComplete="new-password"
                    className={styles.textInput}
                    name="newPassword"
                    placeholder="Vul een nieuw wachtwoord in"
                    type="password"
                    value={passwordRecoveryValue ?? ''}
                    onChange={(event) =>
                      onPasswordRecoveryChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Gebruik minimaal 8 tekens.
                  </span>
                </label>
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>
                    Bevestig nieuw wachtwoord
                  </span>
                  <input
                    autoComplete="new-password"
                    className={styles.textInput}
                    name="confirmNewPassword"
                    placeholder="Herhaal het nieuwe wachtwoord"
                    type="password"
                    value={passwordRecoveryConfirmation ?? ''}
                    onChange={(event) =>
                      onPasswordRecoveryConfirmationChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Herhaal het nieuwe wachtwoord een keer voordat je het
                    opslaat.
                  </span>
                </label>
              </div>
              <div className={styles.sessionActions}>
                <Button
                  isLoading={Boolean(isAuthActionPending)}
                  tone="accent"
                  type="submit"
                >
                  Nieuw wachtwoord opslaan
                </Button>
              </div>
            </div>
          </form>
        ) : null}
        <p className={styles.supportNote}>
          Je opgeslagen sets blijven prive. Setpagina's en prijschecks blijven
          openbaar.
        </p>
        <div className={styles.sessionActions}>
          <Button
            isLoading={Boolean(isAuthActionPending)}
            tone="secondary"
            type="button"
            onClick={onSignOut}
          >
            Uitloggen
          </Button>
          <VisuallyHidden>
            Beëindigt de huidige geauthenticeerde browsersessie.
          </VisuallyHidden>
        </div>
        <div className={styles.destinationPanel}>
          <p className={styles.paneLabel}>Je opgeslagen sets</p>
          <div className={styles.destinationLinks}>
            <ActionLink
              href={buildWebPath(webPathnames.collection)}
              tone="secondary"
            >
              Open collectie ({collectorSetCounts.ownedCount})
            </ActionLink>
            <ActionLink
              href={buildWebPath(webPathnames.wishlist)}
              tone="secondary"
            >
              Open verlanglijst ({collectorSetCounts.wantedCount})
            </ActionLink>
          </div>
        </div>
        {authStatusMessage ? (
          <p aria-live="polite" className={styles.infoText}>
            {authStatusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p aria-live="polite" className={styles.errorText}>
            {errorMessage}
          </p>
        ) : null}
      </div>
      <Badge className={styles.sessionStatus} tone="positive">
        ingelogd
      </Badge>
    </Surface>
  );
}

export function UserProfileEditorCard({
  collectorProfile,
  draft,
  errorMessage,
  isDirty,
  isLoading,
  isSaving,
  onDraftChange,
  onSubmit,
  successMessage,
}: {
  collectorProfile?: CollectorProfile;
  draft?: UpdateCollectorProfileInput;
  errorMessage?: string;
  isDirty?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onDraftChange?: (
    field: keyof UpdateCollectorProfileInput,
    value: UpdateCollectorProfileInput[keyof UpdateCollectorProfileInput],
  ) => void;
  onSubmit?: () => void;
  successMessage?: string;
}) {
  if (isLoading) {
    return (
      <Surface
        as="article"
        className={`${styles.card} ${styles.splitCard}`}
        tone="muted"
      >
        <div className={styles.sessionContent}>
          <SectionHeading
            description="De gegevens op je account en opgeslagen sets worden geladen."
            eyebrow="Profiel"
            title="Profiel wordt geladen"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          synchroniseren
        </Badge>
      </Surface>
    );
  }

  if (!collectorProfile || !draft) {
    return (
      <Surface
        as="article"
        className={`${styles.card} ${styles.splitCard}`}
        tone="muted"
      >
        <div className={styles.sessionContent}>
          <SectionHeading
            description="Je verzamelaarsgegevens konden nu niet worden geladen."
            eyebrow="Profiel"
            title="Profiel niet beschikbaar"
          />
          {errorMessage ? (
            <p aria-live="polite" className={styles.errorText}>
              {errorMessage}
            </p>
          ) : null}
        </div>
        <Badge className={styles.sessionStatus} tone="warning">
          niet beschikbaar
        </Badge>
      </Surface>
    );
  }

  return (
    <Surface
      as="article"
      className={`${styles.card} ${styles.splitCard}`}
      elevation="rested"
    >
      <div className={styles.sessionContent}>
        <p className={styles.statusMeta}>Accountgegevens</p>
        <SectionHeading
          description="Werk de naam en gegevens bij die op je account en opgeslagen sets zichtbaar zijn."
          eyebrow="Verzamelaarsgegevens"
          title="Bewerk je verzamelaarsgegevens"
        />
        <form
          className={styles.profileForm}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
        >
          <div className={styles.profileFieldGrid}>
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>Weergavenaam</span>
              <input
                className={styles.textInput}
                maxLength={80}
                name="displayName"
                required
                type="text"
                value={draft.displayName}
                onChange={(event) =>
                  onDraftChange?.('displayName', event.target.value)
                }
              />
              <span className={styles.fieldHint}>
                Zichtbaar op je account en opgeslagen sets.
              </span>
            </label>
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>Verzamelaarsnaam</span>
              <input
                className={styles.textInput}
                maxLength={32}
                name="collectorHandle"
                required
                type="text"
                value={draft.collectorHandle}
                onChange={(event) =>
                  onDraftChange?.('collectorHandle', event.target.value)
                }
              />
              <span className={styles.fieldHint}>
                Alleen letters, cijfers en koppeltekens.
              </span>
            </label>
          </div>
          <div className={styles.profileFieldGrid}>
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>E-mail</span>
              <input
                className={styles.textInput}
                name="email"
                readOnly
                type="text"
                value={collectorProfile.email ?? 'Verbonden via Supabase-auth'}
              />
              <span className={styles.fieldHint}>Prive inlog-e-mail.</span>
            </label>
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>Verzamelaarsniveau</span>
              <input
                className={styles.textInput}
                name="tier"
                readOnly
                type="text"
                value={collectorProfile.tier}
              />
              <span className={styles.fieldHint}>
                Zichtbaar in je verzamelaarsomgeving.
              </span>
            </label>
          </div>
          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Locatie</span>
            <input
              className={styles.textInput}
              maxLength={80}
              name="location"
              required
              type="text"
              value={draft.location}
              onChange={(event) =>
                onDraftChange?.('location', event.target.value)
              }
            />
            <span className={styles.fieldHint}>Houd het kort.</span>
          </label>
          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Collectiefocus</span>
            <textarea
              className={`${styles.textInput} ${styles.textArea}`}
              maxLength={140}
              name="collectionFocus"
              required
              rows={3}
              value={draft.collectionFocus}
              onChange={(event) =>
                onDraftChange?.('collectionFocus', event.target.value)
              }
            />
            <span className={styles.fieldHint}>
              Een korte zin over de sets en thema's die je volgt.
            </span>
          </label>
          <label className={styles.preferenceRow}>
            <input
              checked={draft.wishlistDealAlerts}
              className={styles.checkboxInput}
              name="wishlistDealAlerts"
              type="checkbox"
              onChange={(event) =>
                onDraftChange?.('wishlistDealAlerts', event.target.checked)
              }
            />
            <div className={styles.preferenceCopy}>
              <span className={styles.fieldLabel}>
                Waarschuw me wanneer een set op mijn verlanglijst een betere
                deal wordt
              </span>
              <span className={styles.fieldHint}>
                Dit bewaart alleen je voorkeur voor toekomstige dealalerts op je
                verlanglijst.
              </span>
            </div>
          </label>
          <div className={styles.sessionActions}>
            <Button
              disabled={!isDirty}
              isLoading={Boolean(isSaving)}
              tone="accent"
              type="submit"
            >
              {isSaving ? 'Profiel wordt opgeslagen...' : 'Profiel opslaan'}
            </Button>
            {!isDirty ? (
              <p className={styles.statusMeta}>Helemaal bijgewerkt</p>
            ) : null}
          </div>
        </form>
        {successMessage ? (
          <p aria-live="polite" className={styles.successText}>
            {successMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p aria-live="polite" className={styles.errorText}>
            {errorMessage}
          </p>
        ) : null}
      </div>
      <Badge className={styles.sessionStatus} tone="positive">
        profiel
      </Badge>
    </Surface>
  );
}

export function UserUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Identiteitsoppervlakken voor account, profiel en verzamelaarsniveau."
        eyebrow="Gebruikers-UI"
        title="Verzamelaarsidentiteit met rustige, nuttige statusaccenten."
      />
    </Surface>
  );
}

export default UserUi;
