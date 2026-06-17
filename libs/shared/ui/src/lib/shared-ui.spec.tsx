/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ActionLink,
  Breadcrumbs,
  Button,
  Container,
  GatedActionModal,
  LabelValueList,
  MarkerList,
  Panel,
  SectionHeading,
  DetailAccordionSection,
} from './shared-ui';
import { ResponsiveDialog } from './responsive-dialog';
import { SelectableItemDialog } from './selectable-item-dialog';
import {
  applyPreservedHeaderVisibility,
  getPreservedHeaderHiddenState,
  isHeaderScrollReactionSuppressed,
  preserveHeaderVisibility,
  resetProgrammaticScrollSuppressionForTests,
  suppressHeaderScrollReaction,
} from '@lego-platform/shared/util';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  resetProgrammaticScrollSuppressionForTests();
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  document.body.style.overscrollBehavior = '';
  document.body.style.paddingRight = '';
  document.body.style.position = '';
  document.body.style.scrollBehavior = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.documentElement.style.overflow = '';
  document.documentElement.style.overscrollBehavior = '';
  document.documentElement.style.scrollBehavior = '';
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0,
  });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Container', () => {
  it('renders shared alignment markup around its children', () => {
    const markup = renderToStaticMarkup(
      <Container as="section" className="shared-container" id="homepage-grid">
        <p>Aligned content</p>
      </Container>,
    );

    expect(markup).toContain('<section');
    expect(markup).toContain('id="homepage-grid"');
    expect(markup).toContain('shared-container');
    expect(markup).toContain('Aligned content');
  });
});

describe('DetailAccordionSection', () => {
  it('renders reusable product-detail accordion summary markup', () => {
    const markup = renderToStaticMarkup(
      <DetailAccordionSection
        className="detail-section"
        contentClassName="detail-content"
        defaultOpen
        summaryMeta={<span>5 sterren</span>}
        title="Productgegevens"
        titleId="product-details-title"
      >
        <p>Accordion body</p>
      </DetailAccordionSection>,
    );

    expect(markup).toContain('<section');
    expect(markup).toContain('detail-section');
    expect(markup).toContain('aria-labelledby="product-details-title"');
    expect(markup).toContain('<details');
    expect(markup).toContain('open=""');
    expect(markup).toContain('<summary');
    expect(markup).toContain('Productgegevens</h2>');
    expect(markup).toContain('5 sterren');
    expect(markup).toContain('detail-content');
    expect(markup).toContain('Accordion body');
  });

  it('defines shared title, chevron, focus and adjacent border styling', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/shared-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('.detailAccordionDisclosure');
    expect(css).toContain('border-block: var(--lego-border-width-1) solid');
    expect(css).toContain(
      '.detailAccordionSection + .detailAccordionSection .detailAccordionDisclosure',
    );
    expect(css).toContain('border-block-start: 0;');
    expect(css).toContain('.detailAccordionSummary:focus-visible');
    expect(css).toContain('.detailAccordionTitle');
    expect(css).toContain('font-size: 20px;');
    expect(css).toContain('font-weight: var(--lego-text-role-section-weight);');
    expect(css).toContain('.detailAccordionIconFrame');
    expect(css).toContain('flex: 0 0 2.75rem;');
    expect(css).toContain(
      '.detailAccordionDisclosure[open] .detailAccordionIcon',
    );
  });
});

