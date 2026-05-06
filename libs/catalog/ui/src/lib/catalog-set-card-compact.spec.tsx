/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogSetCard } from './catalog-ui';

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

describe('CatalogSetCard compact interactions', () => {
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
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  function renderCompactCard({
    onFooterAction,
  }: {
    onFooterAction?: () => void;
  }) {
    act(() => {
      root.render(
        <CatalogSetCard
          actions={
            <button onClick={onFooterAction} type="button">
              Bewaar
            </button>
          }
          href="/sets/rivendell-10316"
          setSummary={{
            id: '10316',
            slug: 'rivendell-10316',
            name: 'Rivendell',
            theme: 'Icons',
            releaseYear: 2023,
            pieces: 6181,
            imageUrl: 'https://images.example/rivendell.jpg',
          }}
          variant="compact"
        />,
      );
    });
  }

  it('renders one full-card click layer without nesting footer actions', () => {
    renderCompactCard({});

    const cardLink = container.querySelector<HTMLAnchorElement>(
      '[data-catalog-set-card-click-layer="true"]',
    );
    const decisionZone = container.querySelector(
      '[class*="cardCompactDecisionZone"]',
    );
    const footerActions = container.querySelector(
      '[class*="cardCompactFooterActions"]',
    );
    const footerButton = container.querySelector('button');

    expect(cardLink).not.toBeNull();
    expect(cardLink?.getAttribute('href')).toBe('/sets/rivendell-10316');
    expect(decisionZone).not.toBeNull();
    expect(footerActions).not.toBeNull();
    expect(footerButton).not.toBeNull();
    expect(cardLink?.contains(footerActions)).toBe(false);
    expect(cardLink?.contains(footerButton)).toBe(false);
  });

  it('keeps footer actions independent from card navigation', () => {
    const footerAction = vi.fn();
    renderCompactCard({ onFooterAction: footerAction });

    const cardLink = container.querySelector<HTMLAnchorElement>(
      '[data-catalog-set-card-click-layer="true"]',
    );
    const footerButton = container.querySelector<HTMLButtonElement>('button');
    const cardNavigation = vi
      .spyOn(cardLink as HTMLAnchorElement, 'click')
      .mockImplementation(() => undefined);

    footerButton?.click();

    expect(footerAction).toHaveBeenCalledTimes(1);
    expect(cardNavigation).not.toHaveBeenCalled();
  });

  it('keeps the card link focusable for keyboard users', () => {
    renderCompactCard({});

    const cardLink = container.querySelector<HTMLAnchorElement>(
      '[data-catalog-set-card-click-layer="true"]',
    );

    cardLink?.focus();

    expect(document.activeElement).toBe(cardLink);
  });
});
