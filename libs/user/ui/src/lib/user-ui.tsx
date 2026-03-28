import {
  getCollectorSetCounts,
  getUserInitials,
  isAuthenticatedSession,
  UserProfile,
  UserSession,
} from '@lego-platform/user/util';
import {
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
        <div className={styles.statusRow}>
          <Badge tone="accent">{userProfile.tier}</Badge>
        </div>
        <h3 className={styles.title}>{userProfile.name}</h3>
        <p className={styles.description}>
          {userProfile.location} · {userProfile.collectionFocus}
        </p>
      </div>
    </Surface>
  );
}

export function UserSessionCard({
  authEmail,
  authStatusMessage,
  errorMessage,
  isAuthActionPending,
  isAuthAvailable = true,
  isLoading,
  onAuthEmailChange,
  onSignIn,
  onSignOut,
  userSession,
}: {
  authEmail?: string;
  authStatusMessage?: string;
  errorMessage?: string;
  isAuthActionPending?: boolean;
  isAuthAvailable?: boolean;
  isLoading?: boolean;
  onAuthEmailChange?: (value: string) => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
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
            description="Loading the current collector session and set-state ledger."
            eyebrow="Session"
            title="Checking collector session"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          loading
        </Badge>
      </Surface>
    );
  }

  if (!isAuthenticatedSession(userSession)) {
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
                ? 'Use a Supabase email sign-in link to save owned and wanted state without changing the static catalog experience.'
                : 'Supabase browser auth is not configured in this environment yet, so the public slice stays browseable in anonymous mode.'
            }
            eyebrow="Session"
            title="Sign in to keep your collector state"
          />
          <form
            className={styles.authForm}
            onSubmit={(event) => {
              event.preventDefault();
              onSignIn?.();
            }}
          >
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>Email address</span>
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
            </label>
            <div className={styles.sessionActions}>
              <Button
                disabled={!isAuthAvailable}
                isLoading={Boolean(isAuthActionPending)}
                tone="accent"
                type="submit"
              >
                {isAuthActionPending ? 'Sending link...' : 'Email sign-in link'}
              </Button>
              {!isAuthAvailable ? (
                <Badge tone="warning">auth unavailable</Badge>
              ) : null}
            </div>
          </form>
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
          anonymous
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
        <div className={styles.statusRow}>
          <Badge tone="accent">Collector session</Badge>
          <Badge tone="positive">{userSession.collector.tier}</Badge>
        </div>
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
        <div className={styles.sessionCounts}>
          <Badge tone="positive">{collectorSetCounts.ownedCount} owned</Badge>
          <Badge tone="info">{collectorSetCounts.wantedCount} wanted</Badge>
        </div>
        <div className={styles.sessionActions}>
          <Button
            isLoading={Boolean(isAuthActionPending)}
            tone="secondary"
            type="button"
            onClick={onSignOut}
          >
            Sign out
          </Button>
          <VisuallyHidden>Ends the current authenticated browser session.</VisuallyHidden>
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
        {userSession.state}
      </Badge>
    </Surface>
  );
}

export function UserUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Identity surfaces for account, profile, and collector-tier presentation."
        eyebrow="User UI"
        title="Collector identity with calm, utility-oriented status cues."
      />
    </Surface>
  );
}

export default UserUi;
