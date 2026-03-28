import { CatalogSetDetailPanel } from '@lego-platform/catalog/ui';
import { CatalogSetDetail } from '@lego-platform/catalog/util';

export function CatalogFeatureSetDetail({
  catalogSetDetail,
}: {
  catalogSetDetail: CatalogSetDetail;
}) {
  return (
    <CatalogSetDetailPanel catalogSetDetail={catalogSetDetail} homeHref="/#featured-sets" />
  );
}

export default CatalogFeatureSetDetail;
