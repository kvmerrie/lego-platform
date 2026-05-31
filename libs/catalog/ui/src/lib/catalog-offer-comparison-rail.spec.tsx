/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogOfferItem } from './catalog-commerce-ui';
import { CatalogOfferComparisonRail } from './catalog-offer-comparison-rail';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const offers = [
  {
    checkedLabel: 'Vandaag om 09:00',
    ctaHref: 'https://example.com/best',
    ctaLabel: 'Bekijk bij bol',
    isBest: true,
    merchantLabel: 'bol',
    price: '€ 89,99',
    rankingLabel: 'Laagste nagekeken prijs op voorraad.',
    stockLabel: 'Op voorraad',
    trackingEvent: {
      event: 'offer_click',
      properties: {
        offerPlacement: 'comparison_row',
        offerRole: 'best',
        rankPosition: 1,
        setId: '10316',
      },
    },
  },
  {
    checkedLabel: 'Vandaag om 09:05',
    ctaHref: 'https://example.com/alternative',
    ctaLabel: 'Bekijk bij LEGO',
    merchantLabel: 'LEGO',
    price: '€ 94,99',
    rankingLabel: '€ 5,00 hoger dan de beste optie.',
    stockLabel: 'Op voorraad',
    trackingEvent: {
      event: 'offer_click',
      properties: {
        offerPlacement: 'comparison_row',
        offerRole: 'alternative',
        rankPosition: 2,
        setId: '10316',
      },
    },
  },
];

function makeOverflowOffers(
  primaryOffers: readonly CatalogOfferItem[] = offers,
): CatalogOfferItem[] {
  return [
    ...primaryOffers,
    ...Array.from(
      { length: Math.max(0, 21 - primaryOffers.length) },
      (_, index) => ({
        checkedLabel: 'Vandaag om 09:10',
        ctaHref: `https://example.com/overflow-${index + 1}`,
        ctaLabel: `Bekijk bij Shop ${index + 1}`,
        merchantLabel: `Shop ${index + 1}`,
        price: `€ ${99 + index},99`,
        rankingLabel: `€ ${10 + index},00 hoger dan de beste optie.`,
        stockLabel: 'Op voorraad',
      }),
    ),
  ];
}

