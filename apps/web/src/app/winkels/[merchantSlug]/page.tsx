import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import React from 'react';
import {
  getMerchantDeals,
  type CommerceMerchantDeal,
  type CommerceMerchantDealsResult,
} from '@lego-platform/catalog/data-access-web';
import { buildCatalogMerchantPresentation } from '@lego-platform/catalog/util';
import {
  CatalogSectionShell,
  CatalogSetCard,
  CatalogSetCardCollection,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import {
  buildCommerceMerchantPath,
  buildCanonicalUrl,
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import styles from '../merchant-pages.module.css';

export const revalidate = false;

const merchantsPath = buildWebPath(webPathnames.merchants);

function normalizeRequestedMerchantSlug(value: string): string {
  return value.trim().toLocaleLowerCase('nl-NL');
}

function formatMerchantPrice({
  currencyCode,
  minorUnits,
}: {
  currencyCode: string;
  minorUnits: number;
}): string {
  return formatPriceMinor({
    currencyCode,
    minorUnits,
  });
}

function formatSavingsPercentage(value?: number): string {
  return typeof value === 'number' ? `${Math.round(value)}%` : 'n.b.';
}

function formatCheckedAt(value?: string): string {
  if (!value) {
    return 'Laatst bijgewerkt';
  }

  return `Nagekeken ${new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))}`;
}

function getDealSavingsLabel(deal: CommerceMerchantDeal): string | undefined {
  if (
    typeof deal.savingsMinor !== 'number' ||
    deal.savingsMinor <= 0 ||
    !deal.nextBestMerchant ||
    typeof deal.savingsPercentage !== 'number' ||
    deal.savingsPercentage <= 0
  ) {
    return undefined;
  }

  return `${formatMerchantPrice({
    currencyCode: deal.currencyCode,
    minorUnits: deal.savingsMinor,
  })} goedkoper dan ${deal.nextBestMerchant.name}`;
}

function toMerchantDealPriceContext({
  deal,
  rankPosition,
  sectionId,
}: {
  deal: CommerceMerchantDeal;
  rankPosition: number;
  sectionId: string;
}): CatalogSetCardPriceContext {
  const savingsLabel = getDealSavingsLabel(deal);
  const merchantPresentation = buildCatalogMerchantPresentation({
    claim:
      typeof deal.nextBestPriceMinor === 'number'
        ? 'lowest-current'
        : 'only-found',
    merchantName: deal.merchant.name,
    merchantSlug: deal.merchant.slug,
  });

  return {
    coverageLabel:
      typeof deal.nextBestPriceMinor === 'number'
        ? `${deal.comparedMerchantCount} winkels vergeleken`
        : 'Alleen bij deze winkel',
    currentPrice: formatMerchantPrice({
      currencyCode: deal.currencyCode,
      minorUnits: deal.priceMinor,
    }),
    ...(savingsLabel ? { discountMetric: savingsLabel } : {}),
    ...(typeof deal.savingsPercentage === 'number'
      ? { dealReason: `${Math.round(deal.savingsPercentage)}% lager` }
      : {}),
    decisionLabel: savingsLabel ? 'Beste winkelprijs' : 'Alleen hier gevonden',
    merchantLabel: merchantPresentation.label,
    primaryActionHref: deal.productUrl,
    primaryActionTrackingEvent: {
      event: 'offer_click',
      properties: {
        merchantCount: deal.comparedMerchantCount,
        merchantName: deal.merchant.name,
        merchantSlug: deal.merchant.slug,
        offerPlacement: 'merchant_card_primary_cta',
        offerRole: 'best',
        pageSurface: 'merchant',
        rankPosition,
        sectionId,
        setId: deal.set.id,
        theme: deal.set.theme,
      },
    },
    reviewedLabel: formatCheckedAt(deal.checkedAt),
  };
}

function MerchantDealGrid({
  deals,
  sectionId,
}: {
  deals: readonly CommerceMerchantDeal[];
  sectionId: string;
}) {
  return (
    <CatalogSetCardCollection
      className={styles.grid}
      gridMode="browse"
      variant="compact"
    >
      {deals.map((deal, index) => (
        <CatalogSetCard
          actions={
            <WishlistFeatureWishlistToggle
              analyticsContext={{
                merchantName: deal.merchant.name,
                merchantSlug: deal.merchant.slug,
                pageSurface: 'merchant',
                rankPosition: index + 1,
                sectionId,
                setId: deal.set.id,
                theme: deal.set.theme,
              }}
              productIntent="price-alert"
              setId={deal.set.id}
              variant="inline"
            />
          }
          ctaMode="commerce"
          href={buildSetDetailPath(deal.set.slug)}
          imageLoading={index < 6 ? 'eager' : 'lazy'}
          key={`${deal.offerSeedId}-${deal.set.id}`}
          priceContext={toMerchantDealPriceContext({
            deal,
            rankPosition: index + 1,
            sectionId,
          })}
          setSummary={deal.set}
          trackingEvent={{
            event: 'catalog_set_click',
            properties: {
              merchantName: deal.merchant.name,
              merchantSlug: deal.merchant.slug,
              pageSurface: 'merchant',
              rankPosition: index + 1,
              sectionId,
              setId: deal.set.id,
              theme: deal.set.theme,
            },
          }}
          variant="featured"
        />
      ))}
    </CatalogSetCardCollection>
  );
}

function getBestSavingsDeal(
  merchantDeals: CommerceMerchantDealsResult,
): CommerceMerchantDeal | undefined {
  return merchantDeals.comparableDeals.find(
    (deal) => typeof deal.savingsMinor === 'number',
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ merchantSlug: string }>;
}): Promise<Metadata> {
  const { merchantSlug } = await params;
  const merchantDeals = await getMerchantDeals(merchantSlug);

  if (!merchantDeals) {
    return {};
  }

  const title = `LEGO aanbiedingen bij ${merchantDeals.merchant.name} | Brickhunt`;
  const canonicalUrl =
    merchantDeals.merchant.seoPresentation.canonicalUrl ??
    buildCanonicalUrl(
      buildCommerceMerchantPath(
        merchantDeals.merchant.slug,
        merchantDeals.merchant.seoPresentation,
      ),
    );
  const seoTitle = merchantDeals.merchant.seoPresentation.seoTitle ?? title;
  const seoDescription = merchantDeals.merchant.seoPresentation.seoDescription;

  return {
    title: seoTitle,
    ...(seoDescription ? { description: seoDescription } : {}),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: seoTitle,
      ...(seoDescription ? { description: seoDescription } : {}),
      type: 'website',
      url: canonicalUrl,
    },
  };
}

