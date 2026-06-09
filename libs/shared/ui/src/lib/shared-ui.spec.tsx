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
} from './shared-ui';
import { ResponsiveDialog } from './responsive-dialog';
import { SelectableItemDialog } from './selectable-item-dialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
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

  it('defines a mobile bottom-sheet presentation', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/lib/shared-ui.module.css'),
      'utf-8',
    );
    const mobileRuleStart = css.indexOf('@media (max-width: 47.9375rem)');
    const mobileCss = css.slice(mobileRuleStart);

    expect(mobileCss).toContain('.responsiveDialogLayer');
    expect(mobileCss).toContain('align-items: end;');
    expect(mobileCss).toContain('.responsiveDialogPanel');
    expect(mobileCss).toContain('border-end-end-radius: 0;');
    expect(mobileCss).toContain('max-block-size: 88vh;');
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
        /\.buttonIcon,\n  \.buttonIconSecondary,\n  \.linkIcon,\n  \.linkIconSecondary \{[^}]+\}/u,
      )?.[0] ?? '';
    const focusRule =
      css.match(/\.interactiveBase:focus-visible \{[^}]+\}/u)?.[0] ?? '';
    const darkSurfaceRule =
      css.match(/\.interactiveSurfaceDark \{[^}]+\}/u)?.[0] ?? '';
    const secondaryHoverRule =
      css.match(
        /\.buttonSecondary:hover,\n  \.linkSecondary:hover \{[^}]+\}/u,
      )?.[0] ?? '';
    const secondaryActiveRule =
      css.match(
        /\.buttonSecondary:active,[\s\S]+?\.linkSecondary\[aria-pressed='true'\] \{[\s\S]+?\n  \}/u,
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
