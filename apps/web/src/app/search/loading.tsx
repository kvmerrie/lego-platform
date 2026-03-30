import { CatalogFeatureSearchResultsLoading } from '@lego-platform/catalog/feature-search-results';
import { ShellWeb } from '@lego-platform/shell/web';

export default function SearchLoading() {
  return (
    <ShellWeb>
      <CatalogFeatureSearchResultsLoading />
    </ShellWeb>
  );
}