export default async function MerchantDealsPage({
  params,
}: {
  params: Promise<{ merchantSlug: string }>;
}) {
  const { merchantSlug } = await params;
  const merchantDeals = await getMerchantDeals(merchantSlug);

  if (!merchantDeals) {
    return notFound();
  }

  const canonicalMerchantPath = buildCommerceMerchantPath(
    merchantDeals.merchant.slug,
    merchantDeals.merchant.seoPresentation,
  );

  if (
    normalizeRequestedMerchantSlug(merchantSlug) !==
    merchantDeals.merchant.publicSlug
  ) {
    permanentRedirect(canonicalMerchantPath);
  }

  const bestSavingsDeal = getBestSavingsDeal(merchantDeals);
  const totalDealCount = merchantDeals.dealCount;
  const heroDescription =
    merchantDeals.merchant.seoPresentation.shortDescription ??
    `De sets waar ${merchantDeals.merchant.name} nu de laagste actuele prijs heeft. Klik door naar de set als je eerst details wilt zien.`;

  return (
    <ShellWeb>
      <main className={styles.page}>
        <a className={styles.backLink} href={merchantsPath}>
          Terug naar winkels
        </a>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Winkel</p>
            <h1 className={styles.heroTitle}>
              LEGO aanbiedingen bij {merchantDeals.merchant.name}
            </h1>
            <p className={styles.heroDescription}>{heroDescription}</p>
          </div>
          <dl className={styles.stats} aria-label="Merchant dealstatistieken">
            <div className={styles.stat}>
              <dt>Laagste prijs</dt>
              <dd>{totalDealCount}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Beste besparing</dt>
              <dd>
                {bestSavingsDeal
                  ? formatMerchantPrice({
                      currencyCode: bestSavingsDeal.currencyCode,
                      minorUnits: bestSavingsDeal.savingsMinor ?? 0,
                    })
                  : 'n.b.'}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Verschil</dt>
              <dd>
                {formatSavingsPercentage(bestSavingsDeal?.savingsPercentage)}
              </dd>
            </div>
          </dl>
        </section>

        <CatalogSectionShell
          as="section"
          bodySpacing="relaxed"
          padding="default"
          spacing="relaxed"
          title={`Beste deals bij ${merchantDeals.merchant.name}`}
          titleAs="h2"
          tone="default"
        >
          {merchantDeals.comparableDeals.length ? (
            <MerchantDealGrid
              deals={merchantDeals.comparableDeals}
              sectionId="merchant-best-deals"
            />
          ) : merchantDeals.snapshotMissing ? (
            <p className={styles.emptyState}>
              We bouwen de snelle winkellijst nog op. Kijk straks terug voor de
              sets waar {merchantDeals.merchant.name} echt de laagste prijs
              heeft.
            </p>
          ) : (
            <p className={styles.emptyState}>
              Deze winkel is nu niet goedkoper dan een volgende winkel voor de
              sets die we kunnen vergelijken.
            </p>
          )}
        </CatalogSectionShell>

        {merchantDeals.onlyAtMerchantDeals.length ? (
          <CatalogSectionShell
            as="section"
            bodySpacing="relaxed"
            padding="default"
            spacing="relaxed"
            title="Alleen bij deze winkel"
            titleAs="h2"
            tone="default"
          >
            <MerchantDealGrid
              deals={merchantDeals.onlyAtMerchantDeals}
              sectionId="merchant-only-here"
            />
          </CatalogSectionShell>
        ) : null}
      </main>
    </ShellWeb>
  );
}
