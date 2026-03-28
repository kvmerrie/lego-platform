import {
  getCollectorSetCounts,
  getUserInitials,
  isAuthenticatedSession,
  UserProfile,
  UserSession,
} from '@lego-platform/user/util';

export function UserIdentityCard({
  userProfile,
}: {
  userProfile: UserProfile;
}) {
  return (
    <article className="surface split-card">
      <div className="avatar-badge">{getUserInitials(userProfile.name)}</div>
      <div className="stack">
        <p className="eyebrow">{userProfile.tier}</p>
        <h3 className="surface-title">{userProfile.name}</h3>
        <p className="muted">
          {userProfile.location} · {userProfile.collectionFocus}
        </p>
      </div>
    </article>
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
      <article className="surface split-card">
        <div className="stack">
          <p className="eyebrow">Session</p>
          <h2 className="surface-title">Checking collector session</h2>
          <p className="muted">Loading the phase-1 authenticated mock session.</p>
        </div>
        <span className="pill">loading</span>
      </article>
    );
  }

  if (!isAuthenticatedSession(userSession)) {
    return (
      <article className="surface split-card">
        <div className="stack">
          <p className="eyebrow">Session</p>
          <h2 className="surface-title">Collector session not available</h2>
          <p className="muted">
            Phase 1 keeps auth mocked, but the UI still renders against the
            real session contract.
          </p>
          {errorMessage ? <p className="muted">{errorMessage}</p> : null}
        </div>
        <span className="pill">anonymous</span>
      </article>
    );
  }

  const collectorSetCounts = getCollectorSetCounts(userSession);

  return (
    <article className="surface split-card">
      <div className="stack">
        <p className="eyebrow">Collector session</p>
        <div className="split-row">
          <div className="avatar-badge">
            {getUserInitials(userSession.collector.name)}
          </div>
          <div className="stack">
            <h2 className="surface-title">{userSession.collector.name}</h2>
            <p className="muted">
              {userSession.collector.tier} · {userSession.collector.location}
            </p>
          </div>
        </div>
        <p className="muted">{userSession.collector.collectionFocus}</p>
        <div className="pill-row">
          <span className="pill">{collectorSetCounts.ownedCount} owned</span>
          <span className="pill">{collectorSetCounts.wantedCount} wanted</span>
        </div>
        {errorMessage ? <p className="muted">{errorMessage}</p> : null}
      </div>
      <span className="pill">{userSession.state}</span>
    </article>
  );
}

export function UserUi() {
  return (
    <section className="surface stack">
      <p className="eyebrow">User UI</p>
      <h2 className="surface-title">
        Identity surfaces for account, profile, and collector-tier presentation.
      </h2>
    </section>
  );
}

export default UserUi;
