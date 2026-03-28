import { platformConfig } from '@lego-platform/shared/config';
import { ThemeMode } from '@lego-platform/shared/types';

type ThemeTokenMap = Record<string, string>;

const baseTokens: ThemeTokenMap = {
  'lego-radius-lg': '28px',
  'lego-radius-md': '18px',
  'lego-radius-sm': '999px',
  'lego-shadow':
    '0 24px 80px rgba(15, 23, 42, 0.12), 0 12px 24px rgba(15, 23, 42, 0.08)',
  'lego-space-2': '0.5rem',
  'lego-space-3': '0.75rem',
  'lego-space-4': '1rem',
  'lego-space-6': '1.5rem',
  'lego-space-8': '2rem',
  'lego-space-12': '3rem',
  'lego-max-width': '1200px',
};

const lightThemeTokens: ThemeTokenMap = {
  'lego-background': '#f6f2e8',
  'lego-surface': '#fffbf4',
  'lego-surface-muted': '#efe5d5',
  'lego-text': '#1f2430',
  'lego-text-muted': '#5a6472',
  'lego-border': '#d6c7b5',
  'lego-accent': '#b94d25',
  'lego-accent-strong': '#7e2e14',
  'lego-positive': '#1e7a4d',
  'lego-warning': '#9b6b00',
};

const darkThemeTokens: ThemeTokenMap = {
  'lego-background': '#14181f',
  'lego-surface': '#1a2029',
  'lego-surface-muted': '#252f3d',
  'lego-text': '#f6efe2',
  'lego-text-muted': '#b5bdcb',
  'lego-border': '#3d4a5f',
  'lego-accent': '#ff8f63',
  'lego-accent-strong': '#ffd5c6',
  'lego-positive': '#69d89a',
  'lego-warning': '#ffd067',
};

const themeTokens: Record<ThemeMode, ThemeTokenMap> = {
  light: {
    ...baseTokens,
    ...lightThemeTokens,
  },
  dark: {
    ...baseTokens,
    ...darkThemeTokens,
  },
};

export const themeStorageKey = 'lego-platform-theme';

function toCssVariables(tokens: ThemeTokenMap): string {
  return Object.entries(tokens)
    .map(([tokenName, tokenValue]) => `  --${tokenName}: ${tokenValue};`)
    .join('\n');
}

export function getThemeStyles(): string {
  return `
:root {
${toCssVariables(themeTokens.light)}
  color-scheme: light;
}

:root[data-theme='dark'] {
${toCssVariables(themeTokens.dark)}
  color-scheme: dark;
}

html {
  background: var(--lego-background);
  color: var(--lego-text);
}

body {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.4), transparent 18rem),
    var(--lego-background);
  color: var(--lego-text);
}
`.trim();
}

export function getThemeBootstrapScript(): string {
  return `
(() => {
  const key = '${themeStorageKey}';
  const stored = window.localStorage.getItem(key);
  const supportsMatchMedia = typeof window.matchMedia === 'function';
  const system = supportsMatchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const mode = stored === 'dark' || stored === 'light' ? stored : system;
  document.documentElement.dataset.theme = mode;
})();
`.trim();
}

export function getInitialThemeMode(): ThemeMode {
  return platformConfig.defaultThemeMode;
}

export function getPreferredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return getInitialThemeMode();
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey);

  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  if (typeof window.matchMedia !== 'function') {
    return getInitialThemeMode();
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset['theme'] = mode;
}

export function persistThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(themeStorageKey, mode);
}

export function toggleThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'dark' ? 'light' : 'dark';
}
