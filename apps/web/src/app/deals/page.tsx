import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React from 'react';
import {
  getCatalogDealPageSnapshot,
  type CatalogDealPageSortKey,
} from '@lego-platform/catalog/data-access-web';
import {
  CatalogBrowsePagination,
  CatalogSectionShell,
  CatalogSetCard,
  CatalogSetCardCollection,
} from '@lego-platform/catalog/ui';
import { CATALOG_BROWSE_PAGE_SIZE } from '@lego-platform/catalog/util';
import {
  buildCanonicalUrl,
  buildSetDetailPath,
  buildWebPath,
  cacheTags,
  webPathnames,
} from '@lego-platform/shared/config';
import { ShellWeb } from '@lego-platform/shell/web';
import { getCachedPublicBrowsePageData } from '../lib/public-browse-page-cache';
import {
  PRICE_SNAPSHOT_PAGE_MAX_AGE_MS,
  getSnapshotPageHealth,
} from '../lib/snapshot-page-health';
import styles from './deals-page.module.css';

export const revalidate = false;

const DEALS_PAGE_SIZE = CATALOG_BROWSE_PAGE_SIZE;

interface DealSortViewConfig {
  description: string;
  label: string;
  metadataDescription: string;
  metadataTitle: string;
  sortKey: CatalogDealPageSortKey;
  title: string;
}

const dealSortViewConfigs = [
  {
    description:
      'Begin hier als je snel wilt zien welke LEGO-set vandaag echt aantrekkelijk geprijsd is.',
    label: 'Aanraders',
    metadataDescription:
      'Bekijk actuele LEGO deals met sterke korting, goede prijs per steen en betrouwbare kooplinks.',
    metadataTitle: 'LEGO deals van vandaag',
    sortKey: 'recommended',
    title: 'LEGO deals die nu de moeite waard zijn',
  },
  {
    description:
      'Kijk hier als je vooral veel euro’s onder de LEGO-prijs wilt zitten.',
    label: 'Grootste kortingen',
    metadataDescription:
      'Vind LEGO sets met de grootste korting ten opzichte van LEGO, inclusief actuele prijs en kooplink.',
    metadataTitle: 'LEGO deals met de grootste korting',
    sortKey: 'discount-desc',
    title: 'De grootste LEGO kortingen',
  },
  {
    description:
      'Handig voor grote builds, displaysets en dozen waar je veel bouwtijd uit haalt.',
    label: 'Prijs per steen',
    metadataDescription:
      'Bekijk LEGO aanbiedingen gesorteerd op de beste prijs per steen, met actuele winkelprijzen.',
    metadataTitle: 'Beste LEGO prijs per steen',
    sortKey: 'price-per-brick',
    title: 'De beste prijs per steen',
  },
  {
    description:
      'Goede cadeaus en compacte sets die niet meteen je hele budget pakken.',
    label: 'Onder €50',
    metadataDescription:
      'Bekijk actuele LEGO deals onder 50 euro, met kooplinks en prijscontext.',
    metadataTitle: 'LEGO deals onder 50 euro',
    sortKey: 'under-50',
    title: 'LEGO deals onder €50',
  },
  {
    description:
      'Verse koopmomenten uit de laatste snapshots, zonder live winkelwerk tijdens het laden.',
    label: 'Nieuwe deals',
    metadataDescription:
      'Bekijk nieuwe LEGO deals uit de laatste prijssnapshot, met actuele winkelprijzen.',
    metadataTitle: 'Nieuwe LEGO deals',
    sortKey: 'new-deals',
    title: 'Nieuwe LEGO deals',
  },
  {
    description:
      'Kleine dozen, leuke figuren en slimme extra’s voor een scherp bedrag.',
    label: 'Onder €20',
    metadataDescription:
      'Bekijk actuele LEGO deals onder 20 euro, met prijscontext en kooplinks.',
    metadataTitle: 'LEGO deals onder 20 euro',
    sortKey: 'under-20',
    title: 'LEGO deals onder €20',
  },
  {
    description:
      'Grote dozen waar de korting pas echt telt: Icons, Technic en displaysets.',
    label: 'Premium deals',
    metadataDescription:
      'Bekijk premium LEGO deals boven 100 euro met sterke korting of opvallend lage prijs per steen.',
    metadataTitle: 'Premium LEGO deals',
    sortKey: 'premium-deals',
    title: 'Premium LEGO deals',
  },
  {
    description:
      'Dezelfde dealgroep als prijs per steen, klaar voor vaste categorie-links.',
    label: 'Beste prijs per steen',
    metadataDescription:
      'Bekijk LEGO deals met de beste prijs per steen uit de actuele deal-snapshot.',
    metadataTitle: 'Beste LEGO prijs per steen',
    sortKey: 'best-price-per-brick',
    title: 'Beste LEGO prijs per steen',
  },
  {
    description:
      'Dezelfde dealgroep als grootste kortingen, klaar voor vaste categorie-links.',
    label: 'Grootste korting',
    metadataDescription:
      'Bekijk LEGO deals met de grootste korting uit de actuele deal-snapshot.',
    metadataTitle: 'Grootste LEGO korting',
    sortKey: 'largest-discount',
    title: 'Grootste LEGO korting',
  },
] as const satisfies readonly DealSortViewConfig[];