describe('Panel', () => {
  it('renders heading content and children in a shared panel wrapper', () => {
    const markup = renderToStaticMarkup(
      <Panel
        as="section"
        description="Rustige hulp voor koopbeslissingen."
        eyebrow="Panel"
        title="Waarom dit telt"
      >
        <p>Panel body</p>
      </Panel>,
    );

    expect(markup).toContain('Waarom dit telt');
    expect(markup).toContain('Rustige hulp voor koopbeslissingen.');
    expect(markup).toContain('Panel body');
    expect(markup).not.toContain('lucide-chevron-right');
  });

  it('renders optional heading actions with a chevron', () => {
    const handleHeadingClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <Panel
          headingActionLabel="Bekijk alle winkels"
          headingOnClick={handleHeadingClick}
          title="3 winkels"
        >
          <p>Panel body</p>
        </Panel>,
      );
    });

    const headingButton = container.querySelector(
      'h2 button[aria-label="Bekijk alle winkels"]',
    ) as HTMLButtonElement | null;

    expect(headingButton).not.toBeNull();
    expect(headingButton?.textContent).toContain('3 winkels');
    expect(headingButton?.querySelector('svg')).not.toBeNull();

    act(() => {
      headingButton?.click();
    });

    expect(handleHeadingClick).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});

describe('MarkerList', () => {
  it('renders shared marker list items without local list markup', () => {
    const markup = renderToStaticMarkup(
      <MarkerList
        items={[
          { content: 'Eerst de prijs begrijpen.', id: 'first' },
          { content: 'Daarna kopen of volgen.', id: 'second' },
        ]}
      />,
    );

    expect(markup).toContain('<ul');
    expect(markup).toContain('Eerst de prijs begrijpen.');
    expect(markup).toContain('Daarna kopen of volgen.');
  });
});

describe('LabelValueList', () => {
  it('renders definition-list markup for repeated label/value structures', () => {
    const markup = renderToStaticMarkup(
      <LabelValueList
        items={[
          { id: 'checked', label: 'Nagekeken', value: '2 apr 2026, 09:00' },
          { id: 'stores', label: 'Winkels', value: '3 nagekeken' },
        ]}
      />,
    );

    expect(markup).toContain('<dl');
    expect(markup).toContain('<dt');
    expect(markup).toContain('<dd');
    expect(markup).toContain('Nagekeken');
    expect(markup).toContain('3 nagekeken');
  });

  it('supports the shared hero appearance for value-first spec strips', () => {
    const markup = renderToStaticMarkup(
      <LabelValueList
        appearance="hero"
        items={[
          { id: 'pieces', label: 'Stenen', value: '2.399' },
          { id: 'year', label: 'Jaar', value: '2024' },
        ]}
      />,
    );

    expect(markup).toContain('<dl');
    expect(markup).toContain('Stenen');
    expect(markup).toContain('2.399');
    expect(markup).toContain('Jaar');
    expect(markup).toContain('2024');
  });
});

