import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuthCallback } from '@lego-platform/user/feature-auth-callback';

export default function AuthCallbackPage() {
  return (
    <ShellWeb>
      <UserFeatureAuthCallback />
    </ShellWeb>
  );
}
