import type { ReactNode } from 'react';
import { CatalogSetDetailPanel } from '@lego-platform/catalog/ui';
import { CatalogSetDetail } from '@lego-platform/catalog/util';

export function CatalogFeatureSetDetail({
  catalogSetDetail,
  productSummary,
  supportingPanel,
  themeDirectoryHref,
  themeHref,
}: {
  catalogSetDetail: CatalogSetDetail;
  productSummary?: ReactNode;
  supportingPanel?: ReactNode;
  themeDirectoryHref?: string;
  themeHref?: string;
}) {
  return (
    <CatalogSetDetailPanel
      catalogSetDetail={catalogSetDetail}
      productSummary={productSummary}
      supportingPanel={supportingPanel}
      themeDirectoryHref={themeDirectoryHref}
      themeHref={themeHref}
    />
  );
}

export default CatalogFeatureSetDetail;
