import { platformConfig } from '@lego-platform/shared/config';
import { ThemeMode } from '@lego-platform/shared/types';

type ThemeTokenMap = Record<string, string>;

export const designBreakpoints = {
  md: '48rem',
  lg: '56rem',
} as const;

const baseTokens: ThemeTokenMap = {
  'lego-border-width-1': '1px',
  'lego-border-width-2': '2px',
  'lego-breakpoint-md': designBreakpoints.md,
  'lego-breakpoint-lg': designBreakpoints.lg,
  'lego-font-family-body': "'Avenir Next', 'Segoe UI', sans-serif",
  'lego-font-family-heading': "'Iowan Old Style', 'Palatino Linotype', serif",
  'lego-font-family-mono': "'SFMono-Regular', 'Cascadia Code', monospace",
  'lego-font-size-caption': '0.78rem',
  'lego-font-size-sm': '0.9rem',
  'lego-font-size-body': '1rem',
  'lego-font-size-lg': '1.1rem',
  'lego-font-size-xl': '1.3rem',
  'lego-font-size-2xl': '1.8rem',
  'lego-font-size-3xl': '2.4rem',
  'lego-font-size-4xl': 'clamp(2.4rem, 4vw, 3.2rem)',
  'lego-font-weight-medium': '500',
  'lego-font-weight-semibold': '600',
  'lego-font-weight-bold': '700',
  'lego-line-height-tight': '1.15',
  'lego-line-height-body': '1.5',
  'lego-line-height-relaxed': '1.7',
  'lego-radius-xs': '12px',
  'lego-radius-md': '18px',
  'lego-radius-lg': '28px',
  'lego-radius-sm': '999px',
  'lego-shadow-sm':
    '0 10px 24px rgba(15, 23, 42, 0.08), 0 4px 10px rgba(15, 23, 42, 0.06)',
  'lego-shadow-md':
    '0 18px 48px rgba(15, 23, 42, 0.12), 0 8px 20px rgba(15, 23, 42, 0.08)',
  'lego-shadow-lg':
    '0 24px 80px rgba(15, 23, 42, 0.14), 0 12px 24px rgba(15, 23, 42, 0.1)',
  'lego-shadow':
    '0 18px 48px rgba(15, 23, 42, 0.12), 0 8px 20px rgba(15, 23, 42, 0.08)',
  'lego-space-1': '0.25rem',
  'lego-space-2': '0.5rem',
  'lego-space-3': '0.75rem',
  'lego-space-4': '1rem',
  'lego-space-5': '1.25rem',
  'lego-space-6': '1.5rem',
  'lego-space-8': '2rem',
  'lego-space-10': '2.5rem',
  'lego-space-12': '3rem',
  'lego-space-16': '4rem',
  'lego-max-width': '1200px',
  'lego-max-width-page': '1200px',
  'lego-max-width-reading': '70ch',
  'lego-motion-duration-fast': '140ms',
  'lego-motion-duration-normal': '220ms',
  'lego-motion-duration-slow': '320ms',
  'lego-motion-ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'lego-motion-ease-emphasized': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'lego-text-role-body-size': 'var(--lego-font-size-body)',
  'lego-text-role-body-line-height': 'var(--lego-line-height-body)',
  'lego-text-role-display-size': 'var(--lego-font-size-4xl)',
  'lego-text-role-display-line-height': 'var(--lego-line-height-tight)',
  'lego-text-role-heading-size': 'var(--lego-font-size-2xl)',
  'lego-text-role-heading-line-height': 'var(--lego-line-height-tight)',
  'lego-text-role-section-size': 'var(--lego-font-size-xl)',
  'lego-text-role-section-line-height': '1.25',
  'lego-text-role-eyebrow-size': 'var(--lego-font-size-caption)',
};

const lightThemeTokens: ThemeTokenMap = {
  'lego-background': '#f4efe4',
  'lego-surface': '#fffaf0',
  'lego-surface-muted': '#efe5d7',
  'lego-text': '#1f2430',
  'lego-text-muted': '#5a6372',
  'lego-border': '#d8ccb9',
  'lego-accent': '#b9542d',
  'lego-accent-hover': '#a04622',
  'lego-positive': '#1f7a57',
  'lego-warning': '#9d6b00',
  'lego-focus-ring': 'rgba(185, 84, 45, 0.28)',
  'lego-disabled': '#b8ac98',
};

const darkThemeTokens: ThemeTokenMap = {
  'lego-background': '#121821',
  'lego-surface': '#1b2430',
  'lego-surface-muted': '#253142',
  'lego-text': '#f6efe3',
  'lego-text-muted': '#b7c0cf',
  'lego-border': '#3b4a60',
  'lego-accent': '#ff8c5a',
  'lego-accent-hover': '#ffa47d',
  'lego-positive': '#67d49d',
  'lego-warning': '#f0c35b',
  'lego-focus-ring': 'rgba(255, 209, 186, 0.3)',
  'lego-disabled': '#627086',
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
  font-family: var(--lego-font-family-body);
  font-size: var(--lego-text-role-body-size);
  line-height: var(--lego-text-role-body-line-height);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
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
