import { getCatalogSetBySlug, listCatalogSetSlugs } from '@lego-platform/catalog/data-access';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import { CollectionFeatureOwnedToggle } from '@lego-platform/collection/feature-owned-toggle';
import { ShellWeb } from '@lego-platform/shell/web';
import { UserFeatureAuth } from '@lego-platform/user/feature-auth';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { notFound } from 'next/navigation';

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
      <UserFeatureAuth />
      <section className="surface-grid" aria-label="Collector actions">
        <CollectionFeatureOwnedToggle setId={catalogSetDetail.id} />
        <WishlistFeatureWishlistToggle setId={catalogSetDetail.id} />
      </section>
    </ShellWeb>
  );
}
