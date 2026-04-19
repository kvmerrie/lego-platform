import {
  getBestOffer,
  sortCatalogOffers,
  type CatalogOffer,
} from '@lego-platform/affiliate/util';
import {
  getCatalogSetBySlug,
  listCatalogSetLiveOffersBySetId,
  listCatalogSetSlugs,
} from '@lego-platform/catalog/data-access-web';
import { CatalogFeatureSetDetail } from '@lego-platform/catalog/feature-set-detail';
import type {
  CatalogSetDetailBestDeal,
  CatalogSetDetailOfferItem,
  CatalogSetDetailTrustSignal,
} from '@lego-platform/catalog/ui';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import { CollectionFeatureOwnedToggle } from '@lego-platform/collection/feature-owned-toggle';
import {
  buildSetDecisionPresentation,
  buildBrickhuntValueItems,
  buildSetDecisionSupportItems,
  buildSetDealVerdict,
  getPricePanelSnapshot,
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

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

const BRICKHUNT_TIME_ZONE = 'Europe/Amsterdam';

function getCalendarDayValue(date: Date): number {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BRICKHUNT_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);

  const day = Number(
    dateParts.find((part) => part.type === 'day')?.value ?? '0',
  );
  const month = Number(
    dateParts.find((part) => part.type === 'month')?.value ?? '0',
  );
  const year = Number(
    dateParts.find((part) => part.type === 'year')?.value ?? '0',
  );

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatOfferCheckedTime(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BRICKHUNT_TIME_ZONE,
  }).format(new Date(checkedAt));
}

function formatOfferCheckedDate(checkedAt: string): string {
  return new Intl.DateTimeFormat(getDefaultFormattingLocale(), {
    day: 'numeric',
    month: 'short',
    timeZone: BRICKHUNT_TIME_ZONE,
  }).format(new Date(checkedAt));
}

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
  return formatOfferCheckedAtCompact(checkedAt);
}

