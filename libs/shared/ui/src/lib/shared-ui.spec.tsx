import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Breadcrumbs,
  Container,
  LabelValueList,
  MarkerList,
  Panel,
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
