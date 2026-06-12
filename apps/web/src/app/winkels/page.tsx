import type { Metadata } from 'next';
import React from 'react';
import {
  getActiveCommerceMerchantsOverview,
  type CommerceMerchantOverviewItem,
} from '@lego-platform/catalog/data-access-web';
import { CatalogSectionShell } from '@lego-platform/catalog/ui';
import {
  buildCanonicalUrl,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';
import { formatPriceMinor } from '@lego-platform/pricing/util';
import styles from './merchant-pages.module.css';

export const revalidate = false;

const merchantsPath = buildWebPath(webPathnames.merchants);

export const metadata: Metadata = {
  title: 'LEGO winkels vergelijken | Brickhunt',
  alternates: {
    canonical: buildCanonicalUrl(merchantsPath),
  },
  openGraph: {
    title: 'LEGO winkels vergelijken | Brickhunt',
    type: 'website',
    url: buildCanonicalUrl(merchantsPath),
  },
};

function formatDealCount(value: number): string {
  return `${value} set${value === 1 ? '' : 's'} laagst`;
}

function formatSavings({
  currencyCode,
  savingsMinor,
}: {
  currencyCode?: string;
  savingsMinor?: number;
}): string {
  if (typeof savingsMinor !== 'number') {
    return 'Nog geen besparing';
  }

  return `${formatPriceMinor({
    currencyCode: currencyCode ?? 'EUR',
    minorUnits: savingsMinor,
  })} beste verschil`;
}

function MerchantOverviewCard({
  item,
}: {
  item: CommerceMerchantOverviewItem;
}) {
  const bestDeal = item.previewDeals.find(
    (deal) => typeof deal.savingsMinor === 'number',
  );
  const previewDealNames = item.previewDeals.map((deal) => deal.set.name);
  const merchantHref = `${merchantsPath}/${item.merchant.slug}`;

  return (
    <a className={styles.merchantCard} href={merchantHref}>
      <div className={styles.merchantCardHeader}>
        <div>
          <h2 className={styles.merchantName}>{item.merchant.name}</h2>
          <p className={styles.merchantMeta}>
            {formatSavings({
              currencyCode: bestDeal?.currencyCode,
              savingsMinor: item.bestSavingsMinor,
            })}
          </p>
        </div>
        <span className={styles.merchantBadge}>
          {formatDealCount(item.dealCount)}
        </span>
      </div>
      {previewDealNames.length ? (
        <ul className={styles.previewList} aria-label="Voorbeelden">
          {previewDealNames.map((dealName) => (
            <li key={dealName}>{dealName}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.supportCopy}>
          Nog geen set waar deze winkel de laagste actuele prijs heeft.
        </p>
      )}
    </a>
  );
}

export default async function MerchantsPage() {
  const merchantsOverview = await getActiveCommerceMerchantsOverview();
  const totalDealCount = merchantsOverview.reduce(
    (total, item) => total + item.dealCount,
    0,
  );
  const merchantWithDealCount = merchantsOverview.filter(
    (item) => item.dealCount > 0,
  ).length;

  return (
    <ShellWeb>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Winkels</p>
            <h1 className={styles.heroTitle}>LEGO winkels vergelijken</h1>
            <p className={styles.heroDescription}>
              Zie per winkel waar hij nu echt de laagste prijs heeft. Handig als
              je twijfelt tussen Rivendell, Hogwarts of een snelle City-build.
            </p>
          </div>
          <dl className={styles.stats} aria-label="Winkelstatistieken">
            <div className={styles.stat}>
              <dt>Actieve winkels</dt>
              <dd>{merchantsOverview.length}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Met laagste prijs</dt>
              <dd>{merchantWithDealCount}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Laagste deals</dt>
              <dd>{totalDealCount}</dd>
            </div>
          </dl>
        </section>

        <CatalogSectionShell
          as="section"
          bodySpacing="relaxed"
          padding="default"
          spacing="relaxed"
          title="Winkels met actuele LEGO prijzen"
          titleAs="h2"
          tone="default"
        >
          {merchantsOverview.length ? (
            <div className={styles.merchantGrid}>
              {merchantsOverview.map((item) => (
                <MerchantOverviewCard item={item} key={item.merchant.id} />
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              Er zijn nog geen actieve winkels om te vergelijken.
            </p>
          )}
        </CatalogSectionShell>
      </main>
    </ShellWeb>
  );
}
