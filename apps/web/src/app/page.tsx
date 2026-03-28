import { CatalogFeatureSetList } from '@lego-platform/catalog/feature-set-list';
import { CatalogHomepageIntro } from '@lego-platform/catalog/ui';
import { ShellWeb } from '@lego-platform/shell/web';

export default function HomePage() {
  return (
    <ShellWeb>
      <CatalogHomepageIntro />
      <CatalogFeatureSetList />
    </ShellWeb>
  );
}
