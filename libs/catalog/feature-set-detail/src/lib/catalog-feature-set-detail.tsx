import type { ReactNode } from 'react';
import {
  CatalogSetDetailPanel,
  type CatalogSetDetailBestDeal,
  type CatalogSetDetailOfferItem,
  type CatalogSetDetailTrustSignal,
  type CatalogSetDetailVerdict,
} from '@lego-platform/catalog/ui';
import { CatalogSetDetail } from '@lego-platform/catalog/util';

export function CatalogFeatureSetDetail({
  bestDeal,
  catalogSetDetail,
  dealVerdict,
  offerList = [],
  ownershipActions,
  priceAlertAction,
  priceHistoryPanel,
  themeDirectoryHref,
  themeHref,
  trustSignals = [],
}: {
  bestDeal?: CatalogSetDetailBestDeal;
  catalogSetDetail: CatalogSetDetail;
  dealVerdict: CatalogSetDetailVerdict;
  offerList?: readonly CatalogSetDetailOfferItem[];
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
      catalogSetDetail={catalogSetDetail}
      dealVerdict={dealVerdict}
      offerList={[...offerList]}
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
