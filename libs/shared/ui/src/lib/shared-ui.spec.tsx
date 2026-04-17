import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ActionLink,
  Breadcrumbs,
  Button,
  Container,
  LabelValueList,
  MarkerList,
  Panel,
  SectionHeading,
} from './shared-ui';

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
    expect(markup).toContain('Setdetail');
  });
});

describe('SectionHeading', () => {
  it('marks the eyebrow as a shared pre-title element', () => {
    const markup = renderToStaticMarkup(
      <SectionHeading
        description="Begin hier."
        eyebrow="Thema's"
        title="Alle thema's"
        titleAs="h1"
      />,
    );

    expect(markup).toContain('data-page-intro-eyebrow="true"');
    expect(markup).toContain('Thema&#x27;s');
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
      <ActionLink href="/discover" tone="accent">
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
      <ActionLink href="/discover" surface="image" tone="card">
        <p>Verder</p>
        <h3>Alle thema&apos;s</h3>
      </ActionLink>,
    );

    expect(markup).toContain('href="/discover"');
    expect(markup).toContain('cardLinkBase');
    expect(markup).toContain('<p>Verder</p>');
    expect(markup).toContain('<h3>Alle thema');
    expect(markup).not.toContain('interactiveSizeDefault');
    expect(markup).not.toContain('interactiveSurfaceImage');
  });
});

describe('Button', () => {
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
});
