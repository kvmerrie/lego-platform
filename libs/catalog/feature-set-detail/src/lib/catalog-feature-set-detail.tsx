import type { ReactNode } from 'react';
import { CatalogSetDetailPanel } from '@lego-platform/catalog/ui';
import { CatalogSetDetail } from '@lego-platform/catalog/util';

export function CatalogFeatureSetDetail({
  catalogSetDetail,
  productSummary,
  supportingPanel,
}: {
  catalogSetDetail: CatalogSetDetail;
  productSummary?: ReactNode;
  supportingPanel?: ReactNode;
}) {
  return (
    <CatalogSetDetailPanel
      catalogSetDetail={catalogSetDetail}
      homeHref="/#featured-sets"
      productSummary={productSummary}
      supportingPanel={supportingPanel}
    />
  );
}

export default CatalogFeatureSetDetail;
