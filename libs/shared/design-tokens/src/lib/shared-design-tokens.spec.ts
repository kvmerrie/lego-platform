import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { ensureThemeStyles, getThemeStyles } from './shared-design-tokens';

describe('shared design tokens', () => {
  it('exposes legacy default aliases for shared surfaces and text', () => {
    const themeStyles = getThemeStyles();

    expect(themeStyles).toContain(
      "--lego-font-family-body: var(--font-plus-jakarta-sans, 'Plus Jakarta Sans'), 'Avenir Next', Avenir, 'Segoe UI', 'Helvetica Neue', sans-serif;",
    );
    expect(themeStyles).toContain(
      "--lego-font-family-heading: var(--font-plus-jakarta-sans, 'Plus Jakarta Sans'), 'Avenir Next', Avenir, 'Segoe UI', 'Helvetica Neue', sans-serif;",
    );
    expect(themeStyles).toContain(
      '--lego-surface-default: var(--lego-surface);',
    );
    expect(themeStyles).toContain('--lego-text-default: var(--lego-text);');
    expect(themeStyles).toContain(
      '--lego-button-surface-default-primary-background: var(--lego-accent);',
    );
    expect(themeStyles).toContain(
      '--lego-button-surface-light-primary-background: var(--lego-contrast-ink);',
    );
    expect(themeStyles).toContain(
      '--lego-button-surface-dark-primary-background: var(--lego-contrast-white);',
    );
    expect(themeStyles).toContain(
      '--lego-button-surface-image-primary-background: var(--lego-contrast-ink);',
    );
    expect(themeStyles).toContain('scroll-behavior: smooth;');
  });

  it('injects the shared theme styles into the document head once', () => {
    const dom = new JSDOM('<html><head></head><body></body></html>');

    ensureThemeStyles(dom.window.document);
    ensureThemeStyles(dom.window.document);

    const themeStyleElements = dom.window.document.head.querySelectorAll(
      "style[data-lego-theme-styles='true']",
    );

    expect(themeStyleElements).toHaveLength(1);
    expect(themeStyleElements[0]?.textContent).toContain('--lego-surface:');
  });
});
