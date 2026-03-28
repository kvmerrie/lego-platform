import {
  getCollectorSetCounts,
  getUserInitials,
  isAuthenticatedSession,
  UserProfile,
  UserSession,
} from '@lego-platform/user/util';
import { Badge, SectionHeading, Surface } from '@lego-platform/shared/ui';
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
  errorMessage,
  isLoading,
  userSession,
}: {
  errorMessage?: string;
  isLoading?: boolean;
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
            description="Loading the phase-1 authenticated mock session."
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
            description="Phase 1 keeps auth mocked, but the UI still renders against the real session contract."
            eyebrow="Session"
            title="Collector session not available"
          />
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
