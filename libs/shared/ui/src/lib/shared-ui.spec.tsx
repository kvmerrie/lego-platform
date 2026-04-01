import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Container } from './shared-ui';

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
