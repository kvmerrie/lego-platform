import { describe, expect, it } from 'vitest';
import { getThemeStyles } from './shared-design-tokens';

describe('shared design tokens', () => {
  it('exposes legacy default aliases for shared surfaces and text', () => {
    const themeStyles = getThemeStyles();

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
});
