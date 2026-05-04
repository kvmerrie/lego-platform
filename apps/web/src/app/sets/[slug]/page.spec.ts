import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

describe('set detail availability fallback state', () => {
  it('treats a current-year set with no current tracked offers as no_current_price', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 2,
          validPrimaryOfferCount: 0,
        },
        releaseYear: 2026,
      }),
    ).toBe('no_current_price');
  });

  it('treats a recent exact release with unavailable tracked offers as no_current_price', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 1,
          validPrimaryOfferCount: 0,
        },
        releaseDate: '2026-05-01',
        releaseDatePrecision: 'day',
        releaseYear: 2026,
      }),
    ).toBe('no_current_price');
  });

  it('treats an older set with no current tracked offers as no_current_stock unless retired is explicit', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 2,
          validPrimaryOfferCount: 0,
        },
        releaseYear: 2024,
      }),
    ).toBe('no_current_stock');
  });

  it('shows retired only when an explicit retired lifecycle signal exists', async () => {
    const { resolveSetDetailAvailabilityFallbackState } = await import(
      './page'
    );

    expect(
      resolveSetDetailAvailabilityFallbackState({
        hasInStockOffer: false,
        now: new Date('2026-04-30T12:00:00.000Z'),
        primaryOfferAvailability: {
          primarySeedCount: 0,
          validPrimaryOfferCount: 0,
        },
        releaseYear: 2021,
        setStatus: 'retired',
      }),
    ).toBe('retired');
  });
});

describe('SetNewsRail', () => {
  it('renders latest update cards for matching set articles', async () => {
    const { SetNewsRail } = await import('./page');
    const html = renderToStaticMarkup(
      createElement(SetNewsRail, {
        articles: [
          {
            cardImageAlt: 'Alt',
            date: '2026-05-04',
            description: 'Nieuwe details over deze set.',
            heroImageAlt: 'Alt',
            primarySetNumber: '75459',
            slug: 'imperial-lambda-class-shuttle',
            status: 'published',
            theme: 'Star Wars',
            title: 'Imperial Lambda-Class Shuttle nu te pre-orderen',
          },
        ],
      }),
    );

    expect(html).toContain('Laatste updates');
    expect(html).not.toContain('Nieuws over deze set');
    expect(html).toContain('Imperial Lambda-Class Shuttle nu te pre-orderen');
    expect(html).toContain('Nieuwe details over deze set.');
    expect(html).toContain(
      '/artikelen/star-wars/imperial-lambda-class-shuttle',
    );
  });

  it('hides the rail when there are no matching articles', async () => {
    const { SetNewsRail } = await import('./page');

    expect(
      renderToStaticMarkup(createElement(SetNewsRail, { articles: [] })),
    ).toBe('');
  });
});
