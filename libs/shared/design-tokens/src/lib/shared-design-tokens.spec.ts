import { describe, expect, it } from 'vitest';
import { getThemeStyles } from './shared-design-tokens';

describe('shared design tokens', () => {
  it('exposes legacy default aliases for shared surfaces and text', () => {
    const themeStyles = getThemeStyles();

    expect(themeStyles).toContain(
      '--lego-surface-default: var(--lego-surface);',
    );
    expect(themeStyles).toContain('--lego-text-default: var(--lego-text);');
  });
});
