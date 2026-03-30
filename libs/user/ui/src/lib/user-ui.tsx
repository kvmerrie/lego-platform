import {
  CollectorProfile,
  getCollectorSetCounts,
  getUserInitials,
  isAuthenticatedSession,
  UpdateCollectorProfileInput,
  UserProfile,
  UserSession,
} from '@lego-platform/user/util';
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
            description="Checking your collection, wishlist, and profile."
            eyebrow="Collector status"
            title="Checking collector status"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          syncing
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
              ? 'Signed out · Private saves after sign-in'
              : 'Signed out · Sign-in unavailable'}
          </p>
          <SectionHeading
            description={
              isAuthAvailable
                ? 'Sign in once to save your collection, wishlist, and profile privately.'
                : 'Browsing still works here, but private collector saves are unavailable in this environment.'
            }
            eyebrow="Collector status"
            title="Sign in to start saving privately"
          />
          <div className={styles.shellStatusActions}>
            <ActionLink
              href="/collection"
              tone={isAuthAvailable ? 'accent' : 'secondary'}
            >
              {isAuthAvailable
                ? 'Sign in to save privately'
                : 'Open collection'}
            </ActionLink>
            <ActionLink href="/wishlist" tone="secondary">
              Open wishlist
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
          signed out
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
          Signed in · {userSession.collector.tier}
        </p>
        <SectionHeading
          description="Your private collector state is ready."
          eyebrow="Collector status"
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
          {collectorSetCounts.ownedCount} owned saved ·{' '}
          {collectorSetCounts.wantedCount} wanted saved
        </p>
        <div className={styles.shellStatusActions}>
          <ActionLink href="/collection" tone="secondary">
            Open collection
          </ActionLink>
          <ActionLink href="/wishlist" tone="secondary">
            Open wishlist
          </ActionLink>
          <Button
            isLoading={Boolean(isAuthActionPending)}
            tone="ghost"
            type="button"
            onClick={onSignOut}
          >
            Sign out
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
        ready
      </Badge>
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
            description="Checking the collector account for this set."
            eyebrow="Collector account"
            title="Checking collector account"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          syncing
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
                ? 'Use one email link to open your collection, wishlist, and collector details.'
                : 'Browsing still works here, but saved collector actions stay disabled in this environment.'
            }
            eyebrow="Account"
            title="Sign in to open your account"
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
              <span className={styles.fieldHint}>
                Give it about a minute before asking for another link.
              </span>
            </label>
            <div className={styles.sessionActions}>
              <Button
                disabled={!isAuthAvailable}
                isLoading={Boolean(isAuthActionPending)}
                tone="accent"
                type="submit"
              >
                {isAuthActionPending
                  ? 'Sending sign-in link...'
                  : authStatusMessage
                    ? 'Send another email link'
                    : 'Email sign-in link'}
              </Button>
            </div>
          </form>
          <p className={styles.supportNote}>
            Browsing and reviewed pricing still work without signing in.
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
          not signed in
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
          description="Your collection, wishlist, and collector details live here."
          eyebrow="Collector account"
          title="Your account"
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
            <p className={styles.paneLabel}>Sign-in email</p>
            <p className={styles.paneValue}>
              {userSession.account?.email ?? 'Signed in collector session'}
            </p>
            <p className={styles.paneNote}>Used only for account access.</p>
          </div>
          <div className={styles.identityPane}>
            <p className={styles.paneLabel}>Collector handle</p>
            <p className={styles.paneValue}>@{userSession.collector.id}</p>
            <p className={styles.paneNote}>Shown across your collector area.</p>
          </div>
        </div>
        <p className={styles.sessionCounts}>
          {collectorSetCounts.ownedCount} owned saved ·{' '}
          {collectorSetCounts.wantedCount} wanted saved
        </p>
        <p className={styles.supportNote}>
          Collection and wishlist stay private. Set facts and pricing stay
          public.
        </p>
        <div className={styles.sessionActions}>
          <Button
            isLoading={Boolean(isAuthActionPending)}
            tone="secondary"
            type="button"
            onClick={onSignOut}
          >
            Sign out
          </Button>
          <VisuallyHidden>
            Ends the current authenticated browser session.
          </VisuallyHidden>
        </div>
        <div className={styles.destinationPanel}>
          <p className={styles.paneLabel}>Your saves</p>
          <div className={styles.destinationLinks}>
            <ActionLink href="/collection" tone="secondary">
              Open collection
            </ActionLink>
            <ActionLink href="/wishlist" tone="secondary">
              Open wishlist
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
        signed in
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
    value: string,
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
            description="Loading the collector details used across your signed-in surfaces."
            eyebrow="Profile"
            title="Loading collector profile"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          syncing
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
            description="Your collector profile could not be loaded right now."
            eyebrow="Profile"
            title="Collector profile unavailable"
          />
          {errorMessage ? (
            <p aria-live="polite" className={styles.errorText}>
              {errorMessage}
            </p>
          ) : null}
        </div>
        <Badge className={styles.sessionStatus} tone="warning">
          unavailable
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
        <p className={styles.statusMeta}>Account details</p>
        <SectionHeading
          description="Update the name and details used across your collector area."
          eyebrow="Collector details"
          title="Edit your collector details"
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
              <span className={styles.fieldLabel}>Display name</span>
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
                Shown across your account and saved sets.
              </span>
            </label>
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>Collector handle</span>
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
                Letters, numbers, and hyphens only.
              </span>
            </label>
          </div>
          <div className={styles.profileFieldGrid}>
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>Email</span>
              <input
                className={styles.textInput}
                name="email"
                readOnly
                type="text"
                value={collectorProfile.email ?? 'Connected via Supabase auth'}
              />
              <span className={styles.fieldHint}>Private sign-in email.</span>
            </label>
            <label className={styles.formField}>
              <span className={styles.fieldLabel}>Collector tier</span>
              <input
                className={styles.textInput}
                name="tier"
                readOnly
                type="text"
                value={collectorProfile.tier}
              />
              <span className={styles.fieldHint}>
                Shown in your collector area.
              </span>
            </label>
          </div>
          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Location</span>
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
            <span className={styles.fieldHint}>Keep it short.</span>
          </label>
          <label className={styles.formField}>
            <span className={styles.fieldLabel}>Collection focus</span>
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
              One short line about the sets and themes you follow.
            </span>
          </label>
          <div className={styles.sessionActions}>
            <Button
              disabled={!isDirty}
              isLoading={Boolean(isSaving)}
              tone="accent"
              type="submit"
            >
              {isSaving ? 'Saving profile...' : 'Save profile'}
            </Button>
            {!isDirty ? <p className={styles.statusMeta}>Up to date</p> : null}
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
        ready
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
