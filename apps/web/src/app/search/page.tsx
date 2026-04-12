import {
  CatalogFeatureSearchResults,
  type CatalogFeatureSearchReviewedPriceContext,
} from '@lego-platform/catalog/feature-search-results';
import {
  getFeaturedSetPriceContext,
  listReviewedPriceSetIds,
} from '@lego-platform/pricing/data-access';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import { ShellWeb, ShellWebSearchForm } from '@lego-platform/shell/web';

function readQueryParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string | string[];
    overlay?: string | string[];
    q?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeFilter = readQueryParam(resolvedSearchParams.filter);
  const overlay = readQueryParam(resolvedSearchParams.overlay);
  const query = readQueryParam(resolvedSearchParams.q);
  const shouldOpenMobileOverlay = overlay === '1' && !query;
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
    <ShellWeb
      searchQuery={query}
      showMobileSearchOverlay={!shouldOpenMobileOverlay}
    >
      <CatalogFeatureSearchResults
        activeFilter={activeFilter}
        query={query}
        reviewedPriceContexts={reviewedPriceContexts}
        searchEntry={
          shouldOpenMobileOverlay ? (
            <ShellWebSearchForm
              closeFallbackHref={buildWebPath(webPathnames.discover)}
              hideTrigger
              inputId="site-search-page-mobile"
              openOnMount
              query={query}
              variant="mobile-overlay"
            />
          ) : (
            <ShellWebSearchForm
              autoFocus={!query}
              inputId="site-search-page"
              query={query}
            />
          )
        }
      />
    </ShellWeb>
  );
}
