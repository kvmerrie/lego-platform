import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuthCallback } from '@lego-platform/user/feature-auth-callback';
import { getUtilityRouteMetadata } from '../../lib/utility-route-metadata';

export const metadata = getUtilityRouteMetadata('/auth/callback');

export default function AuthCallbackPage() {
  return (
    <ShellWeb>
      <UserFeatureAuthCallback />
    </ShellWeb>
  );
}
