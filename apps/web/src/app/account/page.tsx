import { webPathnames } from '@lego-platform/shared/config';
import { ShellFeatureWishlistAlertSummary } from '@lego-platform/shell/feature-collector-wishlist';
import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuth } from '@lego-platform/user/feature-auth';
import { UserFeatureProfile } from '@lego-platform/user/feature-profile';
import { getUtilityRouteMetadata } from '../lib/utility-route-metadata';
import styles from './page.module.css';

export const metadata = getUtilityRouteMetadata(webPathnames.account);

export default function AccountPage() {
  return (
    <ShellWeb>
      <section aria-label="Account" className={styles.accountPage}>
        <UserFeatureAuth />
        <ShellFeatureWishlistAlertSummary />
        <UserFeatureProfile />
      </section>
    </ShellWeb>
  );
}
