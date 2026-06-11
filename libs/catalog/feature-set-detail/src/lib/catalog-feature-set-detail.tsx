import type { ReactNode } from 'react';
import {
  CatalogSetDetailPanel,
  type CatalogSetDetailBestDeal,
  type CatalogSetDetailOfferItem,
  type CatalogSetDetailReviewSummary,
  type CatalogSetDetailSupportItem,
  type CatalogSetDetailTrustSignal,
  type CatalogSetDetailVerdict,
} from '@lego-platform/catalog/ui';
import { CatalogSetDetail } from '@lego-platform/catalog/util';
import { buildSetDetailPath } from '@lego-platform/shared/config';

export function CatalogFeatureSetDetail({
  bestDeal,
  brickhuntValueItems = [],
  catalogSetDetail,
  dealSupportItems = [],
  dealVerdict,
  followCopy,
  followTitle,
  heroCtaSideAction,
  offerList = [],
  offerSummaryLabel,
  ownershipActions,
  priceAlertAction,
  priceHistoryPanel,
  productReviewsSlot,
  recentlyViewedRail,
  reviewSummary,
  similarSetsRail,
  setNewsRail,
  themeDirectoryHref,
  themeHref,
  trustSignals = [],
}: {
  bestDeal?: CatalogSetDetailBestDeal;
  brickhuntValueItems?: readonly CatalogSetDetailSupportItem[];
  catalogSetDetail: CatalogSetDetail;
  dealSupportItems?: readonly CatalogSetDetailSupportItem[];
  dealVerdict: CatalogSetDetailVerdict;
  followCopy?: string;
  followTitle?: string;
  heroCtaSideAction?: ReactNode;
  offerList?: readonly CatalogSetDetailOfferItem[];
  offerSummaryLabel?: string;
  ownershipActions?: ReactNode;
  priceAlertAction?: ReactNode;
  priceHistoryPanel?: ReactNode;
  productReviewsSlot?: ReactNode;
  recentlyViewedRail?: ReactNode;
  reviewSummary?: CatalogSetDetailReviewSummary;
  similarSetsRail?: ReactNode;
  setNewsRail?: ReactNode;
  themeDirectoryHref?: string;
  themeHref?: string;
  trustSignals?: readonly CatalogSetDetailTrustSignal[];
}) {
  return (
    <CatalogSetDetailPanel
      bestDeal={bestDeal}
      brickhuntValueItems={brickhuntValueItems}
      catalogSetDetail={catalogSetDetail}
      dealSupportItems={dealSupportItems}
      dealVerdict={dealVerdict}
      followCopy={followCopy}
      followTitle={followTitle}
      heroCtaSideAction={heroCtaSideAction}
      offerList={[...offerList]}
      offerSummaryLabel={offerSummaryLabel}
      ownershipActions={ownershipActions}
      priceAlertAction={priceAlertAction}
      priceHistoryPanel={priceHistoryPanel}
      productReviewsSlot={productReviewsSlot}
      recentlyViewedRail={recentlyViewedRail}
      reviewSummary={reviewSummary}
      setDetailHref={buildSetDetailPath(catalogSetDetail.slug)}
      similarSetsRail={similarSetsRail}
      setNewsRail={setNewsRail}
      themeDirectoryHref={themeDirectoryHref}
      themeHref={themeHref}
      trustSignals={[...trustSignals]}
    />
  );
}

export default CatalogFeatureSetDetail;
