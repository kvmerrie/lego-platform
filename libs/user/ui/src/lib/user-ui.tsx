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
            description="Loading the signed-in collector account that keeps owned, wanted, and profile state attached to this set."
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
                ? 'Browse the public catalog freely. Sign in with one email link to save owned and wanted sets privately, keep a collector profile, and come back to the same collector state later.'
                : 'Browser sign-in is not configured in this environment yet, so browsing still works but saved collector actions stay disabled.'
            }
            eyebrow="Collector account"
            title="Sign in to save your collector state"
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
                One link is enough. Wait about a minute before requesting
                another sign-in link.
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
              {!isAuthAvailable ? (
                <Badge tone="warning">sign-in unavailable</Badge>
              ) : null}
            </div>
          </form>
          <p className={styles.supportNote}>
            Signing in only unlocks your private collector state. Public catalog
            pages and reviewed buy guidance stay visible without an account.
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
        <div className={styles.statusRow}>
          <Badge tone="accent">Collector account</Badge>
          <Badge tone="positive">{userSession.collector.tier}</Badge>
        </div>
        <SectionHeading
          description="Keep browsing the public set pages, then use this signed-in collector account to save owned, wanted, and profile changes privately."
          eyebrow="Signed in"
          title="Collector account active"
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
            <p className={styles.paneLabel}>Private account</p>
            <p className={styles.paneValue}>
              {userSession.account?.email ?? 'Signed in collector session'}
            </p>
            <p className={styles.paneNote}>
              Used for sign-in and saved collector state. It is not shown as
              public catalog information.
            </p>
          </div>
          <div className={styles.identityPane}>
            <p className={styles.paneLabel}>Collector identity</p>
            <p className={styles.paneValue}>@{userSession.collector.id}</p>
            <p className={styles.paneNote}>
              Shown across your signed-in collector surfaces so owned, wanted,
              and profile details feel consistent.
            </p>
          </div>
        </div>
        <div className={styles.sessionCounts}>
          <Badge tone="positive">
            {collectorSetCounts.ownedCount} owned saved
          </Badge>
          <Badge tone="info">
            {collectorSetCounts.wantedCount} wanted saved
          </Badge>
        </div>
        <p className={styles.supportNote}>
          Owned and wanted saves are personal account state. Public set facts,
          pricing guidance, and reviewed offers remain shared catalog surfaces.
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
          <p className={styles.paneLabel}>Collector destinations</p>
          <p className={styles.paneNote}>
            After you browse a set, jump between your private collection and
            wishlist while this signed-in collector account stays active.
          </p>
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
            description="Loading the editable collector details that appear alongside your signed-in account."
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
            description="The signed-in collector profile could not be loaded right now, but your saved account state is still intact."
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
        <div className={styles.statusRow}>
          <Badge tone="accent">Profile</Badge>
          <Badge tone="info">Signed-in account</Badge>
        </div>
        <SectionHeading
          description="Refine the collector identity that appears with your saved owned and wanted state across this product slice."
          eyebrow="Collector identity"
          title="Refine your collector profile"
        />
        <p className={styles.supportNote}>
          Keep these details concise and recognizable. Display name, handle,
          location, and collection focus are your collector-facing identity.
          Your sign-in email stays private to account access.
        </p>
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
                Use the name you want shown on your collector card.
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
                Use letters, numbers, and hyphens. After saving, this stays
                product-facing anywhere your collector handle appears.
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
              <span className={styles.fieldHint}>
                Private sign-in email. This is used for account access, not as
                public catalog identity.
              </span>
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
                Product-facing account status shown in your signed-in collector
                surfaces.
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
            <span className={styles.fieldHint}>
              Keep it short and recognizable for your collector identity.
            </span>
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
              A short line about the sets and themes you care about most in this
              signed-in collector area.
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
            {!isDirty ? <Badge tone="neutral">Up to date</Badge> : null}
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
