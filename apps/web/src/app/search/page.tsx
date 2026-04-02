import {
  CatalogFeatureSearchResults,
  type CatalogFeatureSearchReviewedPriceContext,
} from '@lego-platform/catalog/feature-search-results';
import {
  getFeaturedSetPriceContext,
  listReviewedPriceSetIds,
} from '@lego-platform/pricing/data-access';
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
  const reviewedPriceContexts: CatalogFeatureSearchReviewedPriceContext[] =
    listReviewedPriceSetIds().flatMap((setId) => {
      const featuredSetPriceContext = getFeaturedSetPriceContext(setId);

      return featuredSetPriceContext
        ? [
            {
              currencyCode: featuredSetPriceContext.currencyCode,
              deltaMinor: featuredSetPriceContext.deltaMinor,
              headlinePriceMinor: featuredSetPriceContext.headlinePriceMinor,
              merchantName: featuredSetPriceContext.merchantName,
              setId: featuredSetPriceContext.setId,
            },
          ]
        : [];
    });

  return (
    <ShellWeb searchQuery={query}>
      <CatalogFeatureSearchResults
        query={query}
        reviewedPriceContexts={reviewedPriceContexts}
      />
    </ShellWeb>
  );
}
