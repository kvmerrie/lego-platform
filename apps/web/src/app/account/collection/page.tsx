import { webPathnames } from '@lego-platform/shared/config';
import { ShellFeatureCollectorCollection } from '@lego-platform/shell/feature-collector-collection';
import { ShellWeb } from '@lego-platform/shell/web';
import { getUtilityRouteMetadata } from '../../lib/utility-route-metadata';

export const metadata = getUtilityRouteMetadata(webPathnames.collection);

export default function AccountCollectionPage() {
  return (
    <ShellWeb>
      <ShellFeatureCollectorCollection />
    </ShellWeb>
  );
}
