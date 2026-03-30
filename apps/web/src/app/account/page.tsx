import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuth } from '@lego-platform/user/feature-auth';
import { UserFeatureProfile } from '@lego-platform/user/feature-profile';
import styles from './page.module.css';

export default function AccountPage() {
  return (
    <ShellWeb>
      <section aria-label="Account" className={styles.accountPage}>
        <UserFeatureAuth />
        <UserFeatureProfile />
      </section>
    </ShellWeb>
  );
}