describe('GatedActionModal', () => {
  it('renders reusable gated-action copy with post-auth context links', () => {
    const markup = renderToStaticMarkup(
      <GatedActionModal
        action="theme_favorite"
        body="Maak een gratis account aan om je favoriete thema’s te bewaren."
        primaryHref="/account"
        primaryLabel="Inloggen"
        reason="theme_favorite"
        returnUrl="/themes/icons"
        secondaryHref="/account?auth=sign-up"
        secondaryLabel="Account maken"
        title="Log in om dit te bewaren"
        onClose={() => undefined}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Log in om dit te bewaren');
    expect(markup).toContain('Inloggen');
    expect(markup).toContain('Account maken');
    expect(markup).toContain('Niet nu');
    expect(markup).toContain(
      'href="/account?action=theme_favorite&amp;reason=theme_favorite&amp;next=%2Fthemes%2Ficons"',
    );
    expect(markup).toContain(
      'href="/account?auth=sign-up&amp;action=theme_favorite&amp;reason=theme_favorite&amp;next=%2Fthemes%2Ficons"',
    );
  });
});

describe('ResponsiveDialog', () => {
  it('renders accessible dialog chrome and closes with Escape', async () => {
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ResponsiveDialog
          description="Kies meerdere thema’s achter elkaar."
          isOpen={true}
          title="Thema’s toevoegen"
          onClose={onClose}
        >
          <button type="button">Icons</button>
        </ResponsiveDialog>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(document.body.textContent).toContain('Thema’s toevoegen');
    expect(
      document.body.querySelector('[data-responsive-dialog-panel="true"]'),
    ).not.toBeNull();

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('locks document scroll until the close transition finishes', async () => {
    const container = document.createElement('div');
    const scrollTo = vi.fn();
    document.body.appendChild(container);
    const root = createRoot(container);

    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 128,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 980,
    });
    document.documentElement.style.scrollBehavior = 'smooth';
    document.body.style.scrollBehavior = 'smooth';

    await act(async () => {
      root.render(
        <ResponsiveDialog
          isOpen={true}
          title="Recensie schrijven"
          onClose={() => undefined}
        >
          <p>Dialog body</p>
        </ResponsiveDialog>,
      );
    });

    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overscrollBehavior).toBe('none');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('none');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-128px');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.paddingRight).toBe('20px');

    await act(async () => {
      root.render(
        <ResponsiveDialog
          isOpen={false}
          title="Recensie schrijven"
          onClose={() => undefined}
        >
          <p>Dialog body</p>
        </ResponsiveDialog>,
      );
    });

    const closingPanel = document.body.querySelector(
      '[data-responsive-dialog-panel="true"]',
    );
    const closingLayer = document.body.querySelector(
      '[data-responsive-dialog-layer="true"]',
    );

    expect(closingPanel).not.toBeNull();
    expect(closingLayer?.getAttribute('data-responsive-dialog-state')).toBe(
      'closing',
    );
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      closingPanel?.dispatchEvent(
        new Event('transitionend', { bubbles: true }),
      );
    });

    expect(
      document.body.querySelector('[data-responsive-dialog-panel="true"]'),
    ).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.documentElement.style.overscrollBehavior).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.overscrollBehavior).toBe('');
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.width).toBe('');
    expect(document.body.style.paddingRight).toBe('');
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
    expect(document.body.style.scrollBehavior).toBe('smooth');
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: 'auto',
      left: 0,
      top: 128,
    });
    expect(isHeaderScrollReactionSuppressed()).toBe(true);
    expect(getPreservedHeaderHiddenState()).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('defines a mobile bottom-sheet presentation', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/shared-ui.module.css'),
      'utf-8',
    );
    const mobileRuleStart = css.indexOf('@media (max-width: 47.9375rem)');
    const mobileCss = css.slice(mobileRuleStart);

    expect(mobileCss).toContain('.responsiveDialogLayer');
    expect(mobileCss).toContain('align-items: end;');
    expect(mobileCss).toContain(
      'padding: var(--responsive-dialog-sheet-top-offset) 0 0;',
    );
    expect(mobileCss).toContain('.responsiveDialogPanel');
    expect(mobileCss).toContain('border-end-end-radius: 0;');
    expect(mobileCss).toContain(
      '100dvh - var(--responsive-dialog-sheet-top-offset)',
    );
    expect(css).toContain('--responsive-dialog-sheet-top-offset: 64px;');
    expect(css).toContain('--responsive-dialog-open-duration: 380ms;');
    expect(css).toContain('--responsive-dialog-close-duration: 260ms;');
    expect(css).toContain('cubic-bezier(0.32, 0.72, 0, 1)');
    expect(css).toContain('cubic-bezier(0.32, 0, 0.67, 0)');
    expect(css).toContain("data-responsive-dialog-state='open'");
    expect(css).toContain("data-responsive-dialog-state='closing'");
    expect(css).toContain('transform: translateY(100%);');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('overscroll-behavior: contain;');
    expect(css).toContain('touch-action: none;');
  });
});

