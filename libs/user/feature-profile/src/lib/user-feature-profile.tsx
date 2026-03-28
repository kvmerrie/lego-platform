import { getUserProfile } from '@lego-platform/user/data-access';
import { UserIdentityCard } from '@lego-platform/user/ui';

export function UserFeatureProfile() {
  const userProfile = getUserProfile();

  return (
    <section className="section-stack">
      <header className="section-heading">
        <p className="eyebrow">Profile</p>
        <h2>
          Collector identity stays reusable across public, admin, and future
          native surfaces.
        </h2>
      </header>
      <UserIdentityCard userProfile={userProfile} />
    </section>
  );
}

export default UserFeatureProfile;
