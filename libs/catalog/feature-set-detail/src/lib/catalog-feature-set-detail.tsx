import type { ReactNode } from 'react';
import {
  CatalogSetDetailPanel,
  type CatalogSetDetailBestDeal,
  type CatalogSetDetailOfferItem,
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
  dealsHref,
  followCopy,
  followEyebrow,
  followTitle,
  offerList = [],
  offerSummaryLabel,
  ownershipActions,
  priceAlertAction,
  priceHistoryPanel,
  recentlyViewedRail,
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
  dealsHref?: string;
  followCopy?: string;
  followEyebrow?: string;
  followTitle?: string;
  offerList?: readonly CatalogSetDetailOfferItem[];
  offerSummaryLabel?: string;
  ownershipActions?: ReactNode;
  priceAlertAction?: ReactNode;
  priceHistoryPanel?: ReactNode;
  recentlyViewedRail?: ReactNode;
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
      dealsHref={dealsHref}
      followCopy={followCopy}
      followEyebrow={followEyebrow}
      followTitle={followTitle}
      offerList={[...offerList]}
      offerSummaryLabel={offerSummaryLabel}
      ownershipActions={ownershipActions}
      priceAlertAction={priceAlertAction}
      priceHistoryPanel={priceHistoryPanel}
      recentlyViewedRail={recentlyViewedRail}
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
