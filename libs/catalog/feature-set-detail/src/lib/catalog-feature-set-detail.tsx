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

export function CatalogFeatureSetDetail({
  bestDeal,
  brickhuntValueItems = [],
  catalogSetDetail,
  dealSupportItems = [],
  dealVerdict,
  offerList = [],
  offerSummaryLabel,
  ownershipActions,
  priceAlertAction,
  priceHistoryPanel,
  themeDirectoryHref,
  themeHref,
  trustSignals = [],
}: {
  bestDeal?: CatalogSetDetailBestDeal;
  brickhuntValueItems?: readonly CatalogSetDetailSupportItem[];
  catalogSetDetail: CatalogSetDetail;
  dealSupportItems?: readonly CatalogSetDetailSupportItem[];
  dealVerdict: CatalogSetDetailVerdict;
  offerList?: readonly CatalogSetDetailOfferItem[];
  offerSummaryLabel?: string;
  ownershipActions?: ReactNode;
  priceAlertAction?: ReactNode;
  priceHistoryPanel?: ReactNode;
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
      offerList={[...offerList]}
      offerSummaryLabel={offerSummaryLabel}
      ownershipActions={ownershipActions}
      priceAlertAction={priceAlertAction}
      priceHistoryPanel={priceHistoryPanel}
      themeDirectoryHref={themeDirectoryHref}
      themeHref={themeHref}
      trustSignals={[...trustSignals]}
    />
  );
}

export default CatalogFeatureSetDetail;
