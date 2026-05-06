import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { JsonLdScript, serializeJsonLd } from './json-ld';
import {
  buildArticleBreadcrumbJsonLd,
  buildArticleNewsJsonLd,
  buildCollectionPageJsonLd,
  buildSetBreadcrumbJsonLd,
  buildSetProductJsonLd,
  buildThemeBreadcrumbJsonLd,
} from './structured-data';

const baseSet = {
  id: '10316',
  imageUrl: 'https://cdn.example.com/10316.jpg',
  name: 'The Lord of the Rings: Rivendell',
  pieces: 6167,
  releaseYear: 2023,
  slug: 'lord-of-the-rings-rivendell-10316',
  theme: 'Lord of the Rings',
};

describe('structured data helpers', () => {
  it('builds Product schema with aggregate offers when multiple prices exist', () => {
    expect(
      buildSetProductJsonLd({
        catalogSetDetail: baseSet,
        offers: [
          {
            availability: 'in_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            condition: 'new',
            currency: 'EUR',
            market: 'NL',
            merchant: 'bol',
            merchantName: 'bol',
            priceCents: 39999,
            setId: '10316',
            url: 'https://partner.example/bol/10316',
          },
          {
            availability: 'out_of_stock',
            checkedAt: '2026-05-05T10:00:00.000Z',
            condition: 'new',
            currency: 'EUR',
            market: 'NL',
            merchant: 'lego',
            merchantName: 'LEGO',
            priceCents: 49999,
            setId: '10316',
            url: 'https://partner.example/lego/10316',
          },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        '@type': 'Product',
        aggregateOffer: expect.objectContaining({
          '@type': 'AggregateOffer',
          highPrice: '499.99',
          lowPrice: '399.99',
          offerCount: 2,
          priceCurrency: 'EUR',
        }),
        brand: {
          '@type': 'Brand',
          name: 'LEGO',
        },
        mpn: '10316',
        sku: '10316',
        url: 'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
      }),
    );
  });

  it('omits Product offer fields when pricing is unavailable', () => {
    expect(buildSetProductJsonLd({ catalogSetDetail: baseSet })).toEqual(
      expect.not.objectContaining({
        aggregateOffer: expect.anything(),
        offers: expect.anything(),
      }),
    );
  });

  it('builds NewsArticle and breadcrumb schema with canonical URLs', () => {
    expect(
      buildArticleNewsJsonLd({
        canonicalUrl:
          'https://www.brickhunt.nl/artikelen/star-wars/star-wars-day-2026',
        contentArticle: {
          cardImageAlt: 'Grogu',
          date: '2026-05-03',
          description: 'Waarom deze Star Wars sets blijven hangen.',
          heroImage: '/images/grogu.jpg',
          heroImageAlt: 'Grogu',
          slug: 'star-wars-day-2026',
          status: 'published',
          theme: 'Star Wars',
          title: 'Star Wars Day 2026',
          updatedAt: '2026-05-04T08:00:00.000Z',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        '@type': 'NewsArticle',
        dateModified: '2026-05-04T08:00:00.000Z',
        datePublished: '2026-05-03',
        headline: 'Star Wars Day 2026',
        mainEntityOfPage: {
          '@id':
            'https://www.brickhunt.nl/artikelen/star-wars/star-wars-day-2026',
          '@type': 'WebPage',
        },
      }),
    );

    expect(
      buildArticleBreadcrumbJsonLd({
        articleTitle: 'Star Wars Day 2026',
        articleUrl:
          'https://www.brickhunt.nl/artikelen/star-wars/star-wars-day-2026',
        themeName: 'Star Wars',
        themeUrl: '/artikelen/star-wars',
      }),
    ).toEqual(
      expect.objectContaining({
        '@type': 'BreadcrumbList',
        itemListElement: expect.arrayContaining([
          expect.objectContaining({
            item: 'https://www.brickhunt.nl/artikelen/star-wars',
            name: 'Star Wars',
          }),
        ]),
      }),
    );
  });

  it('builds CollectionPage and theme breadcrumb schema', () => {
    expect(
      buildCollectionPageJsonLd({
        description: 'Ontdek Star Wars LEGO sets.',
        name: 'Brickhunt - Star Wars LEGO sets',
        url: 'https://www.brickhunt.nl/themes/star-wars',
      }),
    ).toEqual(
      expect.objectContaining({
        '@type': 'CollectionPage',
        name: 'Brickhunt - Star Wars LEGO sets',
        url: 'https://www.brickhunt.nl/themes/star-wars',
      }),
    );

    expect(
      buildThemeBreadcrumbJsonLd({
        themeName: 'Star Wars',
        themeUrl: 'https://www.brickhunt.nl/themes/star-wars',
      }),
    ).toEqual(
      expect.objectContaining({
        '@type': 'BreadcrumbList',
      }),
    );
  });

  it('renders safe JSON-LD script markup without empty fields', () => {
    const html = renderToStaticMarkup(
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'Thing',
          empty: '',
          name: '<Rivendell>',
        }}
      />,
    );

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('\\u003cRivendell>');
    expect(serializeJsonLd({ empty: '', name: 'Rivendell' })).toBe(
      '{"name":"Rivendell"}',
    );
  });

  it('builds set breadcrumbs', () => {
    expect(
      buildSetBreadcrumbJsonLd({
        catalogSetDetail: baseSet,
        themeUrl: '/themes/lord-of-the-rings',
      }),
    ).toEqual(
      expect.objectContaining({
        '@type': 'BreadcrumbList',
        itemListElement: expect.arrayContaining([
          expect.objectContaining({
            name: 'The Lord of the Rings: Rivendell',
          }),
        ]),
      }),
    );
  });
});
