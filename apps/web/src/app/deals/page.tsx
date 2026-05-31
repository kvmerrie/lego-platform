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
import { ActionLink, SectionHeading } from '@lego-platform/shared/ui';
import { ShellWeb } from '@lego-platform/shell/web';
import { getCachedPublicBrowsePageData } from '../lib/public-browse-page-cache';
import styles from './deals-page.module.css';

export const revalidate = false;

const DEALS_PAGE_SIZE = CATALOG_BROWSE_PAGE_SIZE;
const dealsMetadataTitle = 'LEGO deals en actuele prijzen';
const dealsMetadataDescription =
  'Bekijk LEGO-sets met actuele prijzen, kooplinks en prijsbewegingen bij Brickhunt.';

const dealSortLabels: Record<CatalogDealPageSortKey, string> = {
  'discount-desc': 'Grootste korting',
  'price-per-brick': 'Prijs per steen',
  recommended: 'Beste deals',
  'under-50': 'Onder €50',
};

const dealSortKeys: readonly CatalogDealPageSortKey[] = [
  'recommended',
  'discount-desc',
  'price-per-brick',
  'under-50',
];

export const metadata: Metadata = {
  title: dealsMetadataTitle,
  description: dealsMetadataDescription,
  alternates: {
    canonical: buildCanonicalUrl(buildWebPath(webPathnames.deals)),
  },
  openGraph: {
    title: dealsMetadataTitle,
    description: dealsMetadataDescription,
    type: 'website',
    url: buildCanonicalUrl(buildWebPath(webPathnames.deals)),
  },
};

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

function getDealSortHref(sortKey: CatalogDealPageSortKey): string {
  return sortKey === 'recommended'
    ? webPathnames.deals
    : `${webPathnames.deals}?sort=${sortKey}`;
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
    load: async () =>
      (await getCatalogDealPageSnapshot({
        limit,
        offset,
        sortKey,
      })) ?? {
        setCards: [],
        totalSetCount: 0,
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
  const currentPage = normalizeDealPageNumber(
    readSearchParam(resolvedSearchParams?.page),
  );
  const dealsPage = await getCachedDealPageSnapshot({
    limit: DEALS_PAGE_SIZE,
    offset: (currentPage - 1) * DEALS_PAGE_SIZE,
    sortKey,
  });
  const pageCount = Math.max(
    1,
    Math.ceil(dealsPage.totalSetCount / DEALS_PAGE_SIZE),
  );

  if (currentPage > pageCount) {
    notFound();
  }

  return (
    <ShellWeb>
      <main className={styles.page}>
        <section className={styles.intro}>
          <SectionHeading
            description="Alleen sets met actuele prijzen en kooplinks. Hier draait het om wat je vandaag echt kunt kopen."
            eyebrow="Deals"
            title="Deals die nu iets waard zijn"
            titleAs="h1"
          />
          <p className={styles.introMeta}>
            {dealsPage.totalSetCount} sets met actuele koopdata
          </p>
          <ul className={styles.merchandisingGroups} aria-label="Dealgroepen">
            <li className={styles.merchandisingGroup}>Beste deals</li>
            <li className={styles.merchandisingGroup}>Grootste korting</li>
            <li className={styles.merchandisingGroup}>Prijs per steen</li>
            <li className={styles.merchandisingGroup}>Onder €50</li>
          </ul>
          <ActionLink href="#deals" size="hero" tone="accent">
            Bekijk de deals
          </ActionLink>
        </section>

        <CatalogSectionShell
          as="section"
          bodySpacing="relaxed"
          className={styles.browseSection}
          description="Een vaste browsepagina uit de deal-snapshot. Geen live winkelrefresh tijdens het laden, wel actuele prijscontext uit de laatste commerce-sync."
          eyebrow="Dealbrowser"
          id="deals"
          padding="default"
          signal={`${dealsPage.totalSetCount} deals`}
          spacing="relaxed"
          title={dealSortLabels[sortKey]}
          titleAs="h2"
          tone="default"
          utility={
            <nav aria-label="Sorteer deals" className={styles.sortNav}>
              {dealSortKeys.map((dealSortKey) => (
                <a
                  aria-current={dealSortKey === sortKey ? 'true' : undefined}
                  className={styles.sortLink}
                  href={getDealSortHref(dealSortKey)}
                  key={dealSortKey}
                >
                  {dealSortLabels[dealSortKey]}
                </a>
              ))}
            </nav>
          }
          utilityPlacement="below-heading"
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