function formatOfferCheckedAtCompact(checkedAt: string): string {
  const checkedDate = new Date(checkedAt);

  if (Number.isNaN(checkedDate.getTime())) {
    return '';
  }

  const dayDifference =
    getCalendarDayValue(new Date()) - getCalendarDayValue(checkedDate);
  const timeLabel = formatOfferCheckedTime(checkedAt);

  if (dayDifference === 0) {
    return `Vandaag om ${timeLabel}`;
  }

  if (dayDifference === 1) {
    return `Gisteren om ${timeLabel}`;
  }

  if (dayDifference === 2) {
    return `Eergisteren om ${timeLabel}`;
  }

  return `${formatOfferCheckedDate(checkedAt)} om ${timeLabel}`;
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
    observedAt ? formatOfferCheckedAtCompact(observedAt) : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : undefined;
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
      ? 'Enige nagekeken prijs op voorraad.'
      : 'Enige nagekeken prijs nu.';
  }

  if (availability === 'in_stock') {
    return 'Laagste nagekeken prijs op voorraad.';
  }

  if (availability === 'unknown') {
    return 'Laagste nagekeken prijs, voorraad nog onzeker.';
  }

  return 'Laagste nagekeken prijs, nu uitverkocht.';
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
  decisionPresentation,
  dealVerdict,
  merchantCount,
  setId,
  pricePanelSnapshot,
  theme,
}: {
  catalogOffer?: CatalogOffer | null;
  decisionPresentation: ReturnType<typeof buildSetDecisionPresentation>;
  dealVerdict: ReturnType<typeof buildSetDealVerdict>;
  merchantCount?: number;
  setId: string;
  pricePanelSnapshot?: PricePanelSnapshot;
  theme: string;
}): CatalogSetDetailBestDeal | undefined {
  if (!catalogOffer && !pricePanelSnapshot) {
    return undefined;
  }

  if (!catalogOffer && pricePanelSnapshot) {
    const coverageLabel = buildMerchantCoverageLabel(merchantCount);

    return {
      checkedLabel: formatOfferCheckedAtCompact(pricePanelSnapshot.observedAt),
      coverageLabel,
      decisionHelper: decisionPresentation.noOfferCopy,
      decisionLabel: dealVerdict.label,
      decisionTone: dealVerdict.tone,
      eyebrow: 'Prijsbeeld nu',
      merchantLabel: decisionPresentation.noOfferTitle,
      price: formatPriceMinor({
        currencyCode: pricePanelSnapshot.currencyCode,
        minorUnits: pricePanelSnapshot.headlinePriceMinor,
      }),
      rankingLabel:
        [pricePanelSnapshot.lowestAvailabilityLabel, coverageLabel]
          .filter(Boolean)
          .join(' · ') || undefined,
      stockLabel:
        pricePanelSnapshot.lowestAvailabilityLabel ?? 'Prijs wordt gevolgd',
    };
  }

  if (!catalogOffer) {
    return undefined;
  }

  return {
    affiliateNote:
      'Als je via Brickhunt doorklikt, kunnen wij een kleine commissie ontvangen.',
    checkedLabel: formatOfferCheckedAtCompact(catalogOffer.checkedAt),
    ctaHref: catalogOffer.url,
    ctaLabel: `Bekijk bij ${catalogOffer.merchantName}`,
    ctaTone: dealVerdict.tone === 'positive' ? 'accent' : 'secondary',
    coverageLabel: buildMerchantCoverageLabel(merchantCount),
    decisionHelper: dealVerdict.explanation,
    decisionLabel: dealVerdict.label,
    decisionTone: dealVerdict.tone,
    eyebrow: 'Beste deal nu',
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
  return sortCatalogOffers(catalogOffers).map((catalogOffer, index) => ({
    checkedLabel: formatOfferCheckedAtCompact(catalogOffer.checkedAt),
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
        offerRole: bestOffer?.url === catalogOffer.url ? 'best' : 'alternative',
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

export async function generateStaticParams() {
  return (await listCatalogSetSlugs()).map((slug) => ({ slug }));
}

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalogSetDetail = await getCatalogSetBySlug({
    slug,
  });

  if (!catalogSetDetail) {
    notFound();
  }

  const liveSetDetailOffers = await listCatalogSetLiveOffersBySetId({
    setId: catalogSetDetail.id,
  });
  // Only live validated offers count as current public pricing.
  const localizedSetDetailOffers =
    liveSetDetailOffers.filter(isEuroCatalogOffer);
  const bestOffer = getBestOffer(localizedSetDetailOffers);
  const pricePanelSnapshot = getPricePanelSnapshot(catalogSetDetail.id);
  const hasLiveCurrentOffer = Boolean(bestOffer);
  const decisionPresentation = buildSetDecisionPresentation({
    hasCurrentOffer: hasLiveCurrentOffer,
    pricePanelSnapshot,
    theme: catalogSetDetail.theme,
  });
  const dealVerdict = buildSetDealVerdict(pricePanelSnapshot, {
    hasCurrentOffer: hasLiveCurrentOffer,
    theme: catalogSetDetail.theme,
  });
  const trackedMerchantCount = localizedSetDetailOffers.length;

  return (
    <ShellWeb>
      <CatalogFeatureSetDetail
        bestDeal={buildBestDeal({
          catalogOffer: bestOffer,
          decisionPresentation,
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
          hasCurrentOffer: hasLiveCurrentOffer,
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
          observedAt: bestOffer?.checkedAt ?? pricePanelSnapshot?.observedAt,
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
            hasCurrentOffer={hasLiveCurrentOffer}
            merchantCount={
              trackedMerchantCount > 0 ? trackedMerchantCount : undefined
            }
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
          merchantCount:
            trackedMerchantCount > 0 ? trackedMerchantCount : undefined,
          observedAt: bestOffer?.checkedAt ?? pricePanelSnapshot?.observedAt,
        })}
        followCopy={decisionPresentation.followCopy}
        followEyebrow={decisionPresentation.followEyebrow}
        followTitle={decisionPresentation.followTitle}
      />
    </ShellWeb>
  );
}
