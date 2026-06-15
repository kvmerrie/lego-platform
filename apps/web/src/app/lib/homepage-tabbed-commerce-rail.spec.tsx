/** @vitest-environment jsdom */

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HomepageTabbedCommerceRail,
  type HomepageTabbedCommerceRailTab,
} from './homepage-tabbed-commerce-rail';

const homepageTabbedRailMocks = vi.hoisted(() => ({
  catalogSetCardRail: vi.fn(),
  wishlistToggle: vi.fn(),
}));

vi.mock('@lego-platform/catalog/ui', () => ({
  CatalogSetCardRail: (props: unknown) => {
    homepageTabbedRailMocks.catalogSetCardRail(props);
    const typedProps = props as {
      items: readonly {
        actions?: React.ReactNode;
        href: string;
        id: string;
        priceContext?: { primaryActionHref?: string };
        setSummary: { name: string };
      }[];
      render: (props: {
        controls: React.ReactNode;
        rail: React.ReactNode;
      }) => React.ReactNode;
    };

    return typedProps.render({
      controls: <div data-rail-controls>Controls</div>,
      rail: (
        <section data-homepage-set-list>
          <div className="setCardRailTrack" data-scroll-track>
            {typedProps.items.map((item) => (
              <article data-card-id={item.id} key={item.id}>
                <a href={item.href}>{item.setSummary.name}</a>
                {item.priceContext?.primaryActionHref ? (
                  <a href={item.priceContext.primaryActionHref}>Kooproute</a>
                ) : null}
                {item.actions}
              </article>
            ))}
          </div>
        </section>
      ),
    });
  },
}));

vi.mock('@lego-platform/catalog/feature-set-list', () => ({}));

vi.mock('@lego-platform/wishlist/feature-wishlist-toggle', () => ({
  WishlistFeatureWishlistToggle: (props: unknown) => {
    homepageTabbedRailMocks.wishlistToggle(props);
    const typedProps = props as { setId: string };

    return <span data-wishlist-toggle={typedProps.setId} />;
  },
}));

function buildTabs(): HomepageTabbedCommerceRailTab[] {
  return [
    {
      actionHref: '/deals',
      actionLabel: 'Meer deals bekijken',
      cards: [
        {
          id: '10316',
          name: 'Rivendell',
          pieces: 6167,
          priceContext: {
            currentPrice: 'Vanaf EUR 429,99',
            primaryActionHref: 'https://merchant.example/10316',
          },
          productIntent: 'price-alert',
          releaseYear: 2023,
          slug: 'the-lord-of-the-rings-rivendell-10316',
          theme: 'Icons',
          wishlistAnalyticsContext: {
            cardSurface: 'buy',
            pageSurface: 'homepage',
            sectionId: 'best-current-deals-best-deals',
            setId: '10316',
            tabId: 'best-deals',
            theme: 'Icons',
          },
        },
      ],
      description: 'Sterke actuele deals.',
      id: 'best-deals',
      sectionId: 'best-current-deals-best-deals',
      title: 'Beste deals',
    },
    {
      cards: [],
      description: 'Echte activiteit deze week.',
      id: 'popular-this-week',
      sectionId: 'best-current-deals-popular-this-week',
      title: 'Populair',
    },
    {
      actionHref: '/lego-sets-onder-100-euro',
      actionLabel: 'Meer sets onder €100',
      cards: [
        {
          id: '31170',
          name: 'Wild Animals: Pink Flamingo',
          pieces: 288,
          productIntent: 'price-alert',
          releaseYear: 2025,
          slug: 'wild-animals-pink-flamingo-31170',
          theme: 'Creator',
          wishlistAnalyticsContext: {
            cardSurface: 'buy',
            pageSurface: 'homepage',
            sectionId: 'best-current-deals-gifts-under-100',
            setId: '31170',
            tabId: 'gifts-under-100',
            theme: 'Creator',
          },
        },
      ],
      description: 'Herkenbare sets onder €100.',
      id: 'gifts-under-100',
      sectionId: 'best-current-deals-gifts-under-100',
      title: 'Onder €100',
    },
  ];
}