describe('Programmatic scroll suppression', () => {
  it('marks the document while programmatic scroll should bypass smooth behavior', () => {
    const releaseSuppression = suppressHeaderScrollReaction('test-scroll', 300);

    expect(isHeaderScrollReactionSuppressed()).toBe(true);
    expect(
      document.documentElement.getAttribute('data-programmatic-scroll'),
    ).toBe('true');

    releaseSuppression();

    expect(isHeaderScrollReactionSuppressed()).toBe(true);
    expect(isHeaderScrollReactionSuppressed(performance.now() + 301)).toBe(
      false,
    );

    resetProgrammaticScrollSuppressionForTests();

    expect(
      document.documentElement.hasAttribute('data-programmatic-scroll'),
    ).toBe(false);
  });

  it('preserves hidden header visibility during modal lifecycle restores', () => {
    document.documentElement.setAttribute('data-shell-header-hidden', 'true');

    const releasePreservation = preserveHeaderVisibility('dialog-close');

    document.documentElement.removeAttribute('data-shell-header-hidden');
    applyPreservedHeaderVisibility();

    expect(getPreservedHeaderHiddenState()).toBe(true);
    expect(
      document.documentElement.getAttribute('data-shell-header-hidden'),
    ).toBe('true');

    releasePreservation();

    expect(getPreservedHeaderHiddenState()).toBeUndefined();
  });

  it('preserves visible header visibility during modal lifecycle restores', () => {
    document.documentElement.removeAttribute('data-shell-header-hidden');

    const releasePreservation = preserveHeaderVisibility('dialog-close');

    document.documentElement.setAttribute('data-shell-header-hidden', 'true');
    applyPreservedHeaderVisibility();

    expect(getPreservedHeaderHiddenState()).toBe(false);
    expect(
      document.documentElement.hasAttribute('data-shell-header-hidden'),
    ).toBe(false);

    releasePreservation();

    expect(getPreservedHeaderHiddenState()).toBeUndefined();
  });
});

describe('SelectableItemDialog', () => {
  it('filters selectable items and reports toggles', async () => {
    const onToggle = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SelectableItemDialog
          isOpen={true}
          items={[
            {
              id: 'theme:icons',
              isSelected: true,
              label: 'Icons',
              meta: '38 sets',
              searchText: 'icons rivendell',
            },
            {
              id: 'theme:minecraft',
              label: 'Minecraft®',
              meta: '35 sets',
              searchText: 'minecraft creeper',
            },
          ]}
          title="Thema’s toevoegen"
          onClose={() => undefined}
          onToggle={onToggle}
        />,
      );
    });

    const searchInput = document.body.querySelector<HTMLInputElement>(
      'input[type="search"]',
    );

    expect(document.body.textContent).toContain('Icons');
    expect(document.body.textContent).toContain('Minecraft®');

    await act(async () => {
      if (searchInput) {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set?.call(searchInput, 'mine');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(document.body.textContent).not.toContain('Icons');
    expect(document.body.textContent).toContain('Minecraft®');

    const minecraftButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.includes('Minecraft®'));

    await act(async () => {
      minecraftButton?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });

    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'theme:minecraft' }),
    );

    await act(async () => {
      root.unmount();
    });
  });
});

describe('Breadcrumbs', () => {
  it('renders semantic breadcrumb markup with linked ancestors and a current page label', () => {
    const markup = renderToStaticMarkup(
      <Breadcrumbs
        ariaLabel="Setcontext"
        items={[
          { href: '/themes', id: 'themes', label: "Thema's" },
          { href: '/themes/icons', id: 'icons', label: 'Icons' },
          { id: 'detail', label: 'Setdetail' },
        ]}
      />,
    );

    expect(markup).toContain('<nav');
    expect(markup).toContain('aria-label="Setcontext"');
    expect(markup).toContain('<ol');
    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('href="/themes/icons"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-current="true"');
    expect(markup).toContain('Setdetail');
  });

  it('keeps mobile breadcrumbs on one line and truncates the current page', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/shared-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain('@media (max-width: 47.9375rem)');
    expect(css).toContain('flex-wrap: nowrap;');
    expect(css).toContain(".breadcrumbItem[data-current='true']");
    expect(css).toContain('flex: 1 1 auto;');
    expect(css).toContain('text-overflow: ellipsis;');
    expect(css).toContain('white-space: nowrap;');
    expect(css).toContain('@media (max-width: 23.75rem)');
  });

  it('uses calm readable breadcrumb link and current item styling', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/shared-ui.module.css'),
      'utf-8',
    );

    expect(css).toContain(
      'font-size: var(--lego-breadcrumb-font-size, 0.8125rem);',
    );
    expect(css).toContain(
      'color: var(--lego-breadcrumb-link, var(--lego-info));',
    );
    expect(css).toContain(
      'color: var(--lego-breadcrumb-current, var(--lego-text-muted));',
    );
    expect(css).toContain('.breadcrumbLink:hover');
    expect(css).toContain('text-decoration-color: currentColor;');
  });
});

