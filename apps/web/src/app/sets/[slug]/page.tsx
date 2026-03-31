import {
  AffiliateFeatureOffers,
  AffiliateFeaturePrimaryOfferAction,
} from '@lego-platform/affiliate/feature-offers';
import { listAffiliateOffers } from '@lego-platform/affiliate/data-access';
import { toCatalogOffers } from '@lego-platform/affiliate/util';
import {
  getCatalogOffersBySetId,
  getCatalogSetBySlug,
  listCatalogSetSlugs,
} from '@lego-platform/catalog/data-access';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import {
  buildThemePath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import { CollectionFeatureOwnedToggle } from '@lego-platform/collection/feature-owned-toggle';
import { PricingFeaturePriceHistory } from '@lego-platform/pricing/feature-price-history';
import { PricingFeaturePricePanel } from '@lego-platform/pricing/feature-price-panel';
import { ShellWeb } from '@lego-platform/shell/web';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { notFound } from 'next/navigation';
import styles from './page.module.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return listCatalogSetSlugs().map((slug) => ({ slug }));
}

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalogSetDetail = getCatalogSetBySlug(slug);

  if (!catalogSetDetail) {
    notFound();
  }

  const reviewedAffiliateOffers = listAffiliateOffers(catalogSetDetail.id);
  const setDetailOffers =
    reviewedAffiliateOffers.length > 0
      ? toCatalogOffers(reviewedAffiliateOffers)
      : getCatalogOffersBySetId(catalogSetDetail.id);

  return (
    <ShellWeb>
      <CatalogFeatureSetDetail
        catalogSetDetail={catalogSetDetail}
        productSummary={
          <div className={styles.productSummaryStack}>
            <PricingFeaturePricePanel
              setId={catalogSetDetail.id}
              variant="product"
            />
            <AffiliateFeaturePrimaryOfferAction
              affiliateOffers={setDetailOffers}
            />
            <div className={styles.productActions}>
              <CollectionFeatureOwnedToggle
                setId={catalogSetDetail.id}
                variant="product"
              />
              <WishlistFeatureWishlistToggle
                setId={catalogSetDetail.id}
                variant="product"
              />
            </div>
          </div>
        }
        supportingPanel={
          <PricingFeaturePriceHistory setId={catalogSetDetail.id} />
        }
        themeDirectoryHref={buildWebPath(webPathnames.themes)}
        themeHref={buildThemePath(
          buildCatalogThemeSlug(catalogSetDetail.theme),
        )}
      />
      <AffiliateFeatureOffers affiliateOffers={setDetailOffers} />
    </ShellWeb>
  );
}
