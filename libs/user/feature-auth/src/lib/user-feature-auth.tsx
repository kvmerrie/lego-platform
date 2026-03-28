import { getAuthSummary } from '@lego-platform/user/data-access';

export function UserFeatureAuth() {
  const authSummary = getAuthSummary();

  return (
    <section className="surface split-card">
      <div className="stack">
        <p className="eyebrow">Auth state</p>
        <h2 className="surface-title">{authSummary.message}</h2>
        <p className="muted">Next action: {authSummary.nextAction}</p>
      </div>
      <span className="pill">{authSummary.state}</span>
    </section>
  );
}

export default UserFeatureAuth;