describe('SectionHeading', () => {
  it('renders title and description without a pre-title eyebrow', () => {
    const markup = renderToStaticMarkup(
      <SectionHeading
        description="Begin hier."
        eyebrow="Thema's"
        title="Alle thema's"
        titleAs="h1"
      />,
    );

    expect(markup).toContain('Alle thema&#x27;s');
    expect(markup).toContain('Begin hier.');
    expect(markup).not.toContain('data-page-intro-eyebrow');
    expect(markup).not.toContain('Thema&#x27;s');
  });
});

describe('ActionLink', () => {
  it('wraps standard action content above the pressed overlay layer', () => {
    const markup = renderToStaticMarkup(
      <ActionLink
        href="/themes/marvel"
        size="hero"
        surface="dark"
        tone="secondary"
      >
        Bekijk thema
      </ActionLink>,
    );

    expect(markup).toContain('href="/themes/marvel"');
    expect(markup).toContain('Bekijk thema');
    expect(markup).toContain('interactiveContent');
    expect(markup).toContain('interactiveSizeHero');
    expect(markup).toContain('interactiveSurfaceDark');
  });

  it('uses the explicit default size model for regular action links', () => {
    const markup = renderToStaticMarkup(
      <ActionLink href="/themes" tone="accent">
        Ontdek sets
      </ActionLink>,
    );

    expect(markup).toContain('interactiveSizeDefault');
    expect(markup).toContain('interactiveContent');
    expect(markup).toContain('interactiveSurfaceDefault');
  });

  it('supports a dedicated light-surface treatment without changing shared sizing', () => {
    const markup = renderToStaticMarkup(
      <ActionLink
        href="/themes/icons"
        size="hero"
        surface="light"
        tone="accent"
      >
        Bekijk alle Icons sets
      </ActionLink>,
    );

    expect(markup).toContain('interactiveSizeHero');
    expect(markup).toContain('interactiveSurfaceLight');
    expect(markup).toContain('interactiveContent');
  });

  it('keeps card links as block content instead of collapsing them into inline content', () => {
    const markup = renderToStaticMarkup(
      <ActionLink href="/themes" surface="image" tone="card">
        <p>Verder</p>
        <h3>Alle thema&apos;s</h3>
      </ActionLink>,
    );

    expect(markup).toContain('href="/themes"');
    expect(markup).toContain('cardLinkBase');
    expect(markup).toContain('<p>Verder</p>');
    expect(markup).toContain('<h3>Alle thema');
    expect(markup).not.toContain('interactiveSizeDefault');
    expect(markup).not.toContain('interactiveSurfaceImage');
  });
});

