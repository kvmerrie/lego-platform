import { getUserInitials, UserProfile } from '@lego-platform/user/util';

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
