import { ShellFeatureCollectorCollection } from '@lego-platform/shell/feature-collector-collection';
import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuth } from '@lego-platform/user/feature-auth';

export default function CollectionPage() {
  return (
    <ShellWeb>
      <section aria-label="Collector account">
        <UserFeatureAuth />
      </section>
      <ShellFeatureCollectorCollection />
    </ShellWeb>
  );
}
