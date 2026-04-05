import { listAffiliateOffers } from '@lego-platform/affiliate/data-access';
import {
  type CatalogOffer,
  getBestOffer,
  sortCatalogOffers,
  toCatalogOffers,
} from '@lego-platform/affiliate/util';
import {
  getCatalogOffersBySetId,
  getCatalogSetBySlug,
  listCatalogSetSlugs,
} from '@lego-platform/catalog/data-access';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import type {
  CatalogSetDetailBestDeal,
  CatalogSetDetailOfferItem,
  CatalogSetDetailTrustSignal,
} from '@lego-platform/catalog/ui';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import { CollectionFeatureOwnedToggle } from '@lego-platform/collection/feature-owned-toggle';
import {
  getPricePanelSnapshot,
  getSetDealVerdict,
} from '@lego-platform/pricing/data-access';
import { PricingFeaturePriceHistory } from '@lego-platform/pricing/feature-price-history';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildThemePath,
  buildWebPath,
  getDefaultFormattingLocale,
  webPathnames,
} from '@lego-platform/shared/config';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { notFound } from 'next/navigation';

export const dynamicParams = false;

function formatOfferPrice(catalogOffer: CatalogOffer): string {
  return new Intl.NumberFormat(getDefaultFormattingLocale(), {
    style: 'currency',
    currency: catalogOffer.currency,
  }).format(catalogOffer.priceCents / 100);
}

function formatOfferCheckedAt(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(checkedAt));
}

function getOfferStockLabel(
  availability: CatalogOffer['availability'],
): string {
  if (availability === 'in_stock') {
    return 'Op voorraad';
  }

  if (availability === 'out_of_stock') {
    return 'Uitverkocht';
  }

  return 'Voorraad onbekend';
}

function buildBestDeal(
  catalogOffer?: CatalogOffer | null,
): CatalogSetDetailBestDeal | undefined {
  if (!catalogOffer) {
    return undefined;
  }

  const offerPrice = formatOfferPrice(catalogOffer);
  const inStock = catalogOffer.availability === 'in_stock';

  return {
    checkedLabel: `Nagekeken op ${formatOfferCheckedAt(catalogOffer.checkedAt)}`,
    ctaHref: catalogOffer.url,
    ctaLabel: inStock
      ? `Koop voor ${offerPrice} bij ${catalogOffer.merchantName}`
      : 'Bekijk beste deal',
    merchantLabel: `Nu het scherpst bij ${catalogOffer.merchantName}`,
    price: offerPrice,
    stockLabel: getOfferStockLabel(catalogOffer.availability),
  };
}

function buildOfferList(
  catalogOffers: readonly CatalogOffer[],
  bestOffer?: CatalogOffer | null,
): CatalogSetDetailOfferItem[] {
  return sortCatalogOffers(catalogOffers)
    .slice(0, 3)
    .map((catalogOffer) => ({
      checkedLabel: `Nagekeken op ${formatOfferCheckedAt(catalogOffer.checkedAt)}`,
      ctaHref: catalogOffer.url,
      ctaLabel: 'Bekijk deal',
      isBest: bestOffer?.url === catalogOffer.url,
      merchantLabel: catalogOffer.merchantName,
      price: formatOfferPrice(catalogOffer),
      stockLabel: getOfferStockLabel(catalogOffer.availability),
    }));
}

function buildTrustSignals({
  bestOffer,
  merchantCount,
  observedAt,
}: {
  bestOffer?: CatalogOffer | null;
  merchantCount?: number;
  observedAt?: string;
}): CatalogSetDetailTrustSignal[] {
  return [
    ...(bestOffer || observedAt
      ? [
          {
            label: 'Laatst nagekeken',
            value: formatOfferCheckedAt(
              bestOffer?.checkedAt ?? observedAt ?? '',
            ),
          },
        ]
      : []),
    ...(typeof merchantCount === 'number'
      ? [
          {
            label: 'Winkels gevolgd',
            value: `${merchantCount} nagekeken`,
          },
        ]
      : []),
  ];
}

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
  const bestOffer = getBestOffer(setDetailOffers);
  const pricePanelSnapshot = getPricePanelSnapshot(catalogSetDetail.id);

  return (
    <ShellWeb>
      <CatalogFeatureSetDetail
        bestDeal={buildBestDeal(bestOffer)}
        catalogSetDetail={catalogSetDetail}
        dealVerdict={getSetDealVerdict(catalogSetDetail.id)}
        offerList={buildOfferList(setDetailOffers, bestOffer)}
        ownershipActions={
          <>
            <CollectionFeatureOwnedToggle
              setId={catalogSetDetail.id}
              variant="product"
            />
          </>
        }
        priceAlertAction={
          <WishlistFeatureWishlistToggle
            productIntent="price-alert"
            setId={catalogSetDetail.id}
            variant="product"
          />
        }
        priceHistoryPanel={
          <PricingFeaturePriceHistory
            setId={catalogSetDetail.id}
            variant="set-detail"
          />
        }
        themeDirectoryHref={buildWebPath(webPathnames.themes)}
        themeHref={buildThemePath(
          buildCatalogThemeSlug(catalogSetDetail.theme),
        )}
        trustSignals={buildTrustSignals({
          bestOffer,
          merchantCount: pricePanelSnapshot?.merchantCount,
          observedAt: pricePanelSnapshot?.observedAt,
        })}
      />
    </ShellWeb>
  );
}
