import {
  CatalogFeatureSearchResults,
  type CatalogFeatureSearchReviewedPriceContext,
} from '@lego-platform/catalog/feature-search-results';
import {
  listCatalogCurrentOfferSummariesBySetIds,
  listCatalogSearchMatchesWithOverlay,
} from '@lego-platform/catalog/data-access-web';
import { getFeaturedSetPriceContext } from '@lego-platform/pricing/data-access';
import { buildWebPath, webPathnames } from '@lego-platform/shared/config';
import { ShellWeb, ShellWebSearchForm } from '@lego-platform/shell/web';
import { buildCurrentSearchReviewedPriceContext } from '../lib/current-set-card-price-context';

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
  const searchMatches = query
    ? await listCatalogSearchMatchesWithOverlay({
        limit: Number.MAX_SAFE_INTEGER,
        query,
      })
    : [];
  const currentOfferSummaryBySetId =
    await listCatalogCurrentOfferSummariesBySetIds({
      setIds: searchMatches.map((searchMatch) => searchMatch.setCard.id),
    });
  const reviewedPriceContexts: CatalogFeatureSearchReviewedPriceContext[] =
    searchMatches.flatMap((searchMatch) => {
      const featuredSetPriceContext = getFeaturedSetPriceContext(
        searchMatch.setCard.id,
      );
      const currentSearchReviewedPriceContext =
        buildCurrentSearchReviewedPriceContext({
          currentOfferSummary: currentOfferSummaryBySetId.get(
            searchMatch.setCard.id,
          ),
          pricePanelSnapshot: featuredSetPriceContext,
        });

      return currentSearchReviewedPriceContext
        ? [currentSearchReviewedPriceContext]
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
        searchMatches={searchMatches}
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
