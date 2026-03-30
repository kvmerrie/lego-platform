import { CatalogFeatureSearchResults } from '@lego-platform/catalog/feature-search-results';
import { ShellWeb } from '@lego-platform/shell/web';

function readQueryParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = readQueryParam(resolvedSearchParams.q);

  return (
    <ShellWeb searchQuery={query}>
      <CatalogFeatureSearchResults query={query} />
    </ShellWeb>
  );
}