const dealSortKeys = dealSortViewConfigs.map(
  (config) => config.sortKey,
) as readonly CatalogDealPageSortKey[];

const primaryDealSortKeys: readonly CatalogDealPageSortKey[] = [
  'recommended',
  'discount-desc',
  'price-per-brick',
  'under-50',
  'new-deals',
];

const secondaryDealSortKeys: readonly CatalogDealPageSortKey[] = [
  'under-20',
  'premium-deals',
];

const dealSortConfigByKey = new Map(
  dealSortViewConfigs.map((config) => [config.sortKey, config]),
);

function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDealPageNumber(value?: string): number {
  const parsedPage = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1;
}

function normalizeDealSortKey(value?: string): CatalogDealPageSortKey {
  return dealSortKeys.includes(value as CatalogDealPageSortKey)
    ? (value as CatalogDealPageSortKey)
    : 'recommended';
}

function getDealSortConfig(sortKey: CatalogDealPageSortKey) {
  return (
    dealSortConfigByKey.get(sortKey) ??
    dealSortConfigByKey.get('recommended') ??
    dealSortViewConfigs[0]
  );
}

function getDealSortHref(sortKey: CatalogDealPageSortKey): string {
  return sortKey === 'recommended'
    ? webPathnames.deals
    : `${webPathnames.deals}?sort=${sortKey}`;
}

function formatDealStatNumber(value: number): string {
  return new Intl.NumberFormat('nl-NL').format(value);
}

function formatDealPercent(value?: number): string {
  return typeof value === 'number' ? `${value}%` : 'n.b.';
}

function formatPricePerBrick(value?: number): string {
  return typeof value === 'number' ? `${value} cent` : 'n.b.';
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{
    sort?: string | string[];
  }>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const sortKey = normalizeDealSortKey(
    readSearchParam(resolvedSearchParams?.sort),
  );
  const config = getDealSortConfig(sortKey);
  const canonicalPath =
    sortKey === 'recommended'
      ? buildWebPath(webPathnames.deals)
      : `${buildWebPath(webPathnames.deals)}?sort=${sortKey}`;
  const canonicalUrl = buildCanonicalUrl(canonicalPath, {
    allowedSearchParams: ['sort'],
  });

  return {
    title: config.metadataTitle,
    description: config.metadataDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: config.metadataTitle,
      description: config.metadataDescription,
      type: 'website',
      url: canonicalUrl,
    },
  };
}

