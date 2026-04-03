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
            description="Loading your account, saves, and profile."
            eyebrow="Collector status"
            title="Checking your account"
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
              ? 'Signed out · Save collection and wishlist privately'
              : 'Signed out · Sign-in unavailable'}
          </p>
          <SectionHeading
            description={
              isAuthAvailable
                ? 'Sign in with email and password or Google to keep collection, wishlist, and collector details in one place.'
                : 'Browsing still works here, but private collector saves are unavailable in this environment.'
            }
            eyebrow="Collector status"
            title="Sign in to save sets"
          />
          <div className={styles.shellStatusActions}>
            <ActionLink
              href={buildWebPath(webPathnames.collection)}
              tone={isAuthAvailable ? 'accent' : 'secondary'}
            >
              {isAuthAvailable
                ? 'Sign in to save privately'
                : 'Open collection'}
            </ActionLink>
            <ActionLink
              href={buildWebPath(webPathnames.wishlist)}
              tone="secondary"
            >
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
          description="Your saved sets and collector details are one click away."
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
          {collectorSetCounts.wantedCount} wishlist saved
        </p>
        <div className={styles.shellStatusActions}>
          <ActionLink
            href={buildWebPath(webPathnames.collection)}
            tone="secondary"
          >
            Open collection ({collectorSetCounts.ownedCount})
          </ActionLink>
          <ActionLink
            href={buildWebPath(webPathnames.wishlist)}
            tone="secondary"
          >
            Open wishlist ({collectorSetCounts.wantedCount})
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
        signed in
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
            description="Checking the collector account for this set."
            eyebrow="Collector account"
            title="Checking collector account"
            titleAs="h1"
          />
        </div>
        <Badge className={styles.sessionStatus} tone="info">
          syncing
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
                  ? 'Send a recovery email, then open the secure link there to choose a new password.'
                  : isMagicLinkMode
                    ? 'Prefer not to use a password? Use a one-time email link instead.'
                    : isSignUpMode
                      ? 'Create an account to keep wishlist, collection, and collector details in one private place.'
                      : 'Sign in with email and password first. Google is available when this environment supports it, and magic link stays here as a fallback.'
                : 'Browsing still works here, but saved collector actions stay disabled in this environment.'
            }
            eyebrow="Account"
            title="Sign in to open your account"
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
                  {isMagicLinkMode
                    ? 'Give it about a minute before asking for another link.'
                    : isResetMode
                      ? 'Use the same email you used to create the account.'
                      : 'Your collection and wishlist stay tied to this account.'}
                </span>
              </label>
              {!isMagicLinkMode && !isResetMode ? (
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>Password</span>
                  <input
                    autoComplete={
                      isSignUpMode ? 'new-password' : 'current-password'
                    }
                    className={styles.textInput}
                    name="password"
                    placeholder={
                      isSignUpMode ? 'Create a password' : 'Enter your password'
                    }
                    type="password"
                    value={authPassword ?? ''}
                    onChange={(event) =>
                      onAuthPasswordChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Use at least 8 characters.
                  </span>
                </label>
              ) : null}
              {isSignUpMode ? (
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>Confirm password</span>
                  <input
                    autoComplete="new-password"
                    className={styles.textInput}
                    name="confirmPassword"
                    placeholder="Confirm your password"
                    type="password"
                    value={authPasswordConfirmation ?? ''}
                    onChange={(event) =>
                      onAuthPasswordConfirmationChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Repeat the password once so this account is ready to use.
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
                    ? 'Sending reset email...'
                    : isMagicLinkMode
                      ? 'Sending sign-in link...'
                      : isSignUpMode
                        ? 'Creating account...'
                        : 'Signing in...'
                  : isResetMode
                    ? 'Send reset email'
                    : isMagicLinkMode
                      ? authStatusMessage
                        ? 'Send another email link'
                        : 'Email sign-in link'
                      : isSignUpMode
                        ? 'Create account'
                        : 'Sign in'}
              </Button>
              {!isMagicLinkMode && !isResetMode ? (
                <Button
                  disabled={!isAuthAvailable}
                  isLoading={Boolean(isAuthActionPending)}
                  tone="secondary"
                  type="button"
                  onClick={onGoogleSignIn}
                >
                  Continue with Google
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
                Use email and password
              </Button>
            ) : (
              <Button
                disabled={!isAuthAvailable}
                tone="ghost"
                type="button"
                onClick={() => onAuthModeChange?.('sign-up')}
              >
                Create an account
              </Button>
            )}
            {authMode !== 'reset-password' ? (
              <Button
                disabled={!isAuthAvailable}
                tone="ghost"
                type="button"
                onClick={() => onAuthModeChange?.('reset-password')}
              >
                Forgot password?
              </Button>
            ) : null}
            {authMode !== 'magic-link' ? (
              <Button
                disabled={!isAuthAvailable}
                tone="ghost"
                type="button"
                onClick={() => onAuthModeChange?.('magic-link')}
              >
                Use a magic link instead
              </Button>
            ) : null}
          </div>
          <p className={styles.supportNote}>
            You can still browse sets and compare reviewed prices while signed
            out. Account sign-in only unlocks private collector state.
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
          description="Collection, wishlist, and account details in one place."
          eyebrow="Collector account"
          title="Your account"
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
            <p className={styles.paneLabel}>Sign-in email</p>
            <p className={styles.paneValue}>
              {userSession.account?.email ?? 'Signed in collector session'}
            </p>
            <p className={styles.paneNote}>
              Used for sign-in and account recovery.
            </p>
          </div>
          <div className={styles.identityPane}>
            <p className={styles.paneLabel}>Collector handle</p>
            <p className={styles.paneValue}>@{userSession.collector.id}</p>
            <p className={styles.paneNote}>
              Shown on your account and saved sets.
            </p>
          </div>
        </div>
        <p className={styles.sessionCounts}>
          {collectorSetCounts.ownedCount} owned saved ·{' '}
          {collectorSetCounts.wantedCount} wishlist saved
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
                description="Choose a new password for this account. Your collection and wishlist stay in place."
                eyebrow="Password reset"
                title="Finish resetting your password"
                titleAs="h2"
              />
              <div className={styles.inputCluster}>
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>New password</span>
                  <input
                    autoComplete="new-password"
                    className={styles.textInput}
                    name="newPassword"
                    placeholder="Enter a new password"
                    type="password"
                    value={passwordRecoveryValue ?? ''}
                    onChange={(event) =>
                      onPasswordRecoveryChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Use at least 8 characters.
                  </span>
                </label>
                <label className={styles.formField}>
                  <span className={styles.fieldLabel}>
                    Confirm new password
                  </span>
                  <input
                    autoComplete="new-password"
                    className={styles.textInput}
                    name="confirmNewPassword"
                    placeholder="Repeat the new password"
                    type="password"
                    value={passwordRecoveryConfirmation ?? ''}
                    onChange={(event) =>
                      onPasswordRecoveryConfirmationChange?.(event.target.value)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Repeat the new password once before saving it.
                  </span>
                </label>
              </div>
              <div className={styles.sessionActions}>
                <Button
                  isLoading={Boolean(isAuthActionPending)}
                  tone="accent"
                  type="submit"
                >
                  Save new password
                </Button>
              </div>
            </div>
          </form>
        ) : null}
        <p className={styles.supportNote}>
          Your saves stay private. Set pages and price checks stay public.
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
            <ActionLink
              href={buildWebPath(webPathnames.collection)}
              tone="secondary"
            >
              Open collection ({collectorSetCounts.ownedCount})
            </ActionLink>
            <ActionLink
              href={buildWebPath(webPathnames.wishlist)}
              tone="secondary"
            >
              Open wishlist ({collectorSetCounts.wantedCount})
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
            description="Loading the details shown on your account and saved sets."
            eyebrow="Profile"
            title="Loading profile"
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
            description="We could not load your collector details right now."
            eyebrow="Profile"
            title="Profile unavailable"
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
          description="Update the name and details shown on your account and saved sets."
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
                Shown on your account and saved sets.
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
        profile
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