describe('Button', () => {
  it('supports the consolidated primary, secondary, tertiary, icon, and icon-secondary variants', () => {
    const markup = renderToStaticMarkup(
      <>
        <Button variant="primary">Pak deze</Button>
        <Button variant="secondary">Vergelijk</Button>
        <Button variant="tertiary">Meer</Button>
        <Button aria-label="Bewaar" size="icon-md" variant="icon">
          <span aria-hidden="true">+</span>
        </Button>
        <Button aria-label="Volg" size="icon-md" variant="icon-secondary">
          <span aria-hidden="true">♥</span>
        </Button>
      </>,
    );

    expect(markup).toContain('buttonAccent');
    expect(markup).toContain('buttonSecondary');
    expect(markup).toContain('buttonGhost');
    expect(markup).toContain('buttonIcon');
    expect(markup).toContain('buttonIconSecondary');
    expect(markup).toContain('interactiveSizeIconMd');
  });

  it('supports inline text-action treatment without the default button sizing shell', () => {
    const markup = renderToStaticMarkup(
      <Button tone="inline" type="button">
        Bekijk meer
      </Button>,
    );

    expect(markup).toContain('Bekijk meer');
    expect(markup).toContain('buttonInline');
    expect(markup).not.toContain('interactiveSizeDefault');
  });

  it('keeps button sizing, icon geometry, secondary borders, and focus rings in the shared system', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/shared-ui.module.css'),
      'utf-8',
    );
    const baseRule = css.match(/\.interactiveBase \{[^}]+\}/u)?.[0] ?? '';
    const heroSizeRule =
      css.match(/\.interactiveSizeHero \{[^}]+\}/u)?.[0] ?? '';
    const iconRule =
      css.match(
        /\.buttonIcon,\n {2}\.buttonIconSecondary,\n {2}\.linkIcon,\n {2}\.linkIconSecondary \{[^}]+\}/u,
      )?.[0] ?? '';
    const focusRule =
      css.match(/\.interactiveBase:focus-visible \{[^}]+\}/u)?.[0] ?? '';
    const darkSurfaceRule =
      css.match(/\.interactiveSurfaceDark \{[^}]+\}/u)?.[0] ?? '';
    const secondaryHoverRule =
      css.match(
        /\.buttonSecondary:hover,\n {2}\.linkSecondary:hover \{[^}]+\}/u,
      )?.[0] ?? '';
    const secondaryActiveRule =
      css.match(
        /\.buttonSecondary:active,[\s\S]+?\.linkSecondary\[aria-pressed='true'\] \{[\s\S]+?\n {2}\}/u,
      )?.[0] ?? '';

    expect(baseRule).toContain(
      'border-radius: var(--lego-button-border-radius',
    );
    expect(baseRule).toContain('appearance: none;');
    expect(baseRule).toContain(
      'var(--lego-button-height, var(--lego-button-height-md))',
    );
    expect(heroSizeRule).toContain(
      '--lego-action-min-height: var(--lego-button-height-lg);',
    );
    expect(iconRule).toContain(
      '--lego-button-icon-control-size: var(\n      --lego-action-min-height',
    );
    expect(iconRule).toContain(
      'block-size: var(--lego-button-icon-control-size);',
    );
    expect(iconRule).toContain(
      'inline-size: var(--lego-button-icon-control-size);',
    );
    expect(focusRule).toContain(
      'box-shadow: 0 0 0 var(--lego-button-focus-ring-offset)',
    );
    expect(focusRule).toContain(
      'var(--lego-button-focus-ring-gap-color, var(--lego-surface-default))',
    );
    expect(focusRule).toContain(
      'outline: var(--lego-button-focus-ring-width) solid',
    );
    expect(focusRule).toContain(
      'outline-offset: var(--lego-button-focus-ring-offset);',
    );
    expect(darkSurfaceRule).toContain(
      '--lego-button-focus-ring-color: var(--lego-button-focus-ring-color-inverse);',
    );
    expect(secondaryHoverRule).toContain(
      '--lego-button-secondary-hover-border-color',
    );
    expect(secondaryHoverRule).toContain(
      '--lego-button-surface-secondary-border-color',
    );
    expect(secondaryHoverRule).not.toContain(
      'border-color: var(--lego-button-secondary-hover-border-color, transparent);',
    );
    expect(secondaryActiveRule).toContain(
      '--lego-button-secondary-active-border-color',
    );
    expect(secondaryActiveRule).not.toContain(
      'border-color: var(--lego-button-secondary-active-border-color, transparent);',
    );
  });
});
