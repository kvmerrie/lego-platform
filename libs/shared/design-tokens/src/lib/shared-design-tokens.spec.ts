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
    expect(themeStyles).toContain('--lego-color-surface: var(--lego-surface);');
    expect(themeStyles).toContain('--lego-color-text: var(--lego-text);');
    expect(themeStyles).toContain(
      '--lego-color-text-muted: var(--lego-text-muted);',
    );
    expect(themeStyles).toContain(
      '--lego-color-border-subtle: var(--lego-border-subtle);',
    );
    expect(themeStyles).toContain(
      '--lego-text-role-display-support-size: var(--lego-text-role-support-size);',
    );
    expect(themeStyles).toContain(
      '--lego-text-role-display-support-line-height: var(--lego-text-role-support-line-height);',
    );
    expect(themeStyles).toContain('--lego-caption-font-size: 0.78rem;');
    expect(themeStyles).toContain(
      '--lego-button-surface-default-primary-background: var(--lego-accent);',
    );
    expect(themeStyles).toContain('--lego-accent: #0057d9;');
    expect(themeStyles).toContain('--lego-accent-contrast: #ffffff;');
    expect(themeStyles).toContain(":root[data-theme='dark']");
    expect(themeStyles).toContain('--lego-accent: #5c9dff;');
    expect(themeStyles).toContain('--lego-border-strong:');
    expect(themeStyles).toContain(
      '--lego-button-surface-light-primary-background: var(--lego-contrast-ink);',
    );
    expect(themeStyles).toContain(
      '--lego-button-surface-dark-primary-background: var(--lego-contrast-white);',
    );
    expect(themeStyles).toContain(
      '--lego-button-surface-image-primary-background: var(--lego-contrast-ink);',
    );
    expect(themeStyles).toContain('--lego-button-height-lg: 2.9rem;');
    expect(themeStyles).toContain(
      '--lego-button-height-icon-md: var(--lego-button-height-md);',
    );
    expect(themeStyles).toContain(
      '--lego-button-focus-ring-color: var(--lego-focus-ring);',
    );
    expect(themeStyles).toContain(
      '--lego-button-focus-ring-color-inverse: var(--lego-contrast-white);',
    );
    expect(themeStyles).toContain(
      '--lego-button-focus-ring-gap-color: var(--lego-surface-default);',
    );
    expect(themeStyles).toContain('scroll-behavior: smooth;');
    expect(themeStyles).toContain("html[data-programmatic-scroll='true']");
    expect(themeStyles).toContain('scroll-behavior: auto !important;');
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
