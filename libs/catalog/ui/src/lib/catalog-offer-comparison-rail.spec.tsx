/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  },
  {
    checkedLabel: 'Vandaag om 09:05',
    ctaHref: 'https://example.com/alternative',
    ctaLabel: 'Bekijk bij LEGO',
    merchantLabel: 'LEGO',
    price: '€ 94,99',
    rankingLabel: '€ 5,00 hoger dan de beste optie.',
    stockLabel: 'Op voorraad',
  },
];

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

  async function openOverlay() {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={offers}
          summaryLabel="2 winkels nagekeken"
        />,
      );
    });

    const trigger = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Vergelijk alle 2 winkels'),
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
});