describe('HomepageTabbedCommerceRail', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);

      return 1;
    };
    homepageTabbedRailMocks.catalogSetCardRail.mockClear();
    homepageTabbedRailMocks.wishlistToggle.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders one active tab panel and hides empty tabs', () => {
    act(() => {
      root.render(
        <HomepageTabbedCommerceRail
          sectionId="best-current-deals"
          tabs={buildTabs()}
          title="Slim kopen"
        />,
      );
    });

    expect(container.textContent).toContain('Slim kopen');
    expect(container.textContent).toContain('Beste deals');
    expect(container.textContent).not.toContain('Kopen zonder lange pagina.');
    expect(container.textContent).not.toContain('Populair');
    expect(container.textContent).toContain('Onder €100');
    expect(container.textContent).not.toContain('Onder EUR 100');
    expect(container.textContent).toContain('Rivendell');
    expect(container.textContent).not.toContain('Wild Animals: Pink Flamingo');
    expect(container.querySelectorAll('[data-homepage-set-list]')).toHaveLength(
      1,
    );
    expect(container.querySelector('[data-card-id="10316"]')).not.toBeNull();
    expect(container.querySelector('a[href="/deals"]')).toBeNull();
    expect(
      container.querySelector('a[href="https://merchant.example/10316"]'),
    ).not.toBeNull();
    expect(container.querySelector('h3')).toBeNull();
    expect(container.querySelector('[data-rail-controls]')).not.toBeNull();
    expect(homepageTabbedRailMocks.catalogSetCardRail).toHaveBeenCalledTimes(1);
    expect(homepageTabbedRailMocks.catalogSetCardRail).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Beste deals',
        railLayoutMode: 'stable-square',
      }),
    );
  });

  it('switches tabs without fragment navigation, keeps card actions, and resets rail scroll', () => {
    act(() => {
      root.render(
        <HomepageTabbedCommerceRail
          sectionId="best-current-deals"
          tabs={buildTabs()}
          title="Slim kopen"
        />,
      );
    });

    const initialScrollTrack = container.querySelector<HTMLElement>(
      '[data-scroll-track]',
    );
    expect(initialScrollTrack).not.toBeNull();

    if (initialScrollTrack) {
      initialScrollTrack.scrollLeft = 320;
    }

    const giftTab = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Onder €100',
    );

    expect(giftTab?.getAttribute('type')).toBe('button');

    act(() => {
      giftTab?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(container.textContent).not.toContain('Rivendell');
    expect(container.textContent).toContain('Wild Animals: Pink Flamingo');
    expect(container.querySelector('[data-card-id="31170"]')).not.toBeNull();
    expect(
      container.querySelector('a[href="/lego-sets-onder-100-euro"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-wishlist-toggle="31170"]'),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLElement>('[data-scroll-track]')?.scrollLeft,
    ).toBe(0);
  });

  it('exposes accessible tabs for narrow viewports', () => {
    act(() => {
      root.render(
        <HomepageTabbedCommerceRail
          sectionId="best-current-deals"
          tabs={buildTabs()}
          title="Slim kopen"
        />,
      );
    });

    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe('Beste deals');
  });

  it('supports keyboard tab navigation', () => {
    act(() => {
      root.render(
        <HomepageTabbedCommerceRail
          sectionId="best-current-deals"
          tabs={buildTabs()}
          title="Slim kopen"
        />,
      );
    });

    const activeTab = container.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );

    act(() => {
      activeTab?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'ArrowRight',
        }),
      );
    });

    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe('Onder €100');
    expect(container.textContent).toContain('Wild Animals: Pink Flamingo');
  });

  it('keeps tabs borderless and aligned to the shared section padding', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'apps/web/src/app/page.module.css'),
      'utf-8',
    );
    const intentRailBlock = css.match(/\.intentRail \{[^}]+\}/u)?.[0] ?? '';
    const intentTabsBlock = css.match(/\.intentTabs \{[^}]+\}/u)?.[0] ?? '';

    expect(intentRailBlock).toContain('--catalog-section-inline-padding');
    expect(intentRailBlock).toContain(
      'padding-inline: var(--catalog-section-inline-padding);',
    );
    expect(intentTabsBlock).toContain(
      'padding: 0 var(--catalog-section-inline-padding);',
    );
    expect(intentTabsBlock).not.toContain('border-bottom');
  });
});
