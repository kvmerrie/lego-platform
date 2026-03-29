import { AffiliateFeatureOffers } from '@lego-platform/affiliate/feature-offers';
import {
  getCatalogSetBySlug,
  listCatalogSetSlugs,
} from '@lego-platform/catalog/data-access';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import { CollectionFeatureOwnedToggle } from '@lego-platform/collection/feature-owned-toggle';
import { PricingFeaturePriceHistory } from '@lego-platform/pricing/feature-price-history';
import { PricingFeaturePricePanel } from '@lego-platform/pricing/feature-price-panel';
import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuth } from '@lego-platform/user/feature-auth';
import { UserFeatureProfile } from '@lego-platform/user/feature-profile';
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

  return (
    <ShellWeb>
      <CatalogFeatureSetDetail catalogSetDetail={catalogSetDetail} />
      <section
        aria-label="Set buying guidance"
        className={styles.commercePanels}
      >
        <PricingFeaturePricePanel setId={catalogSetDetail.id} />
        <PricingFeaturePriceHistory setId={catalogSetDetail.id} />
        <AffiliateFeatureOffers setId={catalogSetDetail.id} />
      </section>
      <section aria-label="Collector account" className={styles.accountPanels}>
        <UserFeatureAuth />
        <UserFeatureProfile />
      </section>
      <section
        aria-label="Collector actions"
        className={styles.collectorActions}
      >
        <CollectionFeatureOwnedToggle setId={catalogSetDetail.id} />
        <WishlistFeatureWishlistToggle setId={catalogSetDetail.id} />
      </section>
    </ShellWeb>
  );
}
