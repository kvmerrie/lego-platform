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
  buildBrickhuntValueItems,
  buildSetDecisionSupportItems,
  getPricePanelSnapshot,
  getSetDealVerdict,
} from '@lego-platform/pricing/data-access';
import {
  formatPriceMinor,
  type PricePanelSnapshot,
} from '@lego-platform/pricing/util';
import { PricingFeaturePriceHistory } from '@lego-platform/pricing/feature-price-history';
import { ShellWeb } from '@lego-platform/shell/web';
import {
  buildThemePath,
  buildWebPath,
  getDefaultFormattingLocale,
  webPathnames,
} from '@lego-platform/shared/config';
import { getBrickhuntAnalyticsPriceVerdict } from '@lego-platform/shared/util';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import { notFound } from 'next/navigation';

export const dynamicParams = false;

function isEuroCatalogOffer(catalogOffer: CatalogOffer): boolean {
  return catalogOffer.currency === 'EUR';
}

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

function formatOfferCheckedAtCompact(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
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

function buildMerchantCoverageLabel(
  merchantCount?: number,
): string | undefined {
  if (typeof merchantCount !== 'number' || merchantCount <= 0) {
    return undefined;
  }

  return `${merchantCount} winkel${merchantCount === 1 ? '' : 's'} nagekeken`;
}

function buildOfferSummaryLabel({
  merchantCount,
  observedAt,
}: {
  merchantCount?: number;
  observedAt?: string;
}): string | undefined {
  const parts = [
    buildMerchantCoverageLabel(merchantCount),
    observedAt
      ? `Nagekeken ${formatOfferCheckedAtCompact(observedAt)}`
      : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function buildDecisionHelper(pricePanelSnapshot?: PricePanelSnapshot): string {
  if (
    !pricePanelSnapshot ||
    typeof pricePanelSnapshot.deltaMinor !== 'number'
  ) {
    return 'We volgen nog te weinig prijzen om dit moment scherp te duiden.';
  }

  if (pricePanelSnapshot.deltaMinor < 0) {
    return `${formatPriceMinor({
      currencyCode: pricePanelSnapshot.currencyCode,
      minorUnits: Math.abs(pricePanelSnapshot.deltaMinor),
    })} onder wat we meestal zien voor deze set.`;
  }

  if (pricePanelSnapshot.deltaMinor > 0) {
    return `${formatPriceMinor({
      currencyCode: pricePanelSnapshot.currencyCode,
      minorUnits: pricePanelSnapshot.deltaMinor,
    })} boven wat we meestal zien voor deze set.`;
  }

  return 'Rond het normale prijsniveau voor deze set.';
}

function buildBestOfferRankingLabel({
  availability,
  merchantCount,
}: {
  availability: CatalogOffer['availability'];
  merchantCount?: number;
}): string {
  if (typeof merchantCount === 'number' && merchantCount <= 1) {
    return availability === 'in_stock'
      ? 'Enige nagekeken prijs die nu op voorraad is.'
      : 'Enige nagekeken prijs op dit moment.';
  }

  if (availability === 'in_stock') {
    return 'Laagste nagekeken prijs die nu op voorraad is.';
  }

  if (availability === 'unknown') {
    return 'Laagste nagekeken prijs, maar voorraad is niet zeker.';
  }

  return 'Laagste nagekeken prijs, maar nu uitverkocht.';
}

function buildOfferRankingLabel({
  bestOffer,
  catalogOffer,
}: {
  bestOffer?: CatalogOffer | null;
  catalogOffer: CatalogOffer;
}): string | undefined {
  if (!bestOffer) {
    return undefined;
  }

  if (bestOffer.url === catalogOffer.url) {
    return bestOffer.availability === 'in_stock'
      ? 'Laagste prijs op voorraad'
      : 'Laagste nagekeken prijs';
  }

  const priceDeltaMinor = catalogOffer.priceCents - bestOffer.priceCents;

  if (priceDeltaMinor < 0) {
    const lowerPriceLabel = formatPriceMinor({
      currencyCode: catalogOffer.currency,
      minorUnits: Math.abs(priceDeltaMinor),
    });

    if (catalogOffer.availability === 'out_of_stock') {
      return `${lowerPriceLabel} lager, maar uitverkocht`;
    }

    if (catalogOffer.availability === 'unknown') {
      return `${lowerPriceLabel} lager, maar voorraad onbekend`;
    }

    return `${lowerPriceLabel} lager, maar niet de beste keuze nu`;
  }

  if (priceDeltaMinor === 0) {
    return 'Zelfde prijs als de beste optie';
  }

  return `${formatPriceMinor({
    currencyCode: catalogOffer.currency,
    minorUnits: priceDeltaMinor,
  })} hoger dan de beste optie`;
}

function buildBestDeal({
  catalogOffer,
  dealVerdict,
  merchantCount,
  setId,
  pricePanelSnapshot,
  theme,
}: {
  catalogOffer?: CatalogOffer | null;
  dealVerdict: {
    label: string;
    tone?: 'info' | 'neutral' | 'positive' | 'warning';
  };
  merchantCount?: number;
  setId: string;
  pricePanelSnapshot?: PricePanelSnapshot;
  theme: string;
}): CatalogSetDetailBestDeal | undefined {
  if (!catalogOffer) {
    return undefined;
  }

  return {
    checkedLabel: `Nagekeken ${formatOfferCheckedAtCompact(catalogOffer.checkedAt)}`,
    ctaHref: catalogOffer.url,
    ctaLabel:
      dealVerdict.tone === 'warning'
        ? `Bekijk prijs bij ${catalogOffer.merchantName}`
        : `Bekijk bij ${catalogOffer.merchantName}`,
    ctaTone: dealVerdict.tone === 'positive' ? 'accent' : 'secondary',
    coverageLabel: buildMerchantCoverageLabel(merchantCount),
    decisionHelper: buildDecisionHelper(pricePanelSnapshot),
    decisionLabel: dealVerdict.label,
    decisionTone: dealVerdict.tone,
    merchantLabel: catalogOffer.merchantName,
    price: formatOfferPrice(catalogOffer),
    rankingLabel: buildBestOfferRankingLabel({
      availability: catalogOffer.availability,
      merchantCount,
    }),
    stockLabel: getOfferStockLabel(catalogOffer.availability),
    trackingEvent: {
      event: 'offer_click',
      properties: {
        merchantCount,
        merchantName: catalogOffer.merchantName,
        offerPlacement: 'best_offer',
        offerRole: 'best',
        pageSurface: 'set_detail',
        priceVerdict: getBrickhuntAnalyticsPriceVerdict(dealVerdict.tone),
        rankPosition: 1,
        setId,
        theme,
      },
    },
  };
}

function buildOfferList(
  catalogOffers: readonly CatalogOffer[],
  {
    dealVerdict,
    merchantCount,
    setId,
    theme,
  }: {
    dealVerdict: {
      tone?: 'info' | 'neutral' | 'positive' | 'warning';
    };
    merchantCount?: number;
    setId: string;
    theme: string;
  },
  bestOffer?: CatalogOffer | null,
): CatalogSetDetailOfferItem[] {
  return sortCatalogOffers(catalogOffers)
    .slice(0, 3)
    .map((catalogOffer, index) => ({
      checkedLabel: `Nagekeken ${formatOfferCheckedAtCompact(catalogOffer.checkedAt)}`,
      ctaHref: catalogOffer.url,
      ctaLabel: `Bekijk bij ${catalogOffer.merchantName}`,
      isBest: bestOffer?.url === catalogOffer.url,
      merchantLabel: catalogOffer.merchantName,
      price: formatOfferPrice(catalogOffer),
      rankingLabel: buildOfferRankingLabel({
        bestOffer,
        catalogOffer,
      }),
      stockLabel: getOfferStockLabel(catalogOffer.availability),
      trackingEvent: {
        event: 'offer_click',
        properties: {
          merchantCount,
          merchantName: catalogOffer.merchantName,
          offerPlacement: 'comparison_row',
          offerRole:
            bestOffer?.url === catalogOffer.url ? 'best' : 'alternative',
          pageSurface: 'set_detail',
          priceVerdict: getBrickhuntAnalyticsPriceVerdict(dealVerdict.tone),
          rankPosition: index + 1,
          setId,
          theme,
        },
      },
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
            label: 'Winkels nagekeken',
            value: `${merchantCount} winkel${merchantCount === 1 ? '' : 's'} nagekeken`,
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
  const localizedSetDetailOffers = setDetailOffers.filter(isEuroCatalogOffer);
  const bestOffer = getBestOffer(localizedSetDetailOffers);
  const pricePanelSnapshot = getPricePanelSnapshot(catalogSetDetail.id);
  const dealVerdict = getSetDealVerdict(catalogSetDetail.id);
  const trackedMerchantCount =
    pricePanelSnapshot?.merchantCount ?? localizedSetDetailOffers.length;

  return (
    <ShellWeb>
      <CatalogFeatureSetDetail
        bestDeal={buildBestDeal({
          catalogOffer: bestOffer,
          dealVerdict,
          merchantCount:
            trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
          setId: catalogSetDetail.id,
          pricePanelSnapshot,
          theme: catalogSetDetail.theme,
        })}
        brickhuntValueItems={buildBrickhuntValueItems({
          merchantCount:
            trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
        })}
        catalogSetDetail={catalogSetDetail}
        dealSupportItems={buildSetDecisionSupportItems({
          hasCurrentOffer: Boolean(bestOffer),
          merchantCount:
            trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
          pricePanelSnapshot,
        })}
        dealVerdict={dealVerdict}
        offerList={buildOfferList(
          localizedSetDetailOffers,
          {
            dealVerdict,
            merchantCount:
              trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
            setId: catalogSetDetail.id,
            theme: catalogSetDetail.theme,
          },
          bestOffer,
        )}
        offerSummaryLabel={buildOfferSummaryLabel({
          merchantCount:
            trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
          observedAt: pricePanelSnapshot?.observedAt ?? bestOffer?.checkedAt,
        })}
        ownershipActions={
          <>
            <CollectionFeatureOwnedToggle
              setId={catalogSetDetail.id}
              variant="compact"
            />
          </>
        }
        priceAlertAction={
          <WishlistFeatureWishlistToggle
            analyticsContext={{
              merchantCount:
                trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
              pageSurface: 'set_detail',
              priceVerdict: getBrickhuntAnalyticsPriceVerdict(dealVerdict.tone),
              setId: catalogSetDetail.id,
              theme: catalogSetDetail.theme,
            }}
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