describe('CatalogOfferComparisonRail overlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function flushAnimationFrame() {
    await act(async () => {
      await new Promise<void>((resolvePromise) => {
        window.requestAnimationFrame(() => resolvePromise());
      });
    });
  }

  async function openOverlay({
    overlayOffers = makeOverflowOffers(),
    summaryLabel = '21 winkels nagekeken',
  }: {
    overlayOffers?: readonly CatalogOfferItem[];
    summaryLabel?: string;
  } = {}) {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={overlayOffers}
          summaryLabel={summaryLabel}
        />,
      );
    });

    const trigger = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Bekijk alle winkels'),
    );

    expect(trigger).not.toBeUndefined();

    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await flushAnimationFrame();

    return trigger as HTMLButtonElement;
  }

  it('does not duplicate the LEGO merchant label in compact offer text', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/lego',
              ctaLabel: 'Bekijk deal bij LEGO®',
              isBest: true,
              merchantLabel: 'LEGO®',
              price: '€ 59,99',
              rankingLabel: 'Laagste nagekeken prijs op voorraad.',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="1 winkel nagekeken"
        />,
      );
    });

    expect(container.textContent).toContain('LEGO®');
    expect(container.textContent).not.toContain('LEGO® LEGO®');
  });

  it('renders the full comparison trigger for normal multi-shop rails', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={offers}
          summaryLabel="2 winkels nagekeken"
        />,
      );
    });

    const trigger = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Bekijk alle winkels'),
    );

    expect(trigger).not.toBeUndefined();
    expect(trigger?.getAttribute('aria-label')).toBe(
      'Vergelijk alle 2 winkels',
    );
  });

  it('does not render the full comparison trigger for a single offer', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[offers[0]]}
          summaryLabel="1 winkel nagekeken"
        />,
      );
    });

    expect(container.textContent).not.toContain('Bekijk alle winkels');
    expect(
      container.querySelector('button[aria-label="Vergelijk alle 1 winkel"]'),
    ).toBeNull();
  });

  it('uses the shared full-screen overlay layer and locks background scroll', async () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    await openOverlay();

    const backdrop = document.body.querySelector(
      '[data-offer-comparison-backdrop="true"]',
    );
    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );

    expect(backdrop).not.toBeNull();
    expect(backdrop?.parentElement).toBe(document.body);
    expect(dialog).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(css).toContain('.offerOverlayBackdrop {');
    expect(css).toContain('background: rgba(12, 18, 32, 0.82);');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('z-index: 1400;');
  });

  it('traps focus, closes on Escape and restores focus to the trigger', async () => {
    const trigger = await openOverlay();
    const dialog = document.body.querySelector<HTMLDivElement>(
      '[data-offer-comparison-dialog="true"]',
    );
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Vergelijking sluiten"]',
    );
    const offerLinks = document.body.querySelectorAll<HTMLAnchorElement>(
      '[data-offer-comparison-dialog="true"] a[href]',
    );

    expect(document.activeElement).toBe(closeButton);

    act(() => {
      closeButton?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Tab',
          shiftKey: true,
        }),
      );
    });

    expect(document.activeElement).toBe(offerLinks[offerLinks.length - 1]);

    act(() => {
      offerLinks[offerLinks.length - 1]?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Tab',
        }),
      );
    });

    expect(document.activeElement).toBe(closeButton);

    act(() => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Escape',
        }),
      );
    });
    await flushAnimationFrame();

    expect(
      document.body.querySelector('[data-offer-comparison-dialog="true"]'),
    ).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes from backdrop click and restores focus to the trigger', async () => {
    const trigger = await openOverlay();
    const backdrop = document.body.querySelector(
      '[data-offer-comparison-backdrop="true"]',
    );

    act(() => {
      backdrop?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await flushAnimationFrame();

    expect(
      document.body.querySelector('[data-offer-comparison-dialog="true"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders compact comparison rows with right-aligned prices and accessible short CTAs', async () => {
    const overlayOffers = makeOverflowOffers();
    await openOverlay({
      overlayOffers,
      summaryLabel: '2 winkels nagekeken · Vandaag om 09:00',
    });

    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );
    const rows = Array.from(
      document.body.querySelectorAll('article[class*="offerOverlayRow"]'),
    );
    const priceCells = Array.from(
      document.body.querySelectorAll('[class*="offerOverlayPriceCell"]'),
    );
    const statusLabels = Array.from(
      document.body.querySelectorAll(
        '[data-offer-comparison-dialog="true"] [class*="offerAvailabilityStatus"]',
      ),
    );
    const links = Array.from(
      document.body.querySelectorAll<HTMLAnchorElement>(
        '[data-offer-comparison-dialog="true"] a[href]',
      ),
    );

    expect(dialog?.textContent).toContain('2 winkels nagekeken');
    expect(dialog?.textContent).not.toContain(
      '2 winkels nagekeken · Vandaag om 09:00',
    );
    expect(rows).toHaveLength(overlayOffers.length);
    expect(priceCells).toHaveLength(overlayOffers.length);
    expect(dialog?.textContent).toContain('Beste deal');
    expect(dialog?.textContent).toContain('Bekijk beste deal');
    expect(dialog?.textContent).toContain('Naar winkel');
    expect(dialog?.textContent).toContain('LEGO');
    expect(dialog?.textContent).not.toContain('LEGO LEGO');
    expect(dialog?.textContent).toContain('€5 duurder');
    expect(statusLabels).toHaveLength(overlayOffers.length);
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerRailStock"]',
      ),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerOverlayStock"]',
      ),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerOverlayAction"]',
      ),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerOverlayChevron"]',
      ),
    ).not.toBeNull();
    expect(links[1]?.getAttribute('aria-label')).toBe('Naar winkel bij LEGO');
    expect(links[0]?.getAttribute('target')).toBe('_blank');
    expect(links[0]?.getAttribute('rel')).toBe('noreferrer sponsored');
    expect(links[0]?.getAttribute('data-brickhunt-event')).toBe('offer_click');
    expect(links[0]?.getAttribute('data-brickhunt-properties')).toContain(
      'comparison_row',
    );
    expect(links[0]?.getAttribute('data-brickhunt-properties')).toContain(
      'rankPosition',
    );
  });

  it('keeps unavailable overlay states readable in the compact price list', async () => {
    const overlayOffers = makeOverflowOffers([
      offers[0],
      {
        ...offers[1],
        checkedLabel: 'Gisteren om 11:00',
        ctaHref: 'https://example.com/sold-out',
        merchantLabel: 'Sold Out Shop',
        price: '€ 84,99',
        stockLabel: 'Uitverkocht',
      },
      {
        ...offers[1],
        checkedLabel: '2 apr om 11:00',
        ctaHref: 'https://example.com/unknown',
        merchantLabel: 'Unknown Shop',
        price: '€ 84,99',
        stockLabel: 'Voorraad onbekend',
      },
    ]);

    await openOverlay({
      overlayOffers,
      summaryLabel: '3 winkels nagekeken',
    });

    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );

    expect(dialog?.textContent).toContain('Uitverkocht');
    expect(dialog?.textContent).toContain('Uitverkocht maar lager');
    expect(dialog?.textContent).toContain('Voorraad onbekend');
    expect(dialog?.textContent).toContain('Voorraad onbekend, lager');
  });

  it('uses the same compact dot status style in rail cards and modal rows', async () => {
    const statusOffers = makeOverflowOffers([
      offers[0],
      {
        ...offers[1],
        ctaHref: 'https://example.com/unknown',
        merchantLabel: 'Unknown Shop',
        stockLabel: 'Voorraad onbekend',
      },
      {
        ...offers[1],
        ctaHref: 'https://example.com/sold-out',
        merchantLabel: 'Sold Out Shop',
        stockLabel: 'Uitverkocht',
      },
    ]);

    await openOverlay({
      overlayOffers: statusOffers,
      summaryLabel: '3 winkels nagekeken',
    });

    const railStatuses = Array.from(
      container.querySelectorAll('[class*="offerAvailabilityStatus"]'),
    );
    const modalStatuses = Array.from(
      document.body.querySelectorAll(
        '[data-offer-comparison-dialog="true"] [class*="offerAvailabilityStatus"]',
      ),
    );

    expect(railStatuses).toHaveLength(20);
    expect(modalStatuses).toHaveLength(statusOffers.length);
    expect(container.textContent).toContain('Op voorraad');
    expect(container.textContent).toContain('Voorraad onbekend');
    expect(container.textContent).toContain('Uitverkocht');
    expect(document.body.textContent).toContain('Op voorraad');
    expect(document.body.textContent).toContain('Voorraad onbekend');
    expect(document.body.textContent).toContain('Uitverkocht');
    expect(container.querySelector('[class*="offerRailStock"]')).toBeNull();
    expect(
      document.body.querySelector('[class*="offerOverlayStock"]'),
    ).toBeNull();
  });

  it('keeps long delta text inside the fixed price column', async () => {
    const overlayOffers = makeOverflowOffers([
      offers[0],
      {
        ...offers[1],
        ctaHref: 'https://example.com/premium-marketplace',
        merchantLabel: 'Coppenswarenhuis Met Een Extra Lange Winkelnaam',
        price: '€ 1.234,56',
      },
    ]);

    await openOverlay({
      overlayOffers,
      summaryLabel: '2 winkels nagekeken',
    });

    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );
    const priceCells = Array.from(
      document.body.querySelectorAll('[class*="offerOverlayPriceCell"]'),
    );

    expect(priceCells).toHaveLength(overlayOffers.length);
    expect(dialog?.textContent).toContain(
      'Coppenswarenhuis Met Een Extra Lange Winkelnaam',
    );
    expect(dialog?.textContent).toContain('€10 goedkoper dan de rest');
    expect(dialog?.textContent).toContain('€1.144,57 duurder');
  });

  it('keeps the overlay list flat and compact without decorative card effects', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const ruleBody = (selector: string) =>
      css.match(new RegExp(`(?:^|\\n)\\s*${selector} \\{[^}]+\\}`, 'u'))?.[0] ??
      '';
    const rowRule = ruleBody('\\.offerOverlayRow');
    const overlayRule = ruleBody('\\.offerOverlay');
    const headerRule = ruleBody('\\.offerOverlayHeader');
    const bodyRule = ruleBody('\\.offerOverlayBody');
    const listRule = ruleBody('\\.offerOverlayList');
    const merchantCellRule =
      css.match(/\.offerOverlayMerchantCell \{[^}]+\}/u)?.[0] ?? '';
    const merchantRule =
      css.match(/\.offerOverlayMerchant \{[^}]+\}/u)?.[0] ?? '';
    const badgesRule = css.match(/\.offerOverlayBadges \{[^}]+\}/u)?.[0] ?? '';
    const statusRule =
      css.match(/\.offerAvailabilityStatus \{[^}]+\}/u)?.[0] ?? '';
    const statusDotRule =
      css.match(/\.offerAvailabilityStatus::before \{[^}]+\}/u)?.[0] ?? '';
    const priceCellRule =
      css.match(/\.offerOverlayPriceCell \{[^}]+\}/u)?.[0] ?? '';
    const chevronRule =
      css.match(/\.offerOverlayChevron \{[^}]+\}/u)?.[0] ?? '';
    const mobileRuleBodies = (selector: string) =>
      [...css.matchAll(new RegExp(`${selector} \\{([^}]+)\\}`, 'gu'))].map(
        (match) => match[1] ?? '',
      );
    const mobileHeaderRule =
      mobileRuleBodies('\\.offerOverlayHeader').find((rule) =>
        rule.includes('padding: 0 var(--lego-space-2);'),
      ) ?? '';
    const mobileOverlayRule =
      mobileRuleBodies('\\.offerOverlay').find((rule) =>
        rule.includes('grid-template-rows: 64px minmax(0, 1fr);'),
      ) ?? '';
    const mobileRowRule =
      mobileRuleBodies('\\.offerOverlayRow').find((rule) =>
        rule.includes('minmax(0, 1fr) 8rem 1.5rem'),
      ) ?? '';

    expect(overlayRule).toContain('display: grid;');
    expect(overlayRule).toContain('grid-template-rows: 72px minmax(0, 1fr);');
    expect(headerRule).toContain('align-items: center;');
    expect(headerRule).not.toMatch(/(?:^|\n)\s*height:/u);
    expect(headerRule).not.toContain('min-height: 4');
    expect(headerRule).toContain('min-height: 0;');
    expect(headerRule).toContain('padding: 0 var(--lego-space-3);');
    expect(bodyRule).toContain('margin-top: 0;');
    expect(bodyRule).toContain('min-height: 0;');
    expect(bodyRule).toContain('overflow-y: auto;');
    expect(bodyRule).toContain('padding: 0;');
    expect(bodyRule).toContain('padding-top: 0;');
    expect(listRule).toContain('margin: 0;');
    expect(listRule).toContain('padding: 0;');
    expect(rowRule).toContain('min-height: 4.75rem;');
    expect(rowRule).toContain('padding: 0.5rem var(--lego-space-3);');
    expect(rowRule).toContain('grid-template-columns:');
    expect(rowRule).toContain('minmax(11.25rem, 1fr)');
    expect(rowRule).toContain('10rem');
    expect(rowRule).toContain('11.25rem');
    expect(rowRule).toContain('13.75rem 2rem');
    expect(rowRule).not.toContain('linear-gradient');
    expect(rowRule).not.toContain('box-shadow');
    expect(rowRule).not.toContain('border-radius');
    expect(merchantCellRule).toContain('min-width: 0;');
    expect(merchantRule).toContain('overflow: hidden;');
    expect(merchantRule).toContain('text-overflow: ellipsis;');
    expect(merchantRule).toContain('white-space: nowrap;');
    expect(badgesRule).toContain('max-width: 100%;');
    expect(badgesRule).toContain('overflow: hidden;');
    expect(statusRule).toContain('display: inline-flex;');
    expect(statusRule).toContain('white-space: nowrap;');
    expect(statusRule).not.toContain('padding:');
    expect(statusRule).not.toContain('background:');
    expect(statusRule).not.toContain('border-radius:');
    expect(statusDotRule).toContain('background: currentColor;');
    expect(statusDotRule).toContain('border-radius: var(--lego-radius-pill);');
    expect(priceCellRule).toContain('width: 13.75rem;');
    expect(priceCellRule).toContain('max-width: 13.75rem;');
    expect(priceCellRule).toContain('justify-items: end;');
    expect(priceCellRule).toContain('text-align: right;');
    expect(chevronRule).toContain('width: 2rem;');
    expect(mobileOverlayRule).toContain(
      'grid-template-rows: 64px minmax(0, 1fr);',
    );
    expect(mobileHeaderRule).toContain('padding: 0 var(--lego-space-2);');
    expect(mobileRowRule).toContain('minmax(0, 1fr) 8rem 1.5rem');
    expect(mobileRowRule).toContain('padding: 0.48rem var(--lego-space-2);');
  });
});