async function getCachedDealPageSnapshot({
  limit,
  offset,
  sortKey,
}: {
  limit: number;
  offset: number;
  sortKey: CatalogDealPageSortKey;
}) {
  return getCachedPublicBrowsePageData({
    load: async () => {
      const snapshot = await getCatalogDealPageSnapshot({
        limit,
        offset,
        sortKey,
      });
      const health = getSnapshotPageHealth({
        generatedAt: snapshot?.snapshotGeneratedAt,
        maxAgeMs: PRICE_SNAPSHOT_PAGE_MAX_AGE_MS,
      });

      if (health !== 'fresh') {
        console.warn('[deal-page-snapshot] unsafe page render blocked', {
          generated_at: snapshot?.snapshotGeneratedAt ?? null,
          health,
          limit,
          offset,
          sort_key: sortKey,
        });

        return null;
      }

      return snapshot;
    },
    pageType: 'deals',
    params: ['sort', sortKey, 'limit', limit, 'offset', offset],
    revalidateSeconds: revalidate,
    slug: 'deals',
    tags: [cacheTags.deals(), cacheTags.prices()],
  });
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sortKey = normalizeDealSortKey(
    readSearchParam(resolvedSearchParams?.sort),
  );
  const sortConfig = getDealSortConfig(sortKey);
  const currentPage = normalizeDealPageNumber(
    readSearchParam(resolvedSearchParams?.page),
  );
  const dealsPage = await getCachedDealPageSnapshot({
    limit: DEALS_PAGE_SIZE,
    offset: (currentPage - 1) * DEALS_PAGE_SIZE,
    sortKey,
  });

  if (!dealsPage) {
    return notFound();
  }

  const pageCount = Math.max(
    1,
    Math.ceil(dealsPage.totalSetCount / DEALS_PAGE_SIZE),
  );

  if (currentPage > pageCount) {
    return notFound();
  }

  return (
    <ShellWeb>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>LEGO deals</p>
            <h1 className={styles.heroTitle}>{sortConfig.title}</h1>
            <p className={styles.heroDescription}>{sortConfig.description}</p>
          </div>

          <dl className={styles.dealStats} aria-label="Dealstatistieken">
            <div className={styles.dealStat}>
              <dt>Actieve deals</dt>
              <dd>{formatDealStatNumber(dealsPage.stats.activeDealCount)}</dd>
            </div>
            <div className={styles.dealStat}>
              <dt>Gemiddelde korting</dt>
              <dd>
                {formatDealPercent(dealsPage.stats.averageDiscountPercent)}
              </dd>
            </div>
            <div className={styles.dealStat}>
              <dt>Grootste korting</dt>
              <dd>
                {formatDealPercent(dealsPage.stats.highestDiscountPercent)}
              </dd>
            </div>
            <div className={styles.dealStat}>
              <dt>Laagste prijs per steen</dt>
              <dd>
                {formatPricePerBrick(dealsPage.stats.lowestPricePerBrickMinor)}
              </dd>
            </div>
          </dl>

          <nav aria-label="Deal categorieen" className={styles.dealNav}>
            {primaryDealSortKeys.map((dealSortKey) => {
              const config = getDealSortConfig(dealSortKey);

              return (
                <a
                  aria-current={dealSortKey === sortKey ? 'page' : undefined}
                  className={styles.dealNavLink}
                  href={getDealSortHref(dealSortKey)}
                  key={dealSortKey}
                >
                  {config.label}
                </a>
              );
            })}
          </nav>

          <nav
            aria-label="Extra deal categorieen"
            className={styles.secondaryDealNav}
          >
            {secondaryDealSortKeys.map((dealSortKey) => {
              const config = getDealSortConfig(dealSortKey);

              return (
                <a
                  aria-current={dealSortKey === sortKey ? 'page' : undefined}
                  className={styles.secondaryDealNavLink}
                  href={getDealSortHref(dealSortKey)}
                  key={dealSortKey}
                >
                  {config.label}
                </a>
              );
            })}
          </nav>
        </section>

        <CatalogSectionShell
          as="section"
          bodySpacing="relaxed"
          className={styles.browseSection}
          description="Deze lijst komt uit de deal-snapshot. Geen live winkelrefresh tijdens het laden, wel actuele prijscontext uit de laatste commerce-sync."
          eyebrow="Dealbrowser"
          id="deals"
          padding="default"
          signal={`${dealsPage.totalSetCount} deals`}
          spacing="relaxed"
          title={sortConfig.label}
          titleAs="h2"
          tone="default"
        >
          {dealsPage.setCards.length ? (
            <>
              <CatalogSetCardCollection
                className={styles.grid}
                gridMode="browse"
                variant="compact"
              >
                {dealsPage.setCards.map((setCard, index) => (
                  <CatalogSetCard
                    ctaMode="commerce"
                    href={buildSetDetailPath(setCard.slug)}
                    imageLoading={index < 6 ? 'eager' : 'lazy'}
                    key={setCard.id}
                    priceContext={setCard.priceContext}
                    setSummary={setCard}
                    variant="featured"
                  />
                ))}
              </CatalogSetCardCollection>
              <CatalogBrowsePagination
                ariaLabel="Deals pagina's"
                basePath={webPathnames.deals}
                currentPage={currentPage}
                pageCount={pageCount}
                queryParams={
                  sortKey !== 'recommended' ? { sort: sortKey } : undefined
                }
              />
            </>
          ) : (
            <p className={styles.emptyState}>
              De deal-snapshot is nog leeg. Na de volgende commerce-sync staat
              hier een browsebare lijst met actuele deals.
            </p>
          )}
        </CatalogSectionShell>
      </main>
    </ShellWeb>
  );
}
